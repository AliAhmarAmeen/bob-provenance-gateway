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
    nosql_injection:  "NoSQL Injection",
    hardcoded_secrets: "Hardcoded Secrets",
    open_redirect:    "Open Redirect",
    broken_auth:      "Broken Authentication",
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
    const hasFailed = !licenseStatus.passed || !securityStatus.passed;
    const blocked   = hasFailed && policy.enforcement.block_commit_on_failure;
    const allowCommit = !blocked;

    // ── Response ─────────────────────────────────────────────────────────────
    return res.status(200).json({
      allowCommit,
      blocked,
      auditId:              null,  // populated in Sub-Task 5 after DB write
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

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  analyzeCommit,
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
