# Dashboard Polish Plan — Sticky Header, Pagination UX, Professional Header & PDF Export

## Overview

This plan upgrades the BobGuard dashboard with four focused improvements:
1. **Sticky header** — the header bar remains visible at all times while scrolling
2. **Pagination clarity** — show "Showing 1–20 of N records" info row + a page-size selector
3. **Header visual upgrade** — enterprise-grade branding, live status dot, gradient accent line
4. **PDF Report Export** — download a formatted audit report as PDF, respecting the active date filter

New library required for PDF export: **`jspdf`** + **`jspdf-autotable`** (frontend-only, client-side generation — no backend changes needed).

---

## Sub-Task 1 — Sticky Header

**Status:** `[x] done`

### Intent
Make the dashboard header (`<header class="dashboard__header">`) stick to the top of the viewport as the user scrolls down through the metric cards, chart, and audit log table. This keeps the title, live-refresh indicator, and theme toggle always accessible.

### Expected Outcomes
- Header stays at the top of the viewport during scroll.
- A subtle background blur / shadow separates it visually from the content below.
- The header does not overlap content (correct top-padding added to the page body below it).
- Works in both dark and light themes.

### Todo List
1. Move `.dashboard__header` outside the `max-width` container so it spans the full viewport width, wrapping its inner content in a `dashboard__header-inner` div that respects the 1200px max-width.
2. In `index.css`, add `position: sticky; top: 0; z-index: 100;` to `.dashboard__header`, plus `backdrop-filter: blur(8px)` and a bottom box-shadow.
3. Add a semi-transparent background (`--bg` with opacity ~0.92) so content scrolling underneath doesn't bleed through.
4. Adjust `padding-top` on `.dashboard` to compensate for the sticky header height so no content is hidden underneath.

### Relevant Context
- **File:** `mern-auditor-platform/frontend/src/pages/Dashboard.jsx` — lines 104–118 (header JSX)
- **File:** `mern-auditor-platform/frontend/src/index.css` — lines 64–103 (`.dashboard__header`, `.dashboard__title`, `.dashboard__header-right`)
- Currently `.dashboard` has `padding: 1.5rem 1.25rem 3rem` and `max-width: 1200px; margin: 0 auto` — the header must span full width independently.

---

## Sub-Task 2 — Pagination "Showing X–Y of Z" Info Row + Page Size Selector

**Status:** `[x] done`

### Intent
Make pagination self-explanatory. A user must be able to see:
1. How many records are on the current page (e.g. "Showing 1–20 of 87 records")
2. How many records are shown per page, and optionally change it (10 / 20 / 50)

This information should live **between the filter bar and the table**, not buried below the table.

### Expected Outcomes
- A one-line info bar above `<AuditTable>` shows "Showing X–Y of Z records" on the left.
- A small "Per page: [10 | 20 | 50]" `<select>` appears in that same bar, right-aligned.
- When the user changes the page size, `page` resets to 0 and `pageSize` state updates.
- `PaginationBar` receives the updated `pageSize` so it recalculates `totalPages` correctly.
- The existing `PaginationBar` (Prev / page numbers / Next) below the table remains unchanged.

### Todo List
1. In `Dashboard.jsx`, change `PAGE_SIZE` from a module-level constant to a `pageSize` state variable (default 20).
2. Update `fetchRecords` call signature: add `pageSize` as a 4th argument; update `auditApi.js` to pass it as `limit` query param.
3. In `auditController.js` (backend), confirm `limit = parseInt(req.query.limit) || 20` is read (add it if missing) and used in `.limit(limit)` on the Mongoose query.
4. Add a `PaginationInfo` inline bar in `Dashboard.jsx` JSX just above `<AuditTable>` — renders the range text + page-size select.
5. Style `.pagination-info` in `index.css` — flex row, space-between, font-size 0.8rem, muted text left, select right.
6. Pass updated `pageSize` to `<PaginationBar>`.

### Relevant Context
- **File:** `mern-auditor-platform/frontend/src/pages/Dashboard.jsx` — line 27 `const PAGE_SIZE = 20`, lines 192–203 (table + pagination render)
- **File:** `mern-auditor-platform/frontend/src/api/auditApi.js` — `fetchRecords(page, dateFrom, dateTo)` — needs `pageSize`/`limit` as 4th argument
- **File:** `mern-auditor-platform/backend/controllers/auditController.js` — reads `req.query.page`; needs `req.query.limit`
- **File:** `mern-auditor-platform/frontend/src/components/PaginationBar.jsx` — already accepts `pageSize` prop; no component change needed

---

## Sub-Task 3 — Attractive Professional Header

**Status:** `[x] done`

### Intent
Elevate the header from a plain title bar into a polished enterprise-grade navigation band:
- A shield/logo badge as branding (inline SVG — no image files needed)
- Two-line title treatment: product name in bold + subtitle line
- Live status dot (pulsing green=live, amber=loading, red=error) replacing the plain poll-note text
- Compact record count badge/pill in the right cluster
- Gradient accent bottom border line for visual distinction

### Expected Outcomes
- Header is visually distinctive and communicates system status at a glance.
- The `⬡` hex icon is replaced with a small inline SVG shield icon.
- "BobGuard" is visually larger/bolder than the sub-label.
- The live status dot pulsates in `--ok` green when polling, `--warn` amber while loading, `--fail` red on error.
- Record count pill sits between the status dot and the theme toggle.
- Works in both light and dark themes via existing CSS variables.

### Todo List
1. Update the `<header>` JSX in `Dashboard.jsx`:
   - Replace `⬡` with a 20×20px inline `<svg>` shield shape.
   - Split title into `<span class="dashboard__brand">BobGuard</span>` and `<span class="dashboard__brand-sub">Enterprise Command Center</span>` stacked vertically.
   - Replace the plain `dashboard__poll-note` span with: a `<span class="status-dot status-dot--live|loading|error">` pulsing dot + a `<span class="record-pill">N records</span>`.
2. In `index.css`:
   - Style `.dashboard__brand` — large bold, solid `--accent` color (or subtle gradient via `background-clip: text`).
   - Style `.dashboard__brand-sub` — normal weight, `--muted`, slightly smaller.
   - Add `.status-dot` — 8px filled circle, transition colors, `@keyframes status-pulse` glow ring for live state.
   - Add `.record-pill` — compact pill, `--surface-2` background, `--muted` text, border `--border`.
   - Update `.dashboard__header` bottom border: use a `::after` pseudo-element with `background: linear-gradient(90deg, var(--accent), transparent)` for a fade-out accent line.

### Relevant Context
- **File:** `mern-auditor-platform/frontend/src/pages/Dashboard.jsx` — lines 104–118 (header JSX block)
- **File:** `mern-auditor-platform/frontend/src/index.css` — lines 64–121 (all header-related styles)
- `loading` and `error` state variables already exist in `Dashboard.jsx` and drive the status dot class.
- CSS variables `--ok`, `--warn`, `--fail`, `--accent` are already defined.

---

## Sub-Task 4 — PDF Report Export (Date-Filter Aware)

**Status:** `[x] done`

### Intent
Allow a user to download a well-formatted PDF audit report at any time. The report must reflect the **currently active date filter** — if the user has filtered to a date range, only those records appear in the PDF. The PDF is generated entirely on the frontend using `jspdf` + `jspdf-autotable` so no backend changes or new API endpoints are needed.

The PDF report contains two sections:
1. **Executive Summary** — the five dashboard KPI metrics (from the `stats` state already in memory)
2. **Audit Records Table** — all matching records for the selected date window (fetched in one request without pagination), rendered as a multi-page table

### Expected Outcomes
- A "Download Report PDF" button appears in the Audit Log section header (right-aligned, next to the section title).
- Clicking the button triggers a `generateReport()` function that:
  1. Calls the backend `GET /records` with `dateFrom`, `dateTo`, and `limit=9999` (fetch all, no pagination) to get the full filtered record set.
  2. Builds the PDF using `jspdf` + `jspdf-autotable`.
  3. Triggers a browser download of `bobguard-report-<dateFrom>-<dateTo>.pdf` (or `bobguard-report-all.pdf` when no filter is active).
- The button shows a loading/spinner state while the PDF is being generated to prevent double-clicks.
- If there are no records to export, the button is disabled with a tooltip.
- The PDF document includes:
  - **Header block**: "BobGuard Enterprise Audit Report", generation timestamp, date filter range (or "All records")
  - **Summary table**: 5 KPI rows — metric name, value, status (OK / WARN / FAIL / NEUTRAL)
  - **Records table**: columns — #, Date, Author, Branch, Commit SHA (truncated 8 chars), Repo, Violations (count), Status (PASS/FAIL)
  - **Footer**: page number "Page X of Y" on each page

### Todo List
1. Install `jspdf` and `jspdf-autotable` in the frontend:
   ```
   cd mern-auditor-platform/frontend
   npm install jspdf jspdf-autotable
   ```
2. Create a new helper file `mern-auditor-platform/frontend/src/utils/generateReport.js`:
   - Export an async function `generateReport({ stats, dateFrom, dateTo })`.
   - Inside: call `fetchRecords(0, dateFrom, dateTo, 9999)` to retrieve all records (no pagination cap).
   - Build the jsPDF document: add header text, summary autoTable, records autoTable, page footers.
   - Call `doc.save(filename)` to trigger browser download.
3. Add `[downloadingPdf, setDownloadingPdf]` state to `Dashboard.jsx`.
4. Import and wire up `generateReport` in `Dashboard.jsx` — add a "⬇ Download Report" button in the audit log section header.
5. Button should be `disabled` when `downloadingPdf === true` or `total === 0`; show "Generating…" label while in progress.
6. Style `.report-btn` in `index.css` — accent-bordered button, small size, sits inline with the section title.

### Relevant Context
- **File:** `mern-auditor-platform/frontend/src/pages/Dashboard.jsx` — `stats`, `dateFrom`, `dateTo`, `total` state vars are all available; lines 176–204 (audit log section)
- **File:** `mern-auditor-platform/frontend/src/api/auditApi.js` — `fetchRecords(page, dateFrom, dateTo, limit)` will be updated in Sub-Task 2; `limit=9999` will fetch all matching records
- **New file:** `mern-auditor-platform/frontend/src/utils/generateReport.js`
- **Record fields used in PDF table:** `createdAt`, `author`, `branch`, `commitSha`, `repoName`, `violations` (array length), `allowCommit` (boolean → PASS/FAIL)
- **Stats fields used in summary table:** `provenanceRatio`, `licenseContaminationIndex`, `vulnerabilityDensity`, `phantomPackagesDetected`, `tamperEvidenceState` + `totalRecords`
- `jspdf-autotable` handles multi-page table overflow and page footers automatically.
- Libraries: `jspdf` ~230 KB gzipped, `jspdf-autotable` ~50 KB — acceptable for an enterprise dashboard.

---

## Implementation Order

```
Sub-Task 1 (Sticky Header)
    ↓
Sub-Task 2 (Pagination Info + Page Size)   ← also prepares fetchRecords limit param needed by Sub-Task 4
    ↓
Sub-Task 3 (Header Redesign)               ← depends on header structure from Sub-Task 1
    ↓
Sub-Task 4 (PDF Export)                    ← depends on fetchRecords limit param from Sub-Task 2
```

Sub-tasks 1 and 2 can technically be done in parallel but sequential is safer. Sub-task 4 must run after Sub-task 2 because it depends on the `limit` param being added to `fetchRecords`.
