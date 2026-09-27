# BobGuard — AI-BOM & Code Provenance Gateway

BobGuard is a production-grade enterprise DevSecOps governance platform that intercepts Git commits, orchestrates IBM Bob 2.0 security subagents to analyse every code diff, enforces an enterprise policy ruleset, and persists a cryptographically signed **AI Bill of Materials (AI-BOM)** to MongoDB. A React dashboard visualises compliance metrics in real time.

---

## Architecture

```
mock-enterprise-target/           ← Intentionally vulnerable OWASP NodeGoat app
├── .git/hooks/pre-commit         ← Node.js interceptor (fires on every git commit)
└── .ai-policy.json               ← Enterprise governance ruleset

mern-auditor-platform/
├── backend/                      ← Express 4 + Mongoose 8 API (port 5000)
│   ├── server.js
│   ├── controllers/auditController.js   ← Three-subagent pipeline
│   ├── models/AuditRecord.js            ← Mongoose AI-BOM schema
│   ├── routes/auditRoutes.js            ← REST endpoints
│   ├── services/bobAgentService.js      ← Bob 2.0 remediation stub
│   └── config/policyLoader.js           ← Policy cache
└── frontend/                     ← Vite + React dashboard (port 5173)
    └── src/
        ├── api/auditApi.js
        ├── components/  (MetricCard, AuditTable, PatchViewer)
        └── pages/Dashboard.jsx
```

### Data flow

```
git commit  →  pre-commit hook  →  POST /api/audit/analyze
                                        ↓
                          SubagentA (License) ┐ parallel
                          SubagentB (Vulns)   ┘
                                        ↓ (if B fails)
                          SubagentC (Auto-remediation)
                                        ↓
                          SHA-256 provenance hash
                                        ↓
                          AuditRecord.create() → MongoDB
                                        ↓
                          { allowCommit, auditId, violations }
                                        ↓
                  blocked? → exit 1 (commit rejected)
                  passed?  → exit 0 (commit accepted)

React Dashboard  ←  polls /api/audit/stats + /api/audit/records  every 10 s
```

---

## Prerequisites

| Requirement | Minimum version | Notes |
|---|---|---|
| Node.js | 18 LTS | Required by both backend and frontend |
| npm | 9 | Bundled with Node 18 |
| MongoDB | 6 | Running locally on `localhost:27017` |
| Git | 2.x | Pre-commit hook uses `git diff --cached` |
| Docker (optional) | 24 | Easiest way to run MongoDB — see below |

---

## Installation

### 1 — Clone & enter the repo

```bash
git clone <repo-url>
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
# Edit .env if your MongoDB URI or port differs from the defaults
```

Default values in `.env.example`:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Express server port — must match the pre-commit hook |
| `MONGO_URI` | `mongodb://localhost:27017/bobguard` | MongoDB connection string |
| `POLICY_PATH` | `../../mock-enterprise-target/.ai-policy.json` | Path to the governance policy file |
| `CORS_ORIGIN` | `http://localhost:5173` | Vite dev server origin |

### 4 — Install frontend dependencies

```bash
cd ../../frontend
npm install
```

---

## Running MongoDB

### Option A — Docker (recommended)

```bash
docker run -d \
  --name bobguard-mongo \
  -p 27017:27017 \
  mongo:6
```

Stop / remove:

```bash
docker stop bobguard-mongo && docker rm bobguard-mongo
```

### Option B — Local MongoDB install

Ensure `mongod` is running and listening on `localhost:27017`. Refer to the [MongoDB installation guide](https://www.mongodb.com/docs/manual/installation/) for your OS.

---

## Starting the Platform

Open **two terminals**:

**Terminal 1 — Backend**

```bash
cd mern-auditor-platform/backend
npm run dev          # nodemon watches for changes
# OR
npm start            # plain node, no watch
```

Expected output:

```
[BobGuard] MongoDB connected → mongodb://localhost:27017/bobguard
[BobGuard] Gateway listening on http://localhost:5000
[BobGuard] Policy v1.0.0 active
[BobGuard] CORS origin: http://localhost:5173
```

**Terminal 2 — Frontend**

```bash
cd mern-auditor-platform/frontend
npm run dev
```

Expected output:

```
  VITE v8.x.x  ready in Xms

  ➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in a browser to see the Enterprise Command Center dashboard.

### Health check

```bash
curl http://localhost:5000/health
# → { "status": "ok", "policyVersion": "1.0.0", "mongoState": "connected" }
```

---

## Demo: Triggering a Blocked Commit

Follow the instructions in [`mock-enterprise-target/DEMO_VULN_CHANGE.md`](mock-enterprise-target/DEMO_VULN_CHANGE.md) for the exact step-by-step walkthrough.

**Quick summary:**

```bash
# 1. Add a hardcoded password to any route file inside mock-enterprise-target
echo '' >> mock-enterprise-target/app/routes/index.js
echo '// demo vuln' >> mock-enterprise-target/app/routes/index.js
echo "var adminPassword = 'admin123';" >> mock-enterprise-target/app/routes/index.js

# 2. Stage the change
git add mock-enterprise-target/app/routes/index.js

# 3. Attempt the commit — the pre-commit hook fires automatically
git commit -m "demo: trigger BobGuard block"
```

Expected terminal output (commit blocked):

```
[BobGuard] Analysing staged diff...
[BobGuard] ✗ COMMIT BLOCKED
  Violations:
    • Hardcoded Secrets (HIGH): adminPassword = 'admin123'
[BobGuard] Audit record saved → <auditId>
[BobGuard] Auto-remediation patch available. See dashboard for details.
```

The commit is **rejected** (exit code 1). Open the dashboard — within 10 seconds the new audit record appears in the Audit Log with a red BLOCKED badge and the violation details. Click the row to see the auto-remediation patch diff.

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
  "allowCommit":          true,
  "blocked":              false,
  "auditId":              "66f1a2b3c4d5e6f7a8b9c0d1",
  "violations":           [],
  "remediationAvailable": false,
  "licenseStatus":        { "passed": true, "compliant": true, ... },
  "securityStatus":       { "passed": true, "vulnerabilities": [], ... },
  "remediation":          null,
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
| `POLICY_PATH` | No | `../../mock-enterprise-target/.ai-policy.json` | Path to `.ai-policy.json` |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Comma-separated allowed origins |

---

## Deployment

### Backend → Northflank

The backend is containerised via the `Dockerfile` at the repo root.

#### Step 1 — Push env vars to MongoDB Atlas

Create a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster and copy the connection string. It will look like:

```
mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/bobguard?retryWrites=true&w=majority
```

#### Step 2 — Create a Northflank service

1. Go to **Northflank → New service → Combined (Build and deploy a Git repo)**
2. Connect your GitHub account and select **`AliAhmarAmeen/bob-provenance-gateway`**
3. Set branch to **`main`**
4. Under **Build options** choose **Dockerfile**
5. Set the following:

| Field | Value |
|---|---|
| **Build context** | `/` |
| **Dockerfile location** | `/Dockerfile` |

6. Under **Environment variables** add:

| Variable | Value |
|---|---|
| `PORT` | `5000` |
| `MONGO_URI` | Your Atlas connection string |
| `CORS_ORIGIN` | `https://bobguard.netlify.app` |

7. Under **Networking** expose port `5000` and enable a **public URL**.
8. Click **Create service** — Northflank builds the image and deploys it.
9. Copy the generated public URL (e.g. `https://bobguard-backend-xxxx.northflank.app`).

#### Step 3 — Wire the frontend to the live backend

In your **Netlify dashboard** for the frontend site:

1. Go to **Site configuration → Environment variables**
2. Add:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://<your-northflank-url>/api/audit` |

3. Trigger a new deploy (Deploys → **Trigger deploy → Deploy site**).

The frontend reads `VITE_API_URL` in [`src/api/auditApi.js`](mern-auditor-platform/frontend/src/api/auditApi.js) — once set, all API calls go to the live backend.

#### Step 4 — Verify

```bash
curl https://<your-northflank-url>/health
# → { "status": "ok", "policyVersion": "1.0.0", "mongoState": "connected" }
```

Then open your Netlify URL — the dashboard should load live data.

---

### Frontend → Netlify (already deployed)

Build settings for reference:

| Field | Value |
|---|---|
| **Base directory** | `mern-auditor-platform/frontend` |
| **Build command** | `npm run build` |
| **Publish directory** | `mern-auditor-platform/frontend/dist` |
| **Environment variable** | `VITE_API_URL=https://<northflank-url>/api/audit` |

---

## Project Scripts

| Directory | Script | Command | Description |
|---|---|---|---|
| `mern-auditor-platform/backend` | `npm start` | `node server.js` | Production start |
| `mern-auditor-platform/backend` | `npm run dev` | `nodemon server.js` | Dev start with file watch |
| `mern-auditor-platform/frontend` | `npm run dev` | `vite` | Dev server with HMR |
| `mern-auditor-platform/frontend` | `npm run build` | `vite build` | Production bundle → `dist/` |
| `mern-auditor-platform/frontend` | `npm run preview` | `vite preview` | Preview production bundle |

---

## Stretch Goals (out of scope for initial implementation)

- Real IBM Bob 2.0 CLI integration in `bobAgentService.js` via `child_process.execSync`
- AI provenance ratio based on Bob's actual `.bob/tasks/` execution log rather than diff line counting
- GitHub Actions CI workflow running BobGuard on every PR
- JWT authentication on the Express API
- WebSocket-based real-time dashboard updates
- PyPI / `pkg.go.dev` phantom dependency checking for Python and Go projects

---

## License

ISC
