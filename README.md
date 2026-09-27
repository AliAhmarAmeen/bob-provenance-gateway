# BobGuard — AI-BOM & Code Provenance Gateway

BobGuard is a production-grade enterprise DevSecOps governance platform that intercepts Git commits, orchestrates IBM Bob 2.0 security subagents to analyse every code diff, enforces an enterprise policy ruleset, and persists a cryptographically signed **AI Bill of Materials (AI-BOM)** to MongoDB Atlas. A React dashboard visualises compliance metrics in real time.

---

## 🔴 Live URLs

| | URL |
|---|---|
| **Dashboard** | **<https://bobguard.netlify.app>** |
| **API health check** | <https://p01--bob-guard--sqklh22qqpms.code.run/health> |

The dashboard is connected to a live MongoDB Atlas database via the Northflank backend. Every audit record created — by any means — appears on the dashboard within 10 seconds.

---

## ⚡ Live Demo — No Setup Required

The entire audit pipeline runs on the live backend. You can trigger all four demo scenarios with a single `curl` command each — **no cloning, no `npm install`, no local server needed**.

Open **<https://bobguard.netlify.app>** in one browser tab, then run the commands below. Watch each new record appear on the dashboard in real time.

---

### Scenario 1 — License Contamination (BLOCKED)

A diff that adds a GPL-3.0 SPDX identifier — banned by the enterprise policy.

**Bash:**
```bash
curl -s -X POST https://p01--bob-guard--sqklh22qqpms.code.run/api/audit/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "diff": "+// SPDX-License-Identifier: GPL-3.0-only\n+function parseData(input) { return input.trim(); }\n+module.exports = { parseData };",
    "commitSha": "demo-1-license",
    "repoName": "NodeGoat",
    "author": "judge",
    "branch": "main",
    "taskId": "hackathon-demo"
  }'
```

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "https://p01--bob-guard--sqklh22qqpms.code.run/api/audit/analyze" `
  -Method Post -ContentType "application/json" `
  -Body (@{
    diff      = "+// SPDX-License-Identifier: GPL-3.0-only`n+function parseData(input) { return input.trim(); }`n+module.exports = { parseData };"
    commitSha = "demo-1-license"
    repoName  = "NodeGoat"
    author    = "judge"
    branch    = "main"
    taskId    = "hackathon-demo"
  } | ConvertTo-Json)
```

Expected: `"blocked": true` — `"License violation: Banned license identifiers found: GPL-3.0"`

---

### Scenario 2 — Phantom / Hallucinated Dependency (BLOCKED)

A diff that requires a package that does not exist on the npm registry — AI hallucination detection.

**Bash:**
```bash
curl -s -X POST https://p01--bob-guard--sqklh22qqpms.code.run/api/audit/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "diff": "+var compressor = require(\"mongo-image-fast-compress\");\n+module.exports = { compress: compressor.compress };",
    "commitSha": "demo-2-phantom",
    "repoName": "NodeGoat",
    "author": "judge",
    "branch": "main",
    "taskId": "hackathon-demo"
  }'
```

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "https://p01--bob-guard--sqklh22qqpms.code.run/api/audit/analyze" `
  -Method Post -ContentType "application/json" `
  -Body (@{
    diff      = "+var compressor = require(`"mongo-image-fast-compress`");`n+module.exports = { compress: compressor.compress };"
    commitSha = "demo-2-phantom"
    repoName  = "NodeGoat"
    author    = "judge"
    branch    = "main"
    taskId    = "hackathon-demo"
  } | ConvertTo-Json)
```

Expected: `"blocked": true` — `"Phantom package: \"mongo-image-fast-compress\" not found in npm registry"`

---

### Scenario 3 — NoSQL Injection + Hardcoded Secret + Auto-Remediation (BLOCKED)

A diff with two OWASP patterns simultaneously — triggers SubagentB detection and SubagentC auto-remediation patch generation.

**Bash:**
```bash
curl -s -X POST https://p01--bob-guard--sqklh22qqpms.code.run/api/audit/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "diff": "+var adminPassword = \"admin123\";\n+function findUser(req, db) {\n+  return db.users.find({ username: req.body.username });\n+}",
    "commitSha": "demo-3-vuln",
    "repoName": "NodeGoat",
    "author": "judge",
    "branch": "main",
    "taskId": "hackathon-demo"
  }'
```

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "https://p01--bob-guard--sqklh22qqpms.code.run/api/audit/analyze" `
  -Method Post -ContentType "application/json" `
  -Body (@{
    diff      = "+var adminPassword = `"admin123`";`n+function findUser(req, db) {`n+  return db.users.find({ username: req.body.username });`n+}"
    commitSha = "demo-3-vuln"
    repoName  = "NodeGoat"
    author    = "judge"
    branch    = "main"
    taskId    = "hackathon-demo"
  } | ConvertTo-Json)
```

Expected: `"blocked": true` — violations for both `Hardcoded Secrets` and `NoSQL Injection`, plus `"remediationAvailable": true`. Click the record row on the dashboard to view the auto-remediation patch diff.

---

### Scenario 4 — Clean Commit (PASSED)

A safe refactor — no violations, commit allowed, AI-BOM record still written for provenance tracking.

**Bash:**
```bash
curl -s -X POST https://p01--bob-guard--sqklh22qqpms.code.run/api/audit/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "diff": "+// refactor: extract date formatting helper\n+function formatDate(d) { return d.toISOString().split(\"T\")[0]; }\n+module.exports = { formatDate };",
    "commitSha": "demo-4-clean",
    "repoName": "NodeGoat",
    "author": "judge",
    "branch": "main",
    "taskId": "hackathon-demo"
  }'
```

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "https://p01--bob-guard--sqklh22qqpms.code.run/api/audit/analyze" `
  -Method Post -ContentType "application/json" `
  -Body (@{
    diff      = "+// refactor: extract date formatting helper`n+function formatDate(d) { return d.toISOString().split(`"T`")[0]; }`n+module.exports = { formatDate };"
    commitSha = "demo-4-clean"
    repoName  = "NodeGoat"
    author    = "judge"
    branch    = "main"
    taskId    = "hackathon-demo"
  } | ConvertTo-Json)
```

Expected: `"blocked": false`, `"allowCommit": true`, `"violations": []` — a green **PASS** record appears on the dashboard.

---

## Full Local Demo — Git Pre-Commit Hook (all 4 scenarios)

This path demonstrates the **git hook interception** — BobGuard blocking a real `git commit` at the developer's terminal before the code ever reaches the remote. All records still write to the same Atlas database and appear on the live dashboard.

### Prerequisites

- Node.js 18+, npm 9+, Git 2.x
- MongoDB Atlas URI **or** local MongoDB on `localhost:27017`
- Backend running: `cd mern-auditor-platform/backend && npm run dev`
- Frontend running: `cd mern-auditor-platform/frontend && npm run dev`
- The `mock-enterprise-target/` folder present (it is already in the repo)

### Setup — install the pre-commit hook

```bash
# From the repo root
cp hooks-source/pre-commit.js .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit        # macOS / Linux only
```

### The complete 4-scenario demo script (PowerShell)

```powershell
# === PREREQS: backend running on :5000, frontend on :5173 ===

# ── Scenario 1: License Contamination ────────────────────────────────────────
Set-Content "mock-enterprise-target/app/routes/gpl-util.js" @"
// SPDX-License-Identifier: GPL-3.0-only
function parseData(input) { return input.trim(); }
module.exports = { parseData };
"@ -Encoding UTF8
git add mock-enterprise-target/app/routes/gpl-util.js
git commit -m "demo-1: GPL license contamination"

# ── Scenario 2: Phantom Dependency ───────────────────────────────────────────
Set-Content "mock-enterprise-target/app/routes/image-util.js" @"
var compressor = require("mongo-image-fast-compress");
module.exports = { compress: compressor.compress };
"@ -Encoding UTF8
git add mock-enterprise-target/app/routes/image-util.js
git commit -m "demo-2: hallucinated npm package"

# ── Scenario 3: NoSQL Injection + Hardcoded Secret + Auto-Remediation ────────
Set-Content "mock-enterprise-target/app/routes/demo-vuln.js" @"
var adminPassword = "admin123";
function findUser(req, db) {
  return db.users.find({ username: req.body.username });
}
module.exports = { findUser };
"@ -Encoding UTF8
git add mock-enterprise-target/app/routes/demo-vuln.js
git commit -m "demo-3: NoSQL injection + hardcoded secret"

# ── Scenario 4: Clean Commit (PASS) ──────────────────────────────────────────
echo "" >> mock-enterprise-target/README.md
git add mock-enterprise-target/README.md
git commit -m "demo-4: clean commit — no violations"

# ── Cleanup ───────────────────────────────────────────────────────────────────
git restore --staged mock-enterprise-target/app/routes/gpl-util.js 2>$null
git restore --staged mock-enterprise-target/app/routes/image-util.js 2>$null
git restore --staged mock-enterprise-target/app/routes/demo-vuln.js 2>$null
Remove-Item mock-enterprise-target/app/routes/gpl-util.js -ErrorAction SilentlyContinue
Remove-Item mock-enterprise-target/app/routes/image-util.js -ErrorAction SilentlyContinue
Remove-Item mock-enterprise-target/app/routes/demo-vuln.js -ErrorAction SilentlyContinue
```

Scenarios 1–3 each produce a **blocked** commit (exit code 1). Scenario 4 produces a **passing** commit (exit code 0). Open the live dashboard — all four records appear within 10 seconds.

> For a detailed step-by-step walkthrough of Scenario 3 specifically, see [`mock-enterprise-target/DEMO_VULN_CHANGE.md`](mock-enterprise-target/DEMO_VULN_CHANGE.md).

---

## Architecture

```
mock-enterprise-target/           ← Intentionally vulnerable OWASP NodeGoat app
├── .git/hooks/pre-commit         ← Node.js interceptor (fires on every git commit)
└── .ai-policy.json               ← Enterprise governance ruleset (defines all patterns)

mern-auditor-platform/
├── backend/                      ← Express 4 + Mongoose 8 API
│   ├── server.js                 ← Entry point, CORS, MongoDB connect
│   ├── controllers/auditController.js   ← Three-subagent pipeline
│   ├── models/AuditRecord.js            ← Mongoose AI-BOM schema
│   ├── routes/auditRoutes.js            ← REST endpoints
│   ├── services/bobAgentService.js      ← Bob 2.0 remediation stub
│   └── config/policyLoader.js           ← Policy cache + AJV validation
└── frontend/                     ← Vite + React dashboard
    └── src/
        ├── api/auditApi.js              ← axios wrapper (reads VITE_API_URL)
        ├── components/  (MetricCard, AuditTable, PatchViewer)
        └── pages/Dashboard.jsx

Dockerfile                        ← Repo-root Dockerfile (build context = /)
hooks-source/pre-commit.js        ← Pre-commit hook source (copy to .git/hooks/)
```

### Data flow

```
git commit  →  pre-commit hook  →  POST /api/audit/analyze
  (or curl)                               ↓
                          SubagentA (License scan)  ┐ parallel
                          SubagentB (Vuln + Phantom)┘
                                          ↓ (if B flags violations)
                          SubagentC (Auto-remediation patch)
                                          ↓
                          SHA-256 provenance hash
                                          ↓
                          AuditRecord.create() → MongoDB Atlas
                                          ↓
                          { allowCommit, auditId, violations }
                                          ↓
                  blocked? → exit 1 (commit rejected by git hook)
                  passed?  → exit 0 (commit accepted)

React Dashboard  ←  polls /api/audit/stats + /api/audit/records  every 10 s
```

---

## Local Development Setup

### 1 — Clone & enter the repo

```bash
git clone https://github.com/AliAhmarAmeen/bob-provenance-gateway.git
cd ai-provenance-gateway
```

### 2 — Install backend dependencies

```bash
cd mern-auditor-platform/backend
npm install
```

### 3 — Create the backend `.env`

```bash
cp .env.example .env
# Edit .env — set MONGO_URI to your Atlas connection string or local MongoDB URI
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Express server port |
| `MONGO_URI` | `mongodb://localhost:27017/bobguard` | MongoDB connection string |
| `POLICY_PATH` | *(auto-resolved)* | Override path to `.ai-policy.json` |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins |

### 4 — Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 5 — Start both servers

**Terminal 1 — Backend**

```bash
cd mern-auditor-platform/backend
npm run dev
```

Expected output:
```
[BobGuard] MongoDB connected → mongodb://localhost:27017/bobguard
[BobGuard] Gateway listening on http://localhost:5000
[BobGuard] Policy v1.0.0 active
```

**Terminal 2 — Frontend**

```bash
cd mern-auditor-platform/frontend
npm run dev
# Open http://localhost:5173
```

### Health check

**Bash:**
```bash
curl http://localhost:5000/health
# → { "status": "ok", "policyVersion": "1.0.0", "mongoState": "connected" }
```

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/health"
# → status: ok  policyVersion: 1.0.0  mongoState: connected
```

---

## API Reference

All endpoints are prefixed with `/api/audit`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/analyze` | Run the three-subagent pipeline + persist AI-BOM record |
| `POST` | `/verify` | Alias used by the Git pre-commit hook |
| `GET` | `/records?page=N` | Paginated audit log (20 per page, newest first) |
| `GET` | `/records/:id` | Single audit record by MongoDB `_id` |
| `GET` | `/stats` | Pre-aggregated dashboard metrics (5 KPIs) |
| `GET` | `/health` | Server health + policy version + MongoDB state |

### `POST /api/audit/analyze` — request body

```json
{
  "diff":      "string — unified diff of staged changes",
  "commitSha": "string — Git SHA or 'pre-commit'",
  "repoName":  "string",
  "author":    "string",
  "branch":    "string",
  "taskId":    "string — Bob 2.0 task ID"
}
```

### `POST /api/audit/analyze` — response

```json
{
  "allowCommit":          false,
  "blocked":              true,
  "auditId":              "66f1a2b3c4d5e6f7a8b9c0d1",
  "violations":           ["Hardcoded Secrets (HIGH): adminPassword = \"admin123\""],
  "remediationAvailable": true,
  "licenseStatus":        { "passed": true, "compliant": true },
  "securityStatus":       { "passed": false, "vulnerabilities": [...], "hallucinatedPackages": [] },
  "remediation":          { "patchAvailable": true, "patch": "--- a/...\n+++ b/..." },
  "aiRatio":              { "humanLines": 2, "aiLines": 5, "totalLines": 12, "aiPercent": 42 },
  "sha256ProvenanceHash": "a3f2...64 hex chars"
}
```

### `GET /api/audit/stats` — response

```json
{
  "totalRecords":              14,
  "provenanceRatio":           38.5,
  "licenseContaminationIndex": 0,
  "vulnerabilityDensity":      1.25,
  "phantomPackagesDetected":   0,
  "tamperEvidenceState":       14
}
```

---

## Environment Variables (complete reference)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Express server port |
| `MONGO_URI` | No | `mongodb://localhost:27017/bobguard` | MongoDB connection string |
| `POLICY_PATH` | No | *(auto-resolved)* | Override path to `.ai-policy.json` |
| `CORS_ORIGIN` | No | `https://bobguard.netlify.app,http://localhost:5173` | Comma-separated allowed origins |

---

## Deployment

### Backend → Northflank (live)

The backend is containerised via the [`Dockerfile`](Dockerfile) at the repo root.

| Field | Value |
|---|---|
| **Build context** | `/` |
| **Dockerfile location** | `/Dockerfile` |
| `PORT` | `5000` |
| `MONGO_URI` | MongoDB Atlas connection string |
| `CORS_ORIGIN` | `https://bobguard.netlify.app` |

Expose port `5000` with a public URL under **Networking**.

### Frontend → Netlify (live)

| Field | Value |
|---|---|
| **Base directory** | `mern-auditor-platform/frontend` |
| **Build command** | `npm run build` |
| **Publish directory** | `mern-auditor-platform/frontend/dist` |
| `VITE_API_URL` | `https://p01--bob-guard--sqklh22qqpms.code.run/api/audit` |

After changing `VITE_API_URL`, trigger **"Clear cache and deploy site"** — Vite bakes env vars at build time.

---

## Project Scripts

| Directory | Script | Description |
|---|---|---|
| `mern-auditor-platform/backend` | `npm start` | Production start (`node server.js`) |
| `mern-auditor-platform/backend` | `npm run dev` | Dev start with file watch (nodemon) |
| `mern-auditor-platform/frontend` | `npm run dev` | Dev server with HMR (Vite) |
| `mern-auditor-platform/frontend` | `npm run build` | Production bundle → `dist/` |
| `mern-auditor-platform/frontend` | `npm run preview` | Preview production bundle locally |

---

## Stretch Goals

- Real IBM Bob 2.0 CLI integration in `bobAgentService.js` via `child_process.execSync`
- AI provenance ratio based on Bob's actual `.bob/tasks/` execution log rather than diff line counting
- GitHub Actions CI workflow running BobGuard on every PR
- JWT authentication on the Express API
- WebSocket-based real-time dashboard updates
- PyPI / `pkg.go.dev` phantom dependency checking for Python and Go projects

---

## License

ISC
