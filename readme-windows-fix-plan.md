# README.md — Windows PowerShell Demo Commands Fix

## Status: [ ] pending

---

## Top-Level Overview

The README's "⚡ Live Demo" section provides `curl` commands for all four demo scenarios. These commands use Unix/bash syntax (backslash `\` line continuation, single-quoted JSON with `\n` escape sequences) which **fail on Windows PowerShell** in two distinct ways:

1. `curl` in PowerShell is an alias for `Invoke-WebRequest` — it does not accept `-s`, `-X`, `-H`, or `-d` flags.
2. `curl.exe` with backtick continuations parses but single-quoted JSON `\n` is treated literally, causing a JSON parse error on the server.

The user confirmed that `Invoke-RestMethod` with a PowerShell hashtable + `ConvertTo-Json` works correctly.

**Confirmed design decisions:**
- Each scenario block shows **both** a `bash` and a `powershell` block, with labeled headers (`**Bash**` / `**PowerShell**`) immediately before each fence.
- The Windows Hoppscotch fallback note is **removed** entirely (PowerShell blocks make it redundant).
- Sub-Task 2 (local health-check fix) is **included**.

Scope: **README.md only**. No code changes.

---

## Sub-Task 1 — Add labeled PowerShell blocks for all four demo scenarios

**Intent**
Replace the bare bash-only curl blocks with a side-by-side labeled pattern: a `**Bash:**` header + existing fence, then a `**PowerShell:**` header + new `powershell` fence. Remove the existing Windows Hoppscotch fallback note (lines 110–114) entirely.

**Expected Outcomes**
- All four scenario sections each have two clearly labeled code blocks: `bash` (existing, now labeled) and `powershell` (new).
- The Windows Hoppscotch note is gone.
- Every PowerShell block uses `Invoke-RestMethod` with `-Body (@{...} | ConvertTo-Json)`.
- Diff newlines use PowerShell's `` `n `` escape inside double-quoted strings.

**Todo List**
- [ ] Scenario 1: add `**Bash:**` label before existing fence; add `**PowerShell:**` label + `powershell` fence after it (diff: `demo-1-license`)
- [ ] Scenario 2: same pattern (diff: `demo-2-phantom`)
- [ ] Scenario 3: same pattern (diff: `demo-3-vuln`)
- [ ] Scenario 4: same pattern (diff: `demo-4-clean`)
- [ ] Remove lines 110–114 (the Windows Hoppscotch fallback note block)

**Relevant Context**
- File: `README.md`
  - Scenario 1: lines 26–44
  - Scenario 2: lines 46–64
  - Scenario 3: lines 66–85
  - Scenario 4: lines 87–106
  - Hoppscotch note: lines 108–114 (fenced block-quote, delete entirely)

**PowerShell pattern (verified by user):**
```
Invoke-RestMethod -Uri "https://p01--bob-guard--sqklh22qqpms.code.run/api/audit/analyze" `
  -Method Post -ContentType "application/json" `
  -Body (@{
    diff      = "<diff string with `n for newlines>"
    commitSha = "<sha>"
    repoName  = "NodeGoat"
    author    = "judge"
    branch    = "main"
    taskId    = "hackathon-demo"
  } | ConvertTo-Json)
```

**Diff strings per scenario (double-quoted, `n for newlines):**

Scenario 1:
```
"+// SPDX-License-Identifier: GPL-3.0-only`n+function parseData(input) { return input.trim(); }`n+module.exports = { parseData };"
```

Scenario 2:
```
"+var compressor = require(`"mongo-image-fast-compress`");`n+module.exports = { compress: compressor.compress };"
```

Scenario 3:
```
"+var adminPassword = `"admin123`";`n+function findUser(req, db) {`n+  return db.users.find({ username: req.body.username });`n+}"
```

Scenario 4:
```
"+// refactor: extract date formatting helper`n+function formatDate(d) { return d.toISOString().split(`"T`")[0]; }`n+module.exports = { formatDate };"
```

**Status: [ ] pending**

---

## Sub-Task 2 — Fix the health-check curl command in "Local Development Setup"

**Intent**
The bare `curl http://localhost:5000/health` in the Local Development Setup section also fails on PowerShell. Add a labeled `**Bash:**` / `**PowerShell:**` pair there too.

**Expected Outcomes**
- The health check block shows both a `bash` and a `powershell` form with labels.
- PowerShell form: `Invoke-RestMethod -Uri "http://localhost:5000/health"` (one line — no body needed).

**Todo List**
- [ ] Add `**Bash:**` label before existing health check fence (line ~303)
- [ ] Insert `**PowerShell:**` label + `powershell` fence immediately after

**Relevant Context**
- File: `README.md` lines 300–306

**Status: [ ] pending**

---

## Notes for Implementation

- All PowerShell diff strings use **double-quoted** strings with `` `n `` for newlines and `` `" `` for embedded quotes (PowerShell escape sequences).
- The `Invoke-RestMethod` result pretty-prints automatically — no `-s` flag needed or applicable.
- Do NOT change the existing `bash` blocks — only add labels and new sibling blocks.
- The full-local-demo PowerShell script (lines 139–182) is already correct PowerShell and does not need changes.
- Remove the Hoppscotch note block completely — no replacement needed.
