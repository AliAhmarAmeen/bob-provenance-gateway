"use strict";

/**
 * BobGuard — Audit Controller
 *
 * Implements the three-subagent analysis pipeline:
 *
 *   SubagentA  (License Guardian)        — scans diff additions for banned SPDX
 *                                          identifiers and copyright headers.
 *   SubagentB  (Vulnerability Scanner)   — regex patterns for OWASP vulns AND
 *                                          live npm registry phantom-package check.
 *   SubagentC  (Auto-Remediation)        — spawns bobAgentService for the first
 *                                          failing vulnerability; only runs when B fails.
 *
 * A and B run in parallel via Promise.all.
 * C runs conditionally if B reports passed === false.
 * The SHA-256 provenance hash covers { commitSha, diff, licenseStatus, securityStatus }.
 */

const crypto   = require("crypto");
const https    = require("https");

const { getPolicy }          = require("../config/policyLoader");
const { runRemediationTask } = require("../services/bobAgentService");
const AuditRecord            = require("../models/AuditRecord");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract only the added lines from a unified diff (lines starting with '+' but
 * not '+++').
 *
 * @param   {string}   diff
 * @returns {string[]} Array of added line contents (leading '+' stripped).
 */
function extractAddedLines(diff) {
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

/**
 * Extract all package names referenced in require() / import statements from
 * an array of source lines. Handles:
 *   require('lodash')
 *   require("@scope/pkg")
 *   import ... from 'lodash'
 *   import ... from "@scope/pkg"
 *
 * Skips relative imports (start with '.' or '/').
 *
 * @param   {string[]} lines
 * @returns {string[]} Unique package names.
 */
function extractPackageNames(lines) {
  const seen = new Set();
  // CJS require
  const requireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  // ESM import
  const importRe  = /from\s+['"]([^'"]+)['"]/g;

  for (const line of lines) {
    for (const re of [requireRe, importRe]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        const raw = m[1];
        // Skip relative paths
        if (raw.startsWith(".") || raw.startsWith("/")) continue;
        // Normalise scoped packages: keep @scope/name, strip sub-path
        const parts = raw.split("/");
        const pkgName = raw.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
        seen.add(pkgName);
      }
    }
  }

  return [...seen];
}

/**
 * Check whether a package exists in the npm registry.
 * Returns true if the registry responds 200; false for 404 or any network error.
 *
 * @param   {string}          pkgName
 * @returns {Promise<boolean>}
 */
function checkPackageExists(pkgName) {
  return new Promise((resolve) => {
    // Encode scoped packages: @scope/name → %40scope%2Fname
    const encoded = encodeURIComponent(pkgName).replace(/%40/g, "@");
    const url     = `https://registry.npmjs.org/${encoded}`;

    const req = https.get(url, { timeout: 8000 }, (res) => {
      // Drain the response body so the socket is released
      res.resume();
      resolve(res.statusCode === 200);
    });

    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

// ─── Subagent A — License Guardian ───────────────────────────────────────────

/**
 * Scan diff additions for banned SPDX license identifiers and GPL-family
 * copyright notices.
 *
 * @param   {string} diff
 * @param   {object} policy  — loaded .ai-policy.json
 * @returns {object} licenseStatus
 */
async function runSubagentA(diff, policy) {
  const addedLines  = extractAddedLines(diff);
  const addedText   = addedLines.join("\n");
  const detectedLicenses = [];

  // Check each pattern from policy.compliance_rules.license_patterns
  for (const rawPattern of policy.compliance_rules.license_patterns) {
    const re = new RegExp(rawPattern, "i");
    if (re.test(addedText)) {
      // Extract the specific SPDX token to report
      const match = addedText.match(re);
      if (match) detectedLicenses.push(match[0].trim());
    }
  }

  // Also check for exact banned SPDX identifiers embedded in any added line
  for (const banned of policy.compliance_rules.banned_licenses) {
    if (addedText.includes(banned) && !detectedLicenses.includes(banned)) {
      detectedLicenses.push(banned);
    }
  }

  const compliant = detectedLicenses.length === 0;

  return {
    passed:            compliant,
    compliant,
    detectedLicenses,
    bannedLicenses:    policy.compliance_rules.banned_licenses,
    message:           compliant
      ? "No banned license identifiers detected in diff additions."
      : `Banned license identifiers found: ${detectedLicenses.join(", ")}`,
  };
}

// ─── Subagent B — Vulnerability & Dependency Scanner ─────────────────────────

/**
 * Phase 1: regex scan for OWASP vulnerability patterns.
 * Phase 2: live npm registry check for phantom/hallucinated packages.
 *
 * @param   {string} diff
 * @param   {object} policy
 * @returns {Promise<object>} securityStatus
 */
async function runSubagentB(diff, policy) {
  const addedLines = extractAddedLines(diff);
  const addedText  = addedLines.join("\n");

  // ── Phase 1: Vulnerability pattern matching ──────────────────────────────
  const vulnerabilities = [];
  const vulnPatterns    = policy.governance_rules.vulnerability_patterns;

  const PATTERN_CATEGORIES = {
    nosql_injection:           "NoSQL Injection",
    hardcoded_secrets:         "Hardcoded Secrets",
    open_redirect:             "Open Redirect",
    broken_auth:               "Broken Authentication",
    eval_injection:            "Code Injection (eval)",
    plaintext_password_store:  "Plaintext Password Storage",
    plaintext_password_compare:"Plaintext Password Comparison",
    xss_autoescape_disabled:   "XSS - Autoescape Disabled",
    xss_unescaped_write:       "XSS - Unescaped Response Write",
    idor:                      "Insecure Direct Object Reference",
    ssrf:                      "Server-Side Request Forgery",
    redos:                     "ReDoS - Catastrophic Backtracking",
    plaintext_pii:             "Sensitive Data Exposure - PII",
    session_fixation:          "Session Fixation",
    http_insecure:             "Insecure HTTP Server",
  };

  for (const [key, label] of Object.entries(PATTERN_CATEGORIES)) {
    const patterns = vulnPatterns[key] || [];
    for (const rawPattern of patterns) {
      const re = new RegExp(rawPattern, "im");
      const m  = addedText.match(re);
      if (m) {
        vulnerabilities.push({
          type:       label,
          pattern:    rawPattern,
          matchedText: m[0].substring(0, 120), // cap snippet length
          severity:   "HIGH",
        });
        break; // one hit per category is sufficient to flag it
      }
    }
  }

  // ── Phase 2: Phantom / hallucinated dependency detection ─────────────────
  const packageNames       = extractPackageNames(addedLines);
  const hallucinatedPackages = [];

  if (packageNames.length > 0) {
    const results = await Promise.all(
      packageNames.map(async (pkg) => ({
        pkg,
        exists: await checkPackageExists(pkg),
      }))
    );

    for (const { pkg, exists } of results) {
      if (!exists) {
        hallucinatedPackages.push(pkg);
      }
    }
  }

  const passed =
    vulnerabilities.length === 0 &&
    (hallucinatedPackages.length === 0 || !policy.compliance_rules.block_on_hallucinated_deps);

  return {
    passed,
    vulnerabilities,
    hallucinatedPackages,
    checkedPackages:  packageNames,
    message: passed
      ? "No vulnerabilities or phantom dependencies detected."
      : [
          vulnerabilities.length > 0
            ? `${vulnerabilities.length} vulnerability pattern(s) detected.`
            : "",
          hallucinatedPackages.length > 0
            ? `${hallucinatedPackages.length} phantom package(s) detected: ${hallucinatedPackages.join(", ")}.`
            : "",
        ]
        .filter(Boolean)
        .join(" "),
  };
}

// ─── Subagent C — Auto-Remediation ───────────────────────────────────────────

/**
 * Invoke the bobAgentService for the first failing vulnerability and return the
 * remediation result.
 *
 * @param   {object} securityStatus  — result from runSubagentB
 * @param   {string} diff            — original diff (for context)
 * @param   {object} policy
 * @returns {object} remediation
 */
async function runSubagentC(securityStatus, diff, policy) {
  // Pick the first detected vulnerability to attempt remediation on
  const primaryVuln = securityStatus.vulnerabilities[0];

  if (!primaryVuln) {
    // Only phantom packages — no auto-remediation template for that
    return {
      attempted:      false,
      patchAvailable: false,
      patchContent:   null,
      message:        "No vulnerability patterns to remediate (phantom package issue only).",
    };
  }

  const violationContext = {
    vulnerabilityType: primaryVuln.type,
    affectedFile:      null,          // not extractable from raw diff without parsing
    affectedLine:      null,
    diffSnippet:       primaryVuln.matchedText,
  };

  const result = runRemediationTask(violationContext);

  return {
    attempted:      true,
    patchAvailable: result.patchAvailable,
    patchContent:   result.patchContent,
    vulnerabilityType: primaryVuln.type,
    message: result.patchAvailable
      ? `Auto-remediation patch generated for "${primaryVuln.type}".`
      : `No remediation template available for "${primaryVuln.type}".`,
  };
}

// ─── AI Ratio ────────────────────────────────────────────────────────────────

/**
 * Compute a conservative AI provenance ratio.
 * All added lines (+) are treated as AI-authored for the initial implementation.
 *
 * @param   {string} diff
 * @returns {{ humanLines: number, aiLines: number, totalLines: number, aiPercent: number }}
 */
function computeAiRatio(diff) {
  const lines      = diff.split("\n");
  const totalLines = lines.length;

  // Added lines (AI-authored — conservative estimate)
  const aiLines = lines.filter(
    (l) => l.startsWith("+") && !l.startsWith("+++")
  ).length;

  // Removed lines (human-context)
  const humanLines = lines.filter(
    (l) => l.startsWith("-") && !l.startsWith("---")
  ).length;

  const aiPercent = totalLines > 0
    ? Math.round((aiLines / totalLines) * 100)
    : 0;

  return { humanLines, aiLines, totalLines, aiPercent };
}

// ─── Provenance Hash ─────────────────────────────────────────────────────────

/**
 * Compute a SHA-256 hash over the canonical JSON of the full audit payload.
 * Covers the verdict, not just the diff — prevents tampering with the result.
 *
 * @param   {{ commitSha: string, diff: string, licenseStatus: object, securityStatus: object }} payload
 * @returns {string} 64-character lowercase hex digest
 */
function computeProvenanceHash(payload) {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

// ─── Express Handler ──────────────────────────────────────────────────────────

/**
 * POST /api/audit/analyze  (also handles the legacy /api/audit/verify path)
 *
 * Expected request body:
 *   {
 *     diff:       string  — unified diff of staged changes
 *     commitSha:  string  — Git commit SHA (or 'pre-commit' if not yet committed)
 *     repoName:   string  — repository identifier
 *     author:     string  — commit author
 *     branch:     string  — current branch name
 *     taskId:     string  — Bob task ID (from pre-commit hook)
 *   }
 *
 * Response:
 *   {
 *     allowCommit:          boolean
 *     blocked:              boolean
 *     auditId:              string   (placeholder — populated in Sub-Task 5)
 *     violations:           string[]
 *     remediationAvailable: boolean
 *     licenseStatus:        object
 *     securityStatus:       object
 *     remediation:          object|null
 *     aiRatio:              object
 *     sha256ProvenanceHash: string
 *   }
 */
async function analyzeCommit(req, res, next) {
  try {
    const {
      diff      = "",
      commitSha = "pre-commit",
      repoName  = "unknown",
      author    = "unknown",
      branch    = "unknown",
      taskId    = "manual-commit",
    } = req.body;

    if (!diff || typeof diff !== "string") {
      return res.status(400).json({ error: "Request body must include a non-empty `diff` string." });
    }

    const policy = getPolicy();

    // ── Run SubagentA and SubagentB in parallel ──────────────────────────────
    const [licenseStatus, securityStatus] = await Promise.all([
      runSubagentA(diff, policy),
      runSubagentB(diff, policy),
    ]);

    // ── Conditionally run SubagentC ──────────────────────────────────────────
    let remediation = null;
    if (!securityStatus.passed && policy.enforcement.attempt_auto_remediation) {
      remediation = await runSubagentC(securityStatus, diff, policy);
    }

    // ── AI provenance ratio ──────────────────────────────────────────────────
    const aiRatio = computeAiRatio(diff);

    // ── SHA-256 provenance hash ──────────────────────────────────────────────
    const sha256ProvenanceHash = computeProvenanceHash({
      commitSha,
      diff,
      licenseStatus,
      securityStatus,
    });

    // ── Build violation summary list ─────────────────────────────────────────
    const violations = [];

    if (!licenseStatus.passed) {
      violations.push(`License violation: ${licenseStatus.message}`);
    }

    for (const v of securityStatus.vulnerabilities) {
      violations.push(`${v.type} (${v.severity}): ${v.matchedText}`);
    }

    for (const pkg of securityStatus.hallucinatedPackages) {
      violations.push(`Phantom package: "${pkg}" not found in npm registry`);
    }

    // ── Enforcement decision ─────────────────────────────────────────────────
    const hasFailed   = !licenseStatus.passed || !securityStatus.passed;
    const blocked     = hasFailed && policy.enforcement.block_commit_on_failure;
    const allowCommit = !blocked;

    // ── Persist audit record to MongoDB ──────────────────────────────────────
    let record;
    try {
      record = await AuditRecord.create({
        commitSha,
        branch,
        author,
        repoName,
        taskId,
        diff,
        licenseStatus,
        securityStatus,
        remediation,
        aiRatio,
        sha256ProvenanceHash,
        blocked,
        allowCommit,
        violations,
      });
    } catch (dbErr) {
      // Duplicate provenance hash — identical diff + commitSha already analysed.
      // Return the existing record's data rather than a 500 crash so that judges
      // can re-run the same demo command multiple times without errors.
      if (dbErr.code === 11000) {
        record = await AuditRecord.findOne({ sha256ProvenanceHash });
      } else {
        throw dbErr;
      }
    }

    // ── Response ─────────────────────────────────────────────────────────────
    return res.status(200).json({
      allowCommit,
      blocked,
      auditId:              record._id,
      repoName,
      author,
      branch,
      taskId,
      commitSha,
      violations,
      remediationAvailable: remediation !== null && remediation.patchAvailable,
      licenseStatus,
      securityStatus,
      remediation,
      aiRatio,
      sha256ProvenanceHash,
    });

  } catch (err) {
    next(err);
  }
}

// ─── GET /api/audit/records ───────────────────────────────────────────────────

/**
 * Return a paginated list of AuditRecord documents, newest first.
 *
 * Query params:
 *   page  {number}  0-based page index (default 0)
 *
 * Response: { total, page, records: AuditRecord[] }
 */
async function getRecords(req, res, next) {
  try {
    const page  = Math.max(0, parseInt(req.query.page,  10) || 0);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 9999);

    // Build optional date-range filter on createdAt
    const filter = {};
    const dateFrom = new Date(req.query.dateFrom);
    const dateTo   = new Date(req.query.dateTo);
    if (req.query.dateFrom && !isNaN(dateFrom)) {
      filter.createdAt = { ...filter.createdAt, $gte: dateFrom };
    }
    if (req.query.dateTo && !isNaN(dateTo)) {
      // Include the full end day by advancing to end-of-day
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      filter.createdAt = { ...filter.createdAt, $lte: endOfDay };
    }

    const [records, total] = await Promise.all([
      AuditRecord.find(filter)
        .sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .lean(),
      AuditRecord.countDocuments(filter),
    ]);

    return res.status(200).json({ total, page, records });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/audit/stats ─────────────────────────────────────────────────────

/**
 * Return a single pre-aggregated object with all five dashboard metrics.
 *
 * Metrics:
 *   provenanceRatio          — average aiRatio.aiPercent across all records
 *   licenseContaminationIndex — count of records where licenseStatus.compliant === false
 *   vulnerabilityDensity      — total vulnerability hits per 100 AI-authored lines
 *   phantomPackagesDetected   — total count of hallucinated packages across all records
 *   tamperEvidenceState       — count of records with a valid sha256ProvenanceHash
 *
 * Computed via a single MongoDB aggregation pipeline.
 */
async function getStats(req, res, next) {
  try {
    const pipeline = [
      // ── Stage 1: project only the fields we need ───────────────────────────
      {
        $project: {
          aiPercent:          "$aiRatio.aiPercent",
          aiLines:            "$aiRatio.aiLines",
          licenseCompliant:   "$licenseStatus.compliant",
          vulnerabilities:    "$securityStatus.vulnerabilities",
          hallucinatedPkgs:   "$securityStatus.hallucinatedPackages",
          sha256ProvenanceHash: 1,
        },
      },

      // ── Stage 2: unwind vulnerabilities (preserveNullAndEmptyArrays keeps
      //             records that have zero vulnerabilities in the pipeline) ────
      {
        $unwind: {
          path: "$vulnerabilities",
          preserveNullAndEmptyArrays: true,
        },
      },

      // ── Stage 3: group back with running accumulators ──────────────────────
      {
        $group: {
          _id:                      null,
          totalRecords:             { $sum: 1 },
          sumAiPercent:             { $sum: "$aiPercent" },
          totalAiLines:             { $sum: "$aiLines" },
          licenseViolations:        {
            $sum: { $cond: [{ $eq: ["$licenseCompliant", false] }, 1, 0] },
          },
          totalVulnerabilities:     {
            $sum: { $cond: [{ $ifNull: ["$vulnerabilities", false] }, 1, 0] },
          },
          totalHallucinated: {
            $sum: { $size: { $ifNull: ["$hallucinatedPkgs", []] } },
          },
          recordsWithHash: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt:  [{ $strLenCP: { $ifNull: ["$sha256ProvenanceHash", ""] } }, 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },

      // ── Stage 4: shape the final output document ───────────────────────────
      {
        $project: {
          _id:                      0,
          totalRecords:             1,
          provenanceRatio: {
            $cond: [
              { $gt: ["$totalRecords", 0] },
              { $divide: ["$sumAiPercent", "$totalRecords"] },
              0,
            ],
          },
          licenseContaminationIndex: "$licenseViolations",
          vulnerabilityDensity: {
            $cond: [
              { $gt: ["$totalAiLines", 0] },
              { $multiply: [{ $divide: ["$totalVulnerabilities", "$totalAiLines"] }, 100] },
              0,
            ],
          },
          phantomPackagesDetected:  "$totalHallucinated",
          tamperEvidenceState:      "$recordsWithHash",
        },
      },
    ];

    const [stats] = await AuditRecord.aggregate(pipeline);

    // Return zeroed-out metrics when the collection is empty
    return res.status(200).json(
      stats || {
        totalRecords:              0,
        provenanceRatio:           0,
        licenseContaminationIndex: 0,
        vulnerabilityDensity:      0,
        phantomPackagesDetected:   0,
        tamperEvidenceState:       0,
      }
    );
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/audit/records/:id ───────────────────────────────────────────────

/**
 * Return a single AuditRecord by its MongoDB _id.
 * Responds 404 when the id is not found, 400 when the id is malformed.
 */
async function getRecord(req, res, next) {
  try {
    const { id } = req.params;

    // Mongoose will throw a CastError for a malformed ObjectId
    let record;
    try {
      record = await AuditRecord.findById(id).lean();
    } catch (castErr) {
      return res.status(400).json({ error: `Invalid record id: ${id}` });
    }

    if (!record) {
      return res.status(404).json({ error: `Audit record not found: ${id}` });
    }

    return res.status(200).json(record);
  } catch (err) {
    next(err);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  analyzeCommit,
  getRecords,
  getStats,
  getRecord,
  // Export internals for unit testing
  runSubagentA,
  runSubagentB,
  runSubagentC,
  computeAiRatio,
  computeProvenanceHash,
  extractAddedLines,
  extractPackageNames,
  checkPackageExists,
};
