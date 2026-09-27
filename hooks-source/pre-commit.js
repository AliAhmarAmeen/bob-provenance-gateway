#!/usr/bin/env node

/**
 * BobGuard AI Provenance Gateway — Pre-Commit Hook
 *
 * Location : <repo-root>/.git/hooks/pre-commit
 * Fires    : before every `git commit` in this monorepo
 *
 * Flow:
 *   1. Capture `git diff --cached` (staged changes)
 *   2. Read the latest Bob Task ID from .bob/latest_task_id
 *   3. POST { repoName, diff, taskId } to the BobGuard gateway
 *   4. If the gateway responds { allowCommit: false }, block with exit(1)
 *   5. If the gateway is unreachable within 15 s, fail open with a warning
 */

"use strict";

const http = require("http");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ─── Config ──────────────────────────────────────────────────────────────────

const GATEWAY_HOST = "localhost";
const GATEWAY_PORT = 5000;
const GATEWAY_PATH = "/api/audit/verify";
const TIMEOUT_MS   = 15000;
const REPO_NAME    = path.basename(process.cwd());
const BOB_TASK_FILE = path.join(process.cwd(), ".bob", "latest_task_id");

// ─── ANSI colour helpers (no external deps) ──────────────────────────────────

const c = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  red:    "\x1b[31m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
};

const log = {
  info:  (msg) => console.log(`${c.cyan}[BobGuard]${c.reset} ${msg}`),
  ok:    (msg) => console.log(`${c.green}${c.bold}[BobGuard ✔]${c.reset} ${msg}`),
  warn:  (msg) => console.warn(`${c.yellow}${c.bold}[BobGuard ⚠]${c.reset}  ${msg}`),
  error: (msg) => console.error(`${c.red}${c.bold}[BobGuard ✘]${c.reset} ${msg}`),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Capture the full staged diff.
 * Returns an empty string when there are no staged changes.
 */
function getGitStagedDiff() {
  try {
    return execSync("git diff --cached", { encoding: "utf8" });
  } catch {
    return "";
  }
}

/**
 * Read the Bob Task ID that was written by the Bob CLI after its last run.
 * Falls back to 'manual-commit' when the file doesn't exist or is empty.
 */
function getBobTaskId() {
  try {
    const raw = fs.readFileSync(BOB_TASK_FILE, "utf8").trim();
    return raw.length > 0 ? raw : "manual-commit";
  } catch {
    return "manual-commit";
  }
}

/**
 * Return the git user.name configured for this repo.
 * Falls back to 'unknown' when git config is unavailable.
 */
function getGitAuthor() {
  try {
    return execSync("git config user.name", { encoding: "utf8" }).trim() || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Return the current branch name.
 * Falls back to 'unknown' when HEAD is detached or git is unavailable.
 */
function getGitBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim() || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Return the SHA of the most-recent commit (i.e. the parent of the incoming
 * commit).  During pre-commit HEAD points to the previous commit — the new
 * SHA does not exist yet — so this is the best available identifier.
 * Falls back to 'pre-commit' when the repo has no commits yet.
 */
function getGitCommitSha() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim() || "pre-commit";
  } catch {
    return "pre-commit";
  }
}

/**
 * POST the audit payload to the BobGuard gateway.
 * Resolves with the parsed JSON response body.
 * Rejects when the HTTP request fails, times out, or returns a non-2xx status.
 */
function postToGateway(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);

    const options = {
      hostname: GATEWAY_HOST,
      port:     GATEWAY_PORT,
      path:     GATEWAY_PATH,
      method:   "POST",
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(
            new Error(`Gateway returned HTTP ${res.statusCode}: ${data}`)
          );
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Gateway returned non-JSON response: ${data}`));
        }
      });
    });

    // Circuit-breaker: fail open after TIMEOUT_MS
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy(new Error(`Gateway timed out after ${TIMEOUT_MS / 1000}s`));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log.info(`Intercepting commit in repo: ${c.bold}${REPO_NAME}${c.reset}`);

  // 1. Capture staged diff
  const diff = getGitStagedDiff();
  if (!diff) {
    log.warn("No staged changes detected — nothing to audit. Allowing commit.");
    process.exit(0);
  }
  log.info(`Staged diff captured (${diff.split("\n").length} lines).`);

  // 2. Read Bob Task ID
  const taskId = getBobTaskId();
  log.info(`Bob Task ID: ${c.bold}${taskId}${c.reset}`);

  // 3. Build payload
  const author    = getGitAuthor();
  const branch    = getGitBranch();
  const commitSha = getGitCommitSha();
  log.info(`Author: ${c.bold}${author}${c.reset}  Branch: ${c.bold}${branch}${c.reset}`);

  const payload = { repoName: REPO_NAME, diff, taskId, author, branch, commitSha };

  // 4. POST to gateway
  log.info(`Sending audit request to http://${GATEWAY_HOST}:${GATEWAY_PORT}${GATEWAY_PATH} ...`);

  let response;
  try {
    response = await postToGateway(payload);
  } catch (err) {
    // Gateway unreachable or timed out — fail open per policy
    log.warn(`Gateway unreachable: ${err.message}`);
    log.warn("Failing OPEN — commit is allowed. Governance audit was NOT performed.");
    process.exit(0);
  }

  // 5. Evaluate response
  if (response.allowCommit === true) {
    log.ok("Audit PASSED. Commit is approved by BobGuard.");
    if (response.auditId) {
      log.ok(`Audit record ID: ${c.bold}${response.auditId}${c.reset}`);
    }
    process.exit(0);
  } else {
    // Commit blocked
    log.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    log.error("  COMMIT BLOCKED by BobGuard AI Provenance Gateway");
    log.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (response.reason) {
      log.error(`Reason: ${response.reason}`);
    }

    if (Array.isArray(response.violations) && response.violations.length > 0) {
      log.error("Violations detected:");
      response.violations.forEach((v, i) => {
        console.error(
          `  ${c.red}${i + 1}.${c.reset} [${v.type || "unknown"}] ${v.message || v}`
        );
      });
    }

    if (response.remediationAvailable) {
      log.warn("Auto-remediation patch is available.");
      log.warn(`View it at: http://${GATEWAY_HOST}:${GATEWAY_PORT}/api/audit/records/${response.auditId}`);
    }

    log.error("Fix the violations and try again, or retrieve the remediation patch above.");
    process.exit(1);
  }
}

main();
