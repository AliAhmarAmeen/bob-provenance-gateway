# Dashboard Enhancement Plan — BobGuard Enterprise Command Center

## Top-Level Overview

**Goal:** Upgrade the `mern-auditor-platform` frontend from a plain functional UI into a visually rich,
enterprise-grade dashboard that includes:

1. **Visual stat cards** — each of the 5 existing metric cards gets an animated radial/circular progress
   indicator to replace the raw number display, using only CSS + vanilla SVG (no extra libraries).
2. **Chart panel** — a horizontal bar-chart section below the metric cards giving a visual comparative
   view of all 5 metrics using a lightweight charting library (`recharts`).
3. **Light/Dark theme toggle** — a toggle switch in the header that flips between the existing dark theme
   and a new light theme, persisted to `localStorage`.
4. **Audit log pagination** — the table receives proper page-nav controls (Prev / Next / page numbers)
   driven from the real `total` count returned by the backend.
5. **Audit log date-range filter** — a compact date-from / date-to filter bar above the table that
   passes `dateFrom` / `dateTo` query params to the backend.
6. **Backend date-filter support** — the `GET /api/audit/records` endpoint is extended to accept
   optional `dateFrom` / `dateTo` query params and filter `createdAt` accordingly.

**Scope:** Frontend-only except for Sub-task 5 (one backend endpoint change).
No routing library, no new UI framework — vanilla CSS + CSS variables remain the styling foundation.
New library additions are minimal: only `recharts` for the chart panel.

**Approach:** Six focused, independently-reviewable sub-tasks executed in order.

---

## Architecture / Data-Flow After Enhancement

```
Dashboard (state: stats, records, page, dateFrom, dateTo, theme)
│
├── Header row
│     ├── BobGuard title
│     ├── Auto-refresh note
│     └── ThemeToggle (writes data-theme attr on <html>, saves to localStorage)
│
├── MetricCircle grid (5 cards, animated SVG ring + number)
│
├── StatsChart panel (Recharts BarChart — 5 bars, one per metric, color-coded)
│
└── Audit Log section
      ├── DateRangeFilter bar (dateFrom, dateTo inputs + Clear button)
      ├── AuditTable (existing columns + expandable rows kept intact)
      └── PaginationBar (Prev, page numbers, Next)
```

---

## Sub-Task 1 — Animated Metric Circles (MetricCircle component)

**Status:** `[x] done`

**Intent:**
Replace the flat `MetricCard` boxes with a new `MetricCircle` component that renders an animated
SVG radial ring showing the metric value visually. The ring fill percentage maps to the metric's
meaningful range (e.g. 0–100 for AI%, 0–10 for vuln density). A short CSS keyframe animation
draws the ring on load/update. The existing `status` color logic (ok/warn/fail/neutral) drives
the ring stroke color.

**Expected Outcomes:**
- Five animated circles appear in the metrics grid, each showing the metric label, numeric value,
  unit, and a color-coded SVG ring that fills to a proportional percentage.
- On stats update (10 s poll), the ring re-animates smoothly.
- `MetricCard.jsx` is kept in place (or renamed) so no other code breaks.

**Todo List:**
1. Install no new libraries — use a pure SVG `<circle>` with `stroke-dasharray` / `stroke-dashoffset`
   driven by a CSS custom property.
2. Create `frontend/src/components/MetricCircle.jsx` accepting props:
   `{ title, value, unit, status, detail, percent }` where `percent` (0–100) controls ring fill.
3. Add CSS in `index.css` for `.metric-circle`, `.metric-circle__ring`, and a
   `@keyframes ring-draw` animation using `stroke-dashoffset` transition.
4. Update `Dashboard.jsx` to import `MetricCircle` and compute a `percent` for each of the 5 stats
   (provenanceRatio → direct 0–100; licenseContamination → capped at 100 via `min(count*10, 100)`;
   vulnDensity → `min(density*10, 100)`; phantomPackages → `min(count*20, 100)`;
   tamperEvidence → `(state/total)*100`).
5. Swap `<MetricCard .../>` usages in `Dashboard.jsx` to `<MetricCircle .../>`.

**Relevant Context:**
- [`MetricCard.jsx`](frontend/src/components/MetricCard.jsx)
- [`Dashboard.jsx`](frontend/src/pages/Dashboard.jsx) — lines 101–136 (metrics section)
- [`index.css`](frontend/src/index.css) — lines 99–150 (metrics grid + card styles)

---

## Sub-Task 2 — Stats Chart Panel (StatsChart component using Recharts)

**Status:** `[x] done`

**Intent:**
Add a collapsible horizontal bar-chart section directly below the metric circles that gives a
side-by-side comparative view of all 5 metrics in a single glance. Use `recharts` which is
small, React-native, and tree-shakeable.

**Expected Outcomes:**
- A `<StatsChart>` component renders a `ResponsiveContainer > BarChart` with 5 bars.
- Each bar is colored by its metric status (green/orange/red/gray).
- Chart updates whenever `stats` changes (no extra polling needed — inherits Dashboard state).
- If `stats` is null (loading), the chart section shows a skeleton placeholder.

**Todo List:**
1. Install `recharts` as a frontend dependency:
   `cd mern-auditor-platform/frontend && npm install recharts`.
2. Create `frontend/src/components/StatsChart.jsx`:
   - Accept `{ stats }` prop.
   - Build a `chartData` array of 5 objects: `{ name, value, fill }`.
   - Render `<ResponsiveContainer height={220}><BarChart layout="vertical" ...>`.
   - Use `<XAxis type="number">`, `<YAxis type="category" dataKey="name">`, `<Tooltip>`, `<Bar>`.
   - Each bar's `fill` is driven by the same status color logic as the circles.
3. Add minimal CSS for `.stats-chart` wrapper in `index.css` (background surface, border-radius,
   padding, margin-bottom).
4. Import and render `<StatsChart stats={stats} />` in `Dashboard.jsx` between the metrics grid
   and the audit log section.
5. Style the chart to respect the active theme (dark vs. light) by reading CSS variables via
   the theme's token set (recharts accepts explicit color strings — pass `var(--surface-2)` for
   grid lines, `var(--muted)` for axis text, etc.).

**Relevant Context:**
- [`Dashboard.jsx`](frontend/src/pages/Dashboard.jsx) — lines 138–148 (after metrics, before log)
- [`index.css`](frontend/src/index.css) — CSS token values at lines 8–25
- `recharts` docs: `ResponsiveContainer`, `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `Cell`

---

## Sub-Task 3 — Light/Dark Theme Toggle

**Status:** `[x] done`

**Intent:**
Add a toggle switch in the dashboard header that flips between the existing dark theme and a new
light theme. The mechanism is a `data-theme="light"` attribute on `<html>`. All existing CSS
variables are overridden inside `[data-theme="light"] :root { ... }`. Theme preference is saved
to `localStorage` and restored on page load.

**Expected Outcomes:**
- A compact toggle (moon 🌙 / sun ☀️ icons) appears at the right side of the header.
- Clicking it switches all colors instantly via CSS variable overrides.
- Refreshing the page respects the last-chosen theme.
- The `PatchViewer` (which uses `atomOneDark` from react-syntax-highlighter) remains readable
  in both themes (it has its own dark background, which is acceptable).

**Todo List:**
1. Create `frontend/src/components/ThemeToggle.jsx`:
   - On mount, read `localStorage.getItem("theme")` and apply `data-theme` to `document.documentElement`.
   - Toggle function: flip between `"dark"` (default, remove attr) and `"light"` (set attr).
   - Render a `<button>` with moon/sun emoji + ARIA label.
2. Add `[data-theme="light"]` CSS overrides to `index.css` (after `:root`) with a light palette:
   - `--bg: #f6f8fa`, `--surface: #ffffff`, `--surface-2: #eaeef2`, `--border: #d0d7de`,
     `--text: #24292f`, `--muted: #656d76`, `--accent: #0969da`.
   - Status colors remain the same (green/orange/red are universally readable).
3. Pass a `theme` state (or use a context-free approach via DOM attribute) down from `Dashboard.jsx`
   and render `<ThemeToggle />` in the header next to the poll-note.
4. Add CSS for `.theme-toggle` button in `index.css` (borderless, cursor pointer, font-size 1.1rem).

**Relevant Context:**
- [`Dashboard.jsx`](frontend/src/pages/Dashboard.jsx) — lines 83–91 (header section)
- [`index.css`](frontend/src/index.css) — lines 8–25 (`:root` tokens)
- [`PatchViewer.jsx`](frontend/src/components/PatchViewer.jsx) — uses `atomOneDark` (self-contained)

---

## Sub-Task 4 — Backend: Date-Range Filter on Records Endpoint

**Status:** `[x] done`

**Intent:**
Extend the `GET /api/audit/records` endpoint to accept optional `dateFrom` and `dateTo` query
parameters and apply a `createdAt` filter to the MongoDB query. This is the minimal backend
change needed before the frontend filter UI can function.

**Expected Outcomes:**
- `GET /api/audit/records?dateFrom=2025-01-01&dateTo=2025-12-31` returns only records whose
  `createdAt` falls within the date range.
- `GET /api/audit/records?page=0` (no date params) behaves identically to today.
- `total` in the response reflects the filtered count (so pagination is accurate).

**Todo List:**
1. In `backend/controllers/auditController.js`, inside `getRecords` (line 477), build a `filter`
   object: if `dateFrom` or `dateTo` are present, add `createdAt: { $gte, $lte }` conditions.
2. Pass `filter` to both `AuditRecord.find(filter)` and `AuditRecord.countDocuments(filter)`.
3. Parse dates safely with `new Date(req.query.dateFrom)` and guard with `isNaN()` to ignore
   invalid values.
4. No new routes, no schema changes, no migration needed.

**Relevant Context:**
- [`auditController.js`](backend/controllers/auditController.js) — lines 467–495 (`getRecords`)
- [`AuditRecord.js`](backend/models/AuditRecord.js) — `createdAt` field (auto-timestamped)

---

## Sub-Task 5 — Audit Log: Date-Range Filter UI

**Status:** `[x] done`

**Intent:**
Add a `DateRangeFilter` bar above the audit table. It renders two `<input type="date">` fields
(From / To) and a "Clear" button. Changing either input resets the page to 0 and triggers a
new fetch with the date params.

**Expected Outcomes:**
- Filter bar appears above the audit table with "From" and "To" date pickers.
- Selecting dates immediately re-fetches records with `dateFrom` / `dateTo` query params.
- Clearing the filter restores the unfiltered list.
- The record count in the header ("X records") and pagination reflect the filtered total.

**Todo List:**
1. Create `frontend/src/components/DateRangeFilter.jsx`:
   - Props: `{ dateFrom, dateTo, onChange }` where `onChange(from, to)` is called on each input change.
   - Render two `<input type="date">` and a `<button>Clear</button>`.
2. Lift `dateFrom`/`dateTo` state up to `Dashboard.jsx` (already owns all data-fetch state).
3. Update `fetchRecords` call in `Dashboard.jsx` to pass `{ page, dateFrom, dateTo }`.
4. Update `auditApi.js` `fetchRecords` to accept and forward `dateFrom` / `dateTo` as query params.
5. Add `.date-filter` CSS styles in `index.css` (flexbox row, gap, small input styling consistent
   with the existing table header aesthetic).
6. Render `<DateRangeFilter>` in `Dashboard.jsx` above `<AuditTable>`.

**Relevant Context:**
- [`auditApi.js`](frontend/src/api/auditApi.js) — `fetchRecords(page)` signature (line 28)
- [`Dashboard.jsx`](frontend/src/pages/Dashboard.jsx) — lines 54–68 (`refresh` callback)
- [`index.css`](frontend/src/index.css) — audit table section starts at line 166

---

## Sub-Task 6 — Audit Log: Pagination Controls

**Status:** `[x] done`

**Intent:**
The backend already supports page-based pagination (`page` param, `total` in response, 20 per page).
The frontend currently hardcodes `fetchRecords(0)` and never changes page. This sub-task adds a
`PaginationBar` component that renders Prev / page-number buttons / Next, and wires it to the
Dashboard's `page` state.

**Expected Outcomes:**
- A pagination bar appears below the audit table showing current page, total pages, Prev and Next
  buttons.
- Clicking Prev/Next or a page number fetches the corresponding page.
- When a date filter is active, page is reset to 0 and pagination reflects the filtered total.
- At < 20 total records (single page), the bar is hidden.

**Todo List:**
1. Add `page` state to `Dashboard.jsx` (rename the existing `fetchRecords(0)` call to use it).
2. Update `refresh` in `Dashboard.jsx` to depend on `page`, `dateFrom`, `dateTo`.
3. Create `frontend/src/components/PaginationBar.jsx`:
   - Props: `{ page, total, pageSize, onPageChange }`.
   - Computes `totalPages = Math.ceil(total / pageSize)`.
   - Renders Prev button (disabled at page 0), up to 5 page-number buttons centered on current page,
     Next button (disabled at last page).
4. Add `.pagination` CSS block in `index.css` (centered flex row, button styles consistent with
   table header colors).
5. Render `<PaginationBar>` in `Dashboard.jsx` below `<AuditTable>`, only when `total > 20`.
6. When `dateFrom`/`dateTo` change (Sub-task 5), reset `page` to 0.

**Relevant Context:**
- [`Dashboard.jsx`](frontend/src/pages/Dashboard.jsx) — `refresh` callback + `fetchRecords` (lines 54–76)
- [`auditApi.js`](frontend/src/api/auditApi.js) — `fetchRecords(page)` already accepts page
- Backend `getRecords` response already returns `{ total, page, records }` — no backend change needed

---

## Implementation Order

```
Sub-task 1 (MetricCircle)      →  visual upgrade, self-contained
Sub-task 2 (StatsChart)        →  new panel, depends on stats data shape (same as task 1)
Sub-task 3 (ThemeToggle)       →  CSS-only feature, no data dependency
Sub-task 4 (Backend filter)    →  backend change, no frontend dependency
Sub-task 5 (Date filter UI)    →  depends on Sub-task 4 backend
Sub-task 6 (Pagination)        →  depends on page state added in Sub-task 5
```

---

## New Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/components/MetricCircle.jsx` | Animated SVG ring metric card |
| `frontend/src/components/StatsChart.jsx` | Recharts bar chart panel |
| `frontend/src/components/ThemeToggle.jsx` | Light/dark theme switch |
| `frontend/src/components/DateRangeFilter.jsx` | Date-from / date-to filter bar |
| `frontend/src/components/PaginationBar.jsx` | Page navigation controls |

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/pages/Dashboard.jsx` | Add theme, page, dateFrom, dateTo state; wire all new components |
| `frontend/src/api/auditApi.js` | Extend `fetchRecords` to accept `dateFrom`/`dateTo` params |
| `frontend/src/index.css` | Add light-theme tokens, circle/chart/filter/pagination CSS |
| `backend/controllers/auditController.js` | Add date-range filter in `getRecords` |

## Library Addition

| Library | Version | Why |
|---------|---------|-----|
| `recharts` | latest stable | Bar chart panel (Sub-task 2); small, tree-shakeable, React-native |
