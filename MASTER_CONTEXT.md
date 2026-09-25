# MASTER PROJECT SPECIFICATION: BobGuard (AI-BOM & Code Provenance Gateway)

## 1. Executive Summary

BobGuard is an enterprise DevSecOps governance platform that creates a wrapper around AI coding agents (specifically IBM Bob 2.0). It solves the "Shadow AI" problem by intercepting local Git commits, analyzing AI code provenance, enforcing corporate compliance policies via parallel subagents, and generating a tamper-evident AI Bill of Materials (AI-BOM).

It features automated IP license scanning, security vulnerability detection, and a 1-click auto-remediation engine to fix AI-generated flaws before they reach production.

## 2. Real-World Enterprise Use Cases

This tool is built to solve four critical corporate crises:

- **IP Protection (License Contamination):** If an AI generates code containing GPL-3.0 licensed snippets, merging it could force the company to open-source their proprietary software. BobGuard detects restrictive licenses in the git diff and blocks the commit.
- **Supply Chain Defense (Phantom Dependencies):** AI models frequently hallucinate npm/PyPI packages (e.g., `mongo-image-fast-compress`). BobGuard verifies all AI-generated imports against live package registries, blocking the commit if a hallucinated package is detected to prevent slopsquatting malware attacks.
- **"Shift-Left" Auto-Remediation:** If an AI introduces a NoSQL Injection vulnerability, BobGuard does not just block the commit; it spawns an Auto-Remediation subagent to generate a secure patch, maintaining developer velocity.
- **Executive Auditing & Compliance:** Provides a cryptographically signed AI-BOM report proving exactly what percentage of a codebase was written by AI and verifying it passed all governance checks (essential for incoming AI regulations).

## 3. System Architecture & Directory Structure

The repository is a Monorepo containing a vulnerable test application and the auditor platform.

ai-provenance-gateway/ (Root Submission Repo)
├── mock-enterprise-target/ # The vulnerable sandbox application (e.g., NodeGoat)
│ ├── .git/hooks/pre-commit # Node.js script that intercepts the commit
│ ├── .bob/tasks/ # Bob's native execution history logs
│ ├── .ai-policy.json # The Enterprise Policy ruleset
│ └── (Target source code files)
│
└── mern-auditor-platform/ # The Core Auditing Tool
├── backend/ # Node.js / Express
│ ├── server.js  
 │ ├── controllers/auditController.js # Subagent orchestrator & hash engine
│ ├── models/AuditRecord.js # MongoDB Schema for AI-BOM
│ └── services/bobAgentService.js # Executes Bob CLI in the background
└── frontend/ # React / Vite Dashboard
└── src/pages/Dashboard.jsx # Visualizes metrics and patches

## 4. Subagent Orchestration Workflow

When a developer runs `git commit`, the pre-commit hook pauses the execution and POSTs the code diff to the Express backend. The backend reads `.ai-policy.json` and spins up IBM Bob 2.0 subagents in the background:

- **Subagent A (License Guardian):** Scans the code additions for open-source license signatures matching restricted licenses defined in the policy.
- **Subagent B (Vulnerability & Dependency Scanner):** Evaluates the diff for OWASP vulnerabilities (SQLi/NoSQLi, hardcoded secrets) and verifies whether imported npm packages actually exist.
- **Subagent C (Auto-Remediation Engine):** Triggered only if Subagent B fails. It consumes the violation context and generates a minimal, secure git diff patch for 1-click remediation.

## 5. Enterprise Data Contracts & Schemas

### A. The Policy Configuration (`.ai-policy.json`)

{
"governance_rules": {
"security_framework": "OWASP_Top_10",
"banned_vulnerabilities": ["NoSQL Injection", "Hardcoded Secrets", "Broken Authentication"]
},
"compliance_rules": {
"banned_licenses": ["GPL-2.0", "GPL-3.0", "AGPL-3.0"],
"block_on_hallucinated_deps": true
},
"enforcement": {
"block_commit_on_failure": true,
"attempt_auto_remediation": true
}
}

### B. MongoDB Ledger (`AuditRecord.js`)

- `taskId`: String (Links back to Bob's local execution log)
- `aiRatio`: { humanLines: Number, aiLines: Number }
- `sha256ProvenanceHash`: String (Cryptographic seal of the AI-generated block to ensure tamper-evidence)
- `licenseStatus`: { compliant: Boolean, flaggedLicenses: [String] }
- `securityStatus`: { passed: Boolean, vulnerabilities: Array, hallucinatedPackages: Array }
- `remediation`: { patchAvailable: Boolean, patchContent: String }

## 6. Dashboard Metrics to Display (Frontend)

The React frontend must act as the Enterprise Command Center, tracking:

1.  **Provenance Ratio:** Percentage breakdown of Human vs. AI code ownership.
2.  **License Contamination Index:** Flagging any viral copyleft code detected.
3.  **Vulnerability Density:** Security flaws introduced per 100 lines of AI code.
4.  **Phantom Packages Detected:** Number of AI-hallucinated dependencies caught.
5.  **Tamper-Evidence State:** The SHA-256 validation verifying developers did not manually alter AI code after the audit.

## 7. Execution Context for Bob 2.0

Bob should use **Plan Mode** to read this document and generate a comprehensive, step-by-step implementation plan for the `mern-auditor-platform` backend, the `.ai-policy.json` rules, and the Node.js pre-commit hook. Plan mode is optimal here because it allows Bob to think through the architecture, system design, and technical specifications before switching into Agent mode to implement the code. Once the plan is approved, Bob's mid-task switching feature will autonomously transition it into Agent mode when the implementation phase begins.
