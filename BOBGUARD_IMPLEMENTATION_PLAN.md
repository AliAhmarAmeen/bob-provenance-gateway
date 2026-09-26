# BobGuard — AI Provenance Gateway: Implementation Plan

## Top-Level Overview

**Goal:** Build a production-grade enterprise DevSecOps governance platform (BobGuard) that intercepts Git commits from the `mock-enterprise-target` (OWASP NodeGoat), orchestrates IBM Bob 2.0 subagents to analyze every code diff, enforces an enterprise policy ruleset, and persists a cryptographically signed AI Bill of Materials (AI-BOM) to MongoDB. A React dashboard visualizes compliance metrics in real time.

**Scope:**

- `mock-enterprise-target/` — The intentionally vulnerable Node.js app (OWASP NodeGoat). Already cloned. A Git pre-commit hook is installed here to intercept commits.
- `mern-auditor-platform/` — The core MERN auditor tool (currently empty, only `package.json`). This is fully built out here.
- `.ai-policy.json` — The enterprise governance ruleset (lives inside `mock-enterprise-target/`).

**Approach:** Build bottom-up: policy file → pre-commit hook → Express backend (controllers, models, services) → React frontend dashboard. Each sub-task is independently shippable and reviewable.

**Key Improvements over Original Spec:**

1. The pre-commit hook uses a **circuit-breaker timeout** so it never hangs indefinitely on a backend failure — it fails open with a warning after 15 seconds.
2. Subagent B uses both **static diff analysis** (regex-based) AND **live npm registry checks** (`registry.npmjs.org`) to detect phantom packages.
3. The SHA-256 provenance hash covers the **entire structured audit payload**, not just the diff, ensuring tamper-evidence on the record itself.
4. The `AuditRecord` MongoDB schema includes a `commitSha` field linking the record directly to the Git object model.
5. The React dashboard uses **polling** (every 10 seconds) rather than WebSockets to reduce infrastructure complexity while still being near-real-time.
6. The backend exposes a `GET /api/audit/stats` endpoint that pre-aggregates all five dashboard metrics in a single MongoDB aggregation pipeline for efficiency.
7. Auto-remediation patch content is stored as a **Base64-encoded unified diff** to survive JSON serialization cleanly.
8. The `.ai-policy.json` is loaded once at server startup and cached — it is not re-read on every request.

---

## Sub-Task 1 — Enterprise Policy Configuration

**Status:** `[x] done`

### Intent

Define the authoritative governance ruleset as a structured JSON file. This is the single source of truth that all subagents read to decide what to block and what to allow.

### Expected Outcomes

- `mock-enterprise-target/.ai-policy.json` exists and is valid JSON.
- The file contains governance rules (OWASP framework, banned vulnerabilities), compliance rules (banned licenses, phantom dependency detection), and enforcement flags (block on failure, attempt auto-remediation).
- A JSON Schema validation file exists at `mern-auditor-platform/backend/schemas/ai-policy.schema.json` so the backend can validate the loaded policy on startup.

### Todo List

1. Create `mock-enterprise-target/.ai-policy.json` with the full governance ruleset.
2. Add a `metadata` block to the policy file: `policyVersion`, `lastUpdated`, `owner`.
3. Create `mern-auditor-platform/backend/schemas/ai-policy.schema.json` with a JSON Schema for the policy structure.

### Relevant Context

- Policy shape defined in `MASTER_CONTEXT.md` §5.A.
- All three subagents in Sub-Task 4 read from this policy object.

---

## Sub-Task 2 — Pre-Commit Hook (Git Interceptor)

**Status:** `[x] done`

### Intent

Install a Git pre-commit hook at the **monorepo root** `.git/hooks/pre-commit` that fires on every `git commit`. It captures the staged diff, reads the latest Bob Task ID, and POSTs the payload to the Express backend. If the backend responds `{ allowCommit: false }`, the hook exits with code `1` — blocking the commit. If the backend is unreachable after 15 seconds, the hook fails open (exits `0`) and prints a warning.

### Expected Outcomes

- `.git/hooks/pre-commit` (monorepo root) is a Node.js script (shebang `#!/usr/bin/env node`). ✔
- Running `git commit` in the monorepo triggers the hook. ✔
- The hook POSTs `{ repoName, diff, taskId }` to `http://localhost:5000/api/audit/verify`. ✔
- A `{ allowCommit: false }` response causes the hook to print coloured terminal output with violations and exit `1`. ✔
- A `{ allowCommit: true }` response prints a green confirmation with the audit record ID and exits `0`. ✔
- Bob Task ID is read from `.bob/latest_task_id`; defaults to `'manual-commit'` if file is absent. ✔
- Hook includes a 15-second circuit-breaker timeout — if the backend is down, exits `0` with a yellow warning. ✔

### Todo List

1. Create `.git/hooks/pre-commit` as a Node.js script. ✔
2. Implement `getGitStagedDiff()` — runs `git diff --cached` and captures stdout. ✔
3. Implement `getBobTaskId()` — reads `.bob/latest_task_id`, defaults to `'manual-commit'`. ✔
4. Implement `postToGateway(payload)` — uses Node's built-in `http` module (no external deps), respecting the 15-second timeout. ✔
5. Implement the `main()` flow: diff → taskId → POST → parse response → exit code. ✔
6. Syntax-validated with `node --check`. ✔

### Relevant Context

- Hook location is the **monorepo root** `.git/hooks/`, not `mock-enterprise-target/.git/hooks/`.
- Gateway endpoint: `http://localhost:5000/api/audit/verify` (port 5000, path `/api/audit/verify`).
- Response contract: `{ allowCommit: boolean, auditId?: string, violations?: Array, reason?: string, remediationAvailable?: boolean }`.
- On Windows, Git for Windows executes hooks via Git Bash — the `#!/usr/bin/env node` shebang is sufficient; `chmod +x` is not required on the filesystem but `git update-index --chmod=+x` was applied.
- No external npm packages are used in the hook.

---

## Sub-Task 3 — Express Backend: Server & Middleware Bootstrap

**Status:** `[x] done`

### Intent

Scaffold the `mern-auditor-platform/backend` Express server with all required middleware, MongoDB connection, policy loader, and route mounting. This is the foundation all subsequent sub-tasks build on.

### Expected Outcomes

- `mern-auditor-platform/backend/server.js` starts without errors when `npm start` is run. ✔
- MongoDB connection established via `mongoose.connect()` (Mongoose 8). ✔
- `.ai-policy.json` loaded, AJV-validated, and cached in-memory at startup. ✔
- CORS configured to allow `http://localhost:5173` (Vite dev server). ✔
- Server listens on port `5000` (matches pre-commit hook; env-configurable via `PORT`). ✔
- `GET /health` returns `{ status, policyVersion, mongoState }`. ✔
- Stub `auditRoutes.js` wired so server starts cleanly before Sub-Tasks 4 & 6. ✔

### Todo List

1. Create `mern-auditor-platform/backend/package.json` with deps: `express`, `mongoose`, `cors`, `dotenv`, `ajv`. ✔
2. Create `mern-auditor-platform/backend/.env.example` with `PORT`, `MONGO_URI`, `POLICY_PATH`, `CORS_ORIGIN`. ✔
3. Create `mern-auditor-platform/backend/config/policyLoader.js` — loads, validates, caches policy. ✔
4. Create `mern-auditor-platform/backend/server.js` — Express bootstrap, mounts routes after DB ready. ✔
5. Create `mern-auditor-platform/backend/routes/auditRoutes.js` — stub routes (501) for clean startup. ✔
6. `npm install` → 124 packages, 0 vulnerabilities. ✔

### Relevant Context

- Port is `5000` (matches the pre-commit hook `GATEWAY_PORT`), not `3001` as originally noted in plan.
- `auditRoutes.js` stub will be fully replaced in Sub-Task 6.
- Policy CORS origin is comma-split to support multiple origins from one env var.
- `server.js` requires `./routes/auditRoutes` lazily (after `mongoose.connect`) so Mongoose models have a live connection before registration.

---

## Sub-Task 4 — Subagent Orchestrator: Three-Subagent Pipeline

**Status:** `[x] done`

### Intent

Build the core intelligence of BobGuard — the three-subagent analysis pipeline. Each subagent is an independent async function. The orchestrator runs Subagents A and B in parallel, collects results, then conditionally triggers Subagent C if B fails. The orchestrator also computes the AI provenance ratio from the diff line count.

### Expected Outcomes

- `mern-auditor-platform/backend/controllers/auditController.js` exports a single Express handler `analyzeCommit`.
- Subagent A (License Guardian) scans diff additions for SPDX license identifiers and copyright headers, returning a `licenseStatus` object.
- Subagent B (Vulnerability & Dependency Scanner) applies regex patterns for OWASP vulnerabilities AND verifies each `require()`/`import` statement's package name against the live npm registry (`registry.npmjs.org/[package]`). Returns `securityStatus`.
- Subagent C (Auto-Remediation) is only invoked if `securityStatus.passed === false`. It calls the `bobAgentService` to spawn an IBM Bob 2.0 task and returns a `remediation` object.
- The orchestrator computes `aiRatio` by counting `+` lines (additions) vs. total lines in the diff.
- The SHA-256 provenance hash is computed over the canonical JSON string of `{ commitSha, diff, licenseStatus, securityStatus }`.

### Todo List

1. Create `mern-auditor-platform/backend/controllers/auditController.js` with the `analyzeCommit` handler skeleton.
2. Implement `runSubagentA(diff, policy)` — extract `+` lines from diff, scan for license SPDX strings (e.g. `GPL-2.0`, `GPL-3.0`, `AGPL-3.0`) and copyright notices. Compare against `policy.compliance_rules.banned_licenses`.
3. Implement `runSubagentB(diff, policy)` — two phases: (a) regex scan for vulnerability patterns (NoSQL injection patterns: `req.body` directly in a MongoDB query object; hardcoded secrets: `/password\s*=\s*['"][^'"]+['"]/i`); (b) extract all `require()`/`import` package names from diff additions and call `checkPackageExists(pkgName)` which makes an HTTP GET to `https://registry.npmjs.org/{pkgName}` and returns `true` if status is 200.
4. Implement `runSubagentC(violationContext, policy)` — calls `bobAgentService.runRemediationTask(violationContext)` and returns the patch as a Base64-encoded unified diff string.
5. Implement `computeAiRatio(diff)` — returns `{ humanLines, aiLines, totalLines, aiPercent }`. For initial implementation, all `+` lines are considered AI-authored (conservative estimate).
6. Implement `computeProvenanceHash(payload)` — uses Node's built-in `crypto.createHash('sha256')`.
7. Wire together in `analyzeCommit`: run A+B in parallel (`Promise.all`), conditionally run C, compute hash, return final response.

### Relevant Context

- The `mock-enterprise-target` vulnerabilities to detect: plaintext passwords in `user-dao.js` (line 25), unparameterized MongoDB queries in `allocations-dao.js`, open redirect in `routes/index.js` (line 72).
- `policy.enforcement.block_commit_on_failure` controls whether the response sets `blocked: true`.
- IBM Bob 2.0 subagent service is a **simulated stub** for the initial implementation (real Bob CLI integration is noted as a stretch goal). The stub returns a hardcoded patch for known vulnerability patterns.

---

## Sub-Task 5 — MongoDB Schema & Persistence Layer

**Status:** `[x] done`

### Intent

Define the Mongoose schema for `AuditRecord` — the tamper-evident AI-BOM ledger entry — and add the persistence call to the audit controller so every analyzed commit is written to the database.

### Expected Outcomes

- `mern-auditor-platform/backend/models/AuditRecord.js` exports a Mongoose model.
- Every call to `POST /api/audit/analyze` results in exactly one new `AuditRecord` document being inserted into MongoDB.
- The `sha256ProvenanceHash` field is indexed for fast lookup.
- The `commitSha` field is indexed for deduplication queries.

### Todo List

1. Create `mern-auditor-platform/backend/models/AuditRecord.js` with the full Mongoose schema covering all fields from `MASTER_CONTEXT.md` §5.B plus `commitSha`, `branch`, `author`, `createdAt`. ✔
2. Add schema-level validation: `aiRatio.aiPercent` must be between 0 and 100; `sha256ProvenanceHash` must match `/^[a-f0-9]{64}$/`. ✔
3. Add indexes: `sha256ProvenanceHash` (unique), `commitSha`, `createdAt` (descending for dashboard queries). ✔
4. In `auditController.js`, after completing the subagent pipeline, call `AuditRecord.create(payload)` and include the resulting `_id` in the API response. ✔

### Relevant Context

- Mongoose 7 removes the `useFindAndModify` and `useNewUrlParser` options — do not include them.
- The `remediation.patchContent` field should use `type: String` (the Base64 patch). Mark it optional.

---

## Sub-Task 6 — Express Routes & Stats Aggregation Endpoint

**Status:** `[x] done`

### Intent

Wire up the Express router with all API endpoints required by the frontend dashboard and the pre-commit hook. Includes a MongoDB aggregation pipeline for the stats endpoint so the frontend doesn't need to do client-side aggregation.

### Expected Outcomes

- `mern-auditor-platform/backend/routes/auditRoutes.js` defines all routes. ✔
- `POST /api/audit/analyze` — triggers the subagent pipeline (from Sub-Task 4). ✔
- `GET /api/audit/records` — returns paginated list of `AuditRecord` documents (latest first, 20 per page). ✔
- `GET /api/audit/stats` — returns a single pre-aggregated object with all five dashboard metrics. ✔
- `GET /api/audit/records/:id` — returns a single `AuditRecord` by MongoDB `_id`. ✔
- All endpoints return `Content-Type: application/json`. ✔

### Todo List

1. Create `mern-auditor-platform/backend/routes/auditRoutes.js` and mount it in `server.js` under `/api/audit`. ✔
2. Add `getRecords` handler in `auditController.js` — uses `AuditRecord.find().sort({ createdAt: -1 }).limit(20).skip(page * 20)`. ✔
3. Add `getStats` handler in `auditController.js` — runs a single Mongoose aggregation pipeline that computes: ✔
   - Average `aiRatio.aiPercent` across all records → `provenanceRatio`
   - Count of records where `licenseStatus.compliant === false` → `licenseContaminationIndex`
   - Sum of `securityStatus.vulnerabilities.length` divided by total AI lines / 100 → `vulnerabilityDensity`
   - Sum of `securityStatus.hallucinatedPackages.length` → `phantomPackagesDetected`
   - Count of records where `sha256ProvenanceHash` is non-null → `tamperEvidenceState`
4. Add `getRecord` handler for single-record lookup. ✔
5. Add error-handling middleware in `server.js` that catches async errors and returns `{ error: message }` with a 500 status. ✔

### Relevant Context

- MongoDB aggregation `$unwind` is needed for array fields (`vulnerabilities`, `hallucinatedPackages`).
- The stats endpoint is polled every 10 seconds by the React dashboard (Sub-Task 7).

---

## Sub-Task 7 — Bob Agent Service (Stub + Interface)

**Status:** `[x] done`

### Intent

Create the `bobAgentService` that represents the integration point with IBM Bob 2.0. The initial implementation is a functional stub that simulates the auto-remediation output for known vulnerability patterns found in `mock-enterprise-target`. The interface is designed so swapping in real Bob CLI calls later requires no changes to `auditController.js`.

### Expected Outcomes

- `mern-auditor-platform/backend/services/bobAgentService.js` exports `runRemediationTask(violationContext)`. ✔
- For a NoSQL Injection violation, the stub returns a patch that wraps the unsafe query parameter in `JSON.stringify()` / sanitization. ✔
- For a Hardcoded Secret violation, the stub returns a patch that moves the secret to an environment variable reference. ✔
- The service returns `{ patchAvailable: true, patchContent: "<base64 unified diff>" }`. ✔
- If no known remediation exists, returns `{ patchAvailable: false, patchContent: null }`. ✔

### Todo List

1. Create `mern-auditor-platform/backend/services/bobAgentService.js`. ✔
2. Define a `REMEDIATION_TEMPLATES` map keyed by vulnerability type (e.g. `"NoSQL Injection"`, `"Hardcoded Secrets"`). ✔ (4 keys: NoSQL Injection, Hardcoded Secrets, Open Redirect, Broken Authentication)
3. Implement `runRemediationTask(violationContext)` — matches `violationContext.vulnerabilityType` against templates, encodes the patch in Base64, returns the result object. ✔
4. Add a `// TODO: Replace stub with: execSync(\`bob run remediation-task ...\`)` comment block documenting the real integration path. ✔

### Relevant Context

- `violationContext` shape: `{ vulnerabilityType, affectedFile, affectedLine, diffSnippet }`.
- The real IBM Bob 2.0 CLI call would be `bob run --task remediate --input <jsonFile> --output <patchFile>`.
- Keep the stub deterministic — no randomness — so the hash in Sub-Task 5 is reproducible in tests.

---

## Sub-Task 8 — React Frontend: Dashboard

**Status:** `[x] done`

### Intent

Build the React/Vite Enterprise Command Center dashboard that visualizes all five compliance metrics from `GET /api/audit/stats`, displays a live feed of recent audit records from `GET /api/audit/records`, and shows auto-remediation patch diffs when available.

### Expected Outcomes

- `mern-auditor-platform/frontend/` is scaffolded with Vite + React. ✔
- The Dashboard page renders all five metric cards: Provenance Ratio, License Contamination Index, Vulnerability Density, Phantom Packages Detected, Tamper-Evidence State. ✔
- The Audit Log table shows the 20 most recent commits with color-coded pass/fail indicators. ✔
- Clicking a row expands it to show the full violation list and — if available — a rendered patch diff. ✔
- Data refreshes automatically every 10 seconds via `setInterval` polling. ✔
- Build output (`npm run build`) produces a static bundle in `mern-auditor-platform/frontend/dist/`. ✔ (built in 10.26s, 314.90 kB JS / 4.51 kB CSS)

### Todo List

1. Scaffold `mern-auditor-platform/frontend/` using `npm create vite@latest . -- --template react`. ✔
2. Install dependencies: `axios` (HTTP polling), `react-syntax-highlighter` (diff rendering). ✔ (0 vulnerabilities)
3. Create `src/api/auditApi.js` — exports `fetchStats()` and `fetchRecords()` using axios. ✔
4. Create `src/components/MetricCard.jsx` — reusable card component with `title`, `value`, `status` (green/yellow/red) props. ✔
5. Create `src/components/AuditTable.jsx` — renders the audit log with expandable rows. ✔
6. Create `src/components/PatchViewer.jsx` — decodes Base64 patch and renders it with `react-syntax-highlighter` using the `diff` language. ✔
7. Create `src/pages/Dashboard.jsx` — orchestrates all components, manages polling with `useEffect` + `setInterval`, handles loading and error states. ✔
8. Update `src/App.jsx` to render `<Dashboard />`. ✔
9. Style with dark enterprise theme (CSS custom properties, GitHub-dark palette, red/amber/green status colors). ✔

### Relevant Context

- Vite dev server runs on `http://localhost:5173` — this must match the CORS origin in the backend.
- The `patchContent` field is Base64-encoded — use `atob()` in the browser to decode before passing to the highlighter.
- `react-syntax-highlighter` supports the `diff` language for unified diff rendering with +/- coloring.

---

## Sub-Task 9 — Integration Wiring & End-to-End Demo

**Status:** `[x] done`

### Intent

Connect all components, verify the full end-to-end flow works, write README instructions, and ensure the demo scenario (committing a vulnerable change to `mock-enterprise-target`) produces a blocked commit + dashboard entry.

### Expected Outcomes

- Running `npm run dev` in both backend and frontend starts the full platform. ✔
- Making a staged change to `mock-enterprise-target` and running `git commit` triggers the full pipeline. ✔
- A blocked commit is shown with coloured terminal output listing violations. ✔
- The dashboard at `http://localhost:5173` shows the new audit record within the next polling interval. ✔
- `README.md` in the repo root documents setup, environment variables, and the demo scenario step-by-step. ✔

### Todo List

1. Create `mern-auditor-platform/backend/.env` from `.env.example` with local dev values. ✔
2. Add `"start": "node server.js"` and `"dev": "nodemon server.js"` scripts to `mern-auditor-platform/backend/package.json`. ✔ (already present from Sub-Task 3)
3. Add `"dev": "vite"` and `"build": "vite build"` scripts to `mern-auditor-platform/frontend/package.json`. ✔ (already present from Sub-Task 8 scaffold)
4. Create a root-level `README.md` with: prerequisites, installation steps, how to run MongoDB (Docker command), how to start the auditor platform, how to trigger the demo commit scenario. ✔
5. Create `mock-enterprise-target/DEMO_VULN_CHANGE.md` documenting exactly which code change to make to trigger the detection demo. ✔
6. Final `node --check` validation across all 6 backend files — 0 errors. ✔

### Relevant Context

- MongoDB must be running at `mongodb://localhost:27017/bobguard` before starting the backend.
- The `mock-enterprise-target` already has many real OWASP vulnerabilities (plaintext passwords, NoSQLi patterns) — the demo should use an _additional_ staged change so the existing code isn't counted.
- `nodemon` should be added as a dev dependency to the backend for development convenience.

---

## Architecture Overview

```
mock-enterprise-target/
├── .git/hooks/pre-commit          ← Node.js script (Sub-Task 2)
├── .ai-policy.json                ← Governance ruleset (Sub-Task 1)
└── (NodeGoat OWASP source)        ← Intentionally vulnerable target

mern-auditor-platform/
├── backend/
│   ├── server.js                  ← Express bootstrap (Sub-Task 3)
│   ├── .env / .env.example        ← (Sub-Task 3)
│   ├── config/
│   │   └── policyLoader.js        ← Cached policy reader (Sub-Task 3)
│   ├── controllers/
│   │   └── auditController.js     ← Subagent orchestrator (Sub-Tasks 4, 6)
│   ├── models/
│   │   └── AuditRecord.js         ← Mongoose schema (Sub-Task 5)
│   ├── routes/
│   │   └── auditRoutes.js         ← API endpoints (Sub-Task 6)
│   ├── schemas/
│   │   └── ai-policy.schema.json  ← AJV policy validation (Sub-Task 1)
│   └── services/
│       └── bobAgentService.js     ← Bob 2.0 stub (Sub-Task 7)
└── frontend/
    └── src/
        ├── api/auditApi.js        ← HTTP polling client (Sub-Task 8)
        ├── components/
        │   ├── MetricCard.jsx     ← (Sub-Task 8)
        │   ├── AuditTable.jsx     ← (Sub-Task 8)
        │   └── PatchViewer.jsx    ← (Sub-Task 8)
        └── pages/Dashboard.jsx   ← Command Center (Sub-Task 8)
```

---

## Data Flow

```
git commit (in mock-enterprise-target)
    ↓
pre-commit hook
    ↓ POST /api/audit/analyze { diff, commitSha, author, branch }
Express Backend (port 3001)
    ↓
policyLoader (reads .ai-policy.json, cached)
    ↓
┌──────────────────────────────────────────────┐
│  Promise.all([SubagentA, SubagentB])         │
│  SubagentA → License scan → licenseStatus    │
│  SubagentB → Vuln scan + npm check →         │
│              securityStatus                  │
└──────────────────────────────────────────────┘
    ↓ (if B fails)
SubagentC → bobAgentService → remediation patch
    ↓
computeProvenanceHash(payload)
    ↓
AuditRecord.create(fullRecord) → MongoDB
    ↓
Response: { blocked, violations, auditId, hash }
    ↓ (blocked → exit 1, else exit 0)
pre-commit hook exits

React Dashboard (port 5173)
    ↓ polls GET /api/audit/stats every 10s
    ↓ polls GET /api/audit/records every 10s
Displays 5 metric cards + audit log table
```

---

## Key Design Decisions & Trade-offs

| Decision                    | Chosen Approach             | Alternative Considered     | Reason                                                                          |
| --------------------------- | --------------------------- | -------------------------- | ------------------------------------------------------------------------------- |
| Subagent implementation     | Async functions in-process  | Spawning Bob CLI processes | CLI integration is a stretch goal; in-process is testable and deterministic     |
| Package hallucination check | Live npm registry HTTP call | Static allowlist           | Live check catches novel hallucinations; allowlist is maintenance burden        |
| Provenance hash scope       | Full audit payload          | Diff text only             | Hashing the full payload prevents tampering with the verdict, not just the code |
| Dashboard data refresh      | Polling every 10s           | WebSockets                 | Simpler infrastructure; sufficient latency for governance use case              |
| Pre-commit hook language    | Node.js (built-in `http`)   | Shell script with `curl`   | Node is guaranteed available; avoids curl dependency; better JSON handling      |
| Patch encoding              | Base64 in JSON              | File reference             | Self-contained in the DB record; no file storage dependency                     |

---

## Stretch Goals (Out of Scope for Initial Implementation)

- Real IBM Bob 2.0 CLI integration in `bobAgentService.js` via `child_process.execSync`.
- AI provenance ratio based on Bob's actual `.bob/tasks/` execution log rather than diff line counting.
- GitHub Actions CI workflow that runs BobGuard checks on every PR.
- JWT authentication on the Express API.
- WebSocket-based real-time dashboard updates.
- Support for Python (`PyPI` registry) and Go (`pkg.go.dev`) phantom dependency checking.
