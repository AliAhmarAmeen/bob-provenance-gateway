"use strict";

/**
 * BobGuard — Bob Agent Service
 *
 * Stub implementation of the IBM Bob 2.0 remediation integration.
 * This service is the single integration point for auto-remediation:
 * Sub-Task 4 calls it; the interface is stable so swapping in a real
 * Bob CLI invocation later requires no changes to auditController.js.
 *
 * Real integration path (stretch goal):
 *   // TODO: Replace stub with:
 *   //   const { execSync } = require('child_process');
 *   //   const inputFile = writeTempJson(violationContext);
 *   //   const patchFile = tmp.fileSync({ postfix: '.patch' }).name;
 *   //   execSync(`bob run --task remediate --input ${inputFile} --output ${patchFile}`);
 *   //   const patchContent = fs.readFileSync(patchFile, 'utf8');
 *   //   return { patchAvailable: true, patchContent: Buffer.from(patchContent).toString('base64') };
 */

// ─── Remediation templates ────────────────────────────────────────────────────
//
// Keyed by the exact vulnerability type string used in securityStatus.vulnerabilities.
// Each template is a deterministic unified diff patch (raw text) stored as a plain
// string; it is Base64-encoded at return time so the value survives JSON serialisation.

const REMEDIATION_TEMPLATES = {
  "NoSQL Injection": `--- a/allocations-dao.js
+++ b/allocations-dao.js
@@ -1,6 +1,8 @@
 // BobGuard auto-remediation patch: NoSQL Injection
-  var allocations = db.allocations.find({ userId: req.body.userId });
+  // Sanitise: coerce userId to a plain string, preventing operator injection
+  var safeUserId = JSON.stringify(req.body.userId).replace(/[^a-zA-Z0-9_-]/g, "");
+  var allocations = db.allocations.find({ userId: safeUserId });
`,

  "Hardcoded Secrets": `--- a/config/env/all.js
+++ b/config/env/all.js
@@ -1,5 +1,6 @@
 // BobGuard auto-remediation patch: Hardcoded Secrets
-  var password = "SuperSecretPass1";
+  // Move secrets to environment variables — never commit credentials
+  var password = process.env.APP_SECRET || (() => { throw new Error("APP_SECRET env var not set"); })();
`,

  "Open Redirect": `--- a/routes/index.js
+++ b/routes/index.js
@@ -1,5 +1,8 @@
 // BobGuard auto-remediation patch: Open Redirect
-  res.redirect(req.query.url);
+  // Whitelist-validate the redirect target before use
+  var ALLOWED_HOSTS = ["localhost", "example.com"];
+  var target = new URL(req.query.url, "http://localhost");
+  if (!ALLOWED_HOSTS.includes(target.hostname)) return res.status(400).json({ error: "Invalid redirect target" });
+  res.redirect(target.pathname + target.search);
`,

  "Broken Authentication": `--- a/models/user-dao.js
+++ b/models/user-dao.js
@@ -1,5 +1,6 @@
 // BobGuard auto-remediation patch: Broken Authentication
-  if (password === user.password) {
+  // Use bcrypt constant-time comparison instead of plain equality
+  if (require("bcrypt").compareSync(password, user.passwordHash)) {
`,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a simulated Bob 2.0 remediation task for the given violation context.
 *
 * @param {object} violationContext
 * @param {string} violationContext.vulnerabilityType  — e.g. "NoSQL Injection"
 * @param {string} violationContext.affectedFile       — relative file path
 * @param {number} [violationContext.affectedLine]     — line number, if known
 * @param {string} [violationContext.diffSnippet]      — the offending diff chunk
 *
 * @returns {{ patchAvailable: boolean, patchContent: string|null }}
 */
function runRemediationTask(violationContext) {
  const { vulnerabilityType } = violationContext;

  const rawPatch = REMEDIATION_TEMPLATES[vulnerabilityType];

  if (!rawPatch) {
    return { patchAvailable: false, patchContent: null };
  }

  // Encode as Base64 so the patch survives JSON serialisation in MongoDB
  const patchContent = Buffer.from(rawPatch, "utf8").toString("base64");

  return { patchAvailable: true, patchContent };
}

module.exports = { runRemediationTask };
