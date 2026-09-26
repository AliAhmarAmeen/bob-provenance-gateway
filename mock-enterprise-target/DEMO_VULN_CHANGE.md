# BobGuard Demo — Triggering a Vulnerability Detection

This document gives the exact step-by-step instructions to trigger the BobGuard
security pipeline and see a **blocked commit** end-to-end.

## Prerequisites

1. MongoDB running on `localhost:27017` (see repo root `README.md` for Docker command).
2. BobGuard backend running: `cd mern-auditor-platform/backend && npm run dev`
3. BobGuard frontend running: `cd mern-auditor-platform/frontend && npm run dev`
4. Dashboard open at **http://localhost:5173**

---

## What BobGuard detects in this demo

The pre-commit hook sends the staged diff to `POST /api/audit/analyze`.
Subagent B applies two regex patterns from `.ai-policy.json`:

| Pattern | Triggers on |
|---|---|
| **Hardcoded Secrets** | `password\s*=\s*['"][^'"]+['"]` |
| **NoSQL Injection** | `req\.body\.\w+` used directly in a MongoDB query |

The demo adds a **new file** containing both patterns so the block is
unambiguous and does not interfere with the existing NodeGoat source.

---

## Step-by-step walkthrough

### Step 1 — Create the demo vulnerability file

From the **repo root** (`ai-provenance-gateway/`), run:

```bash
cat > mock-enterprise-target/app/routes/demo-vuln.js << 'EOF'
"use strict";
// BobGuard demo vulnerability file
// DO NOT leave this file committed — it is for demonstration only.

var mongoose = require("mongoose");

// VULN 1: Hardcoded Secret — triggers Subagent B "Hardcoded Secrets" pattern
var adminPassword = "admin123";

// VULN 2: NoSQL Injection — triggers Subagent B "NoSQL Injection" pattern
function findUser(req, db) {
  return db.users.find({ username: req.body.username });
}

module.exports = { findUser };
EOF
```

On **Windows PowerShell**, use this equivalent:

```powershell
$vuln = @"
"use strict";
// BobGuard demo vulnerability file
// DO NOT leave this file committed — it is for demonstration only.

var mongoose = require("mongoose");

// VULN 1: Hardcoded Secret
var adminPassword = "admin123";

// VULN 2: NoSQL Injection
function findUser(req, db) {
  return db.users.find({ username: req.body.username });
}

module.exports = { findUser };
"@
Set-Content -Path "mock-enterprise-target/app/routes/demo-vuln.js" -Value $vuln -Encoding UTF8
```

### Step 2 — Stage the file

```bash
git add mock-enterprise-target/app/routes/demo-vuln.js
```

Confirm it is staged:

```bash
git diff --cached --stat
# mock-enterprise-target/app/routes/demo-vuln.js | 15 +++++++++++++++
```

### Step 3 — Attempt the commit

```bash
git commit -m "demo: add vulnerable route to trigger BobGuard"
```

### Step 4 — Observe the terminal output

The pre-commit hook fires, calls the backend, and prints something like:

```
[BobGuard] Analysing staged diff (repo: ai-provenance-gateway, task: manual-commit)...

[BobGuard] ✗ COMMIT BLOCKED — 2 violation(s) detected
────────────────────────────────────────────────────────
  1. Hardcoded Secrets (HIGH): adminPassword = "admin123"
  2. NoSQL Injection   (HIGH): db.users.find({ username: req.body.username })
────────────────────────────────────────────────────────
[BobGuard] Auto-remediation patch available.
[BobGuard] Audit record: <MongoDB _id>

Tip: Run  npm run dev  in mern-auditor-platform/backend to start the gateway.
```

The `git commit` command **exits with code 1** — the commit is rejected.

### Step 5 — View the dashboard

Within 10 seconds (next polling interval), the dashboard at **http://localhost:5173**
shows the new record:

- **BLOCKED** badge (red) in the Audit Log
- Violations list expanded on row click
- Auto-remediation patch rendered as a syntax-highlighted unified diff

---

## Cleaning up after the demo

Remove the demo file and unstage:

```bash
git restore --staged mock-enterprise-target/app/routes/demo-vuln.js
rm mock-enterprise-target/app/routes/demo-vuln.js
# or on Windows PowerShell:
# Remove-Item mock-enterprise-target/app/routes/demo-vuln.js
```

---

## Trying a clean (passing) commit

To see a **PASS** flow, stage any non-vulnerable change — for example, updating
the NodeGoat README:

```bash
echo "" >> mock-enterprise-target/README.md
git add mock-enterprise-target/README.md
git commit -m "demo: clean commit — no violations"
```

Expected output:

```
[BobGuard] Analysing staged diff...
[BobGuard] ✓ COMMIT ALLOWED — no violations detected.
[BobGuard] Audit record: <MongoDB _id>
```

The commit proceeds normally and a green **PASS** record appears in the dashboard.

---

## Detected vulnerability patterns (reference)

These patterns are defined in `mock-enterprise-target/.ai-policy.json` under
`governance_rules.vulnerability_patterns`:

| Category | Example trigger |
|---|---|
| `nosql_injection` | `req.body.field` used directly in a Mongoose/MongoDB query |
| `hardcoded_secrets` | `password = "..."` or `secret = '...'` |
| `open_redirect` | `res.redirect(req.query.url)` without validation |
| `broken_auth` | Plain equality password comparison `=== user.password` |

Banned SPDX license identifiers (`compliance_rules.banned_licenses`):
`GPL-2.0`, `GPL-3.0`, `AGPL-3.0`, `LGPL-2.1`, `LGPL-3.0`
