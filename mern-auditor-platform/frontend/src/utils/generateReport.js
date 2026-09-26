/**
 * generateReport — BobGuard PDF Audit Report
 *
 * Generates a client-side PDF using jsPDF + jsPDF-AutoTable.
 * The report respects the currently active date filter — it fetches ALL
 * matching records (limit=9999) regardless of the paginated view.
 *
 * PDF sections:
 *   1. Header block  — title, generation timestamp, date filter range
 *   2. Summary table — five KPI metrics with values and statuses
 *   3. Records table — full audit log with per-record details
 *   4. Page footer   — "Page X of Y" on every page
 *
 * @param {object} opts
 * @param {object|null} opts.stats    — current stats object (from /stats endpoint)
 * @param {string}      opts.dateFrom — ISO date "YYYY-MM-DD" or "" (no filter)
 * @param {string}      opts.dateTo   — ISO date "YYYY-MM-DD" or "" (no filter)
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchRecords } from "../api/auditApi";

/* ── Colour palette (matches CSS variables) ──────────────────────────────── */
const C = {
  bg:      [13,  17,  23],   // --bg
  surface: [22,  27,  34],   // --surface
  surface2:[33,  38,  45],   // --surface-2
  border:  [48,  54,  61],   // --border
  text:    [230, 237, 243],  // --text
  muted:   [139, 148, 158],  // --muted
  accent:  [56,  139, 253],  // --accent
  ok:      [63,  185, 80],   // --ok
  warn:    [210, 153, 34],   // --warn
  fail:    [248, 81,  73],   // --fail
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function statusColor(status) {
  if (status === "ok"   || status === "OK")      return C.ok;
  if (status === "warn" || status === "WARN")    return C.warn;
  if (status === "fail" || status === "FAIL")    return C.fail;
  return C.muted;
}

function statusLabel(status) {
  const map = { ok: "OK", warn: "WARN", fail: "FAIL", neutral: "NEUTRAL" };
  return map[status] ?? String(status).toUpperCase();
}

function provenanceStatus(ratio) {
  if (ratio >= 80) return "fail";
  if (ratio >= 50) return "warn";
  return "ok";
}
function licenseStatus(count)   { return count > 0 ? "fail" : "ok"; }
function vulnStatus(density)    { return density > 5 ? "fail" : density > 0 ? "warn" : "ok"; }
function phantomStatus(count)   { return count > 0 ? "fail" : "ok"; }
function tamperStatus(s, total) { if (total === 0) return "neutral"; return s === total ? "ok" : "warn"; }

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

function truncate(str, n) {
  if (!str) return "—";
  return str.length > n ? str.slice(0, n) + "…" : str;
}

/** Draw "Page X of Y" footer on every page */
function addPageFooters(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text(`Page ${i} of ${pageCount}`, pw / 2, ph - 8, { align: "center" });
    doc.text("BobGuard Enterprise Audit Report", 14, ph - 8);
    doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, pw - 14, ph - 8, { align: "right" });
  }
}

/* ── Main export ─────────────────────────────────────────────────────────── */

export async function generateReport({ stats, dateFrom, dateTo }) {
  // 1. Fetch all matching records (ignore pagination — use limit=9999)
  const { records } = await fetchRecords(0, dateFrom, dateTo, 9999);

  // 2. Initialise PDF (A4, landscape for wide table)
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw  = doc.internal.pageSize.getWidth();   // 297mm
  const margin = 14;

  // 3. ── Header block ──────────────────────────────────────────────────────

  // Background band
  doc.setFillColor(...C.bg);
  doc.rect(0, 0, pw, 28, "F");

  // Accent gradient bar (simulated with two filled rects)
  doc.setFillColor(...C.accent);
  doc.rect(0, 26, pw * 0.6, 2, "F");
  doc.setFillColor(124, 92, 216);  // purple end
  doc.rect(pw * 0.6, 26, pw * 0.2, 2, "F");

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.text);
  doc.text("BobGuard", margin, 13);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  doc.text("Enterprise Audit Report", margin + 42, 13);

  // Right-side meta
  doc.setFontSize(8);
  const rangeLabel = (dateFrom || dateTo)
    ? `Date range: ${dateFrom || "start"} → ${dateTo || "now"}`
    : "Date range: All records";
  doc.text(rangeLabel, pw - margin, 10, { align: "right" });
  doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, pw - margin, 16, { align: "right" });
  doc.text(`Total records: ${records.length}`, pw - margin, 22, { align: "right" });

  let cursorY = 36;

  // 4. ── KPI Summary table ─────────────────────────────────────────────────

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.muted);
  doc.text("EXECUTIVE SUMMARY", margin, cursorY - 2);

  const kpiRows = stats ? [
    [
      "AI Provenance Ratio",
      `${stats.provenanceRatio.toFixed(1)}%`,
      "Avg % of AI-authored lines per commit",
      statusLabel(provenanceStatus(stats.provenanceRatio)),
    ],
    [
      "License Contamination",
      String(stats.licenseContaminationIndex),
      "Commits with banned SPDX identifiers",
      statusLabel(licenseStatus(stats.licenseContaminationIndex)),
    ],
    [
      "Vulnerability Density",
      `${stats.vulnerabilityDensity.toFixed(2)} /100 AI lines`,
      "OWASP vuln hits per 100 AI-authored lines",
      statusLabel(vulnStatus(stats.vulnerabilityDensity)),
    ],
    [
      "Phantom Packages",
      String(stats.phantomPackagesDetected),
      "npm packages not found in registry",
      statusLabel(phantomStatus(stats.phantomPackagesDetected)),
    ],
    [
      "Tamper-Evidence State",
      `${stats.tamperEvidenceState} / ${stats.totalRecords}`,
      "Records with valid SHA-256 provenance hash",
      statusLabel(tamperStatus(stats.tamperEvidenceState, stats.totalRecords)),
    ],
  ] : [["No stats available", "—", "—", "—"]];

  autoTable(doc, {
    startY: cursorY,
    head: [["Metric", "Value", "Description", "Status"]],
    body: kpiRows,
    theme: "plain",
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [200, 210, 220],
      fillColor: C.surface,
      lineColor: C.border,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: C.surface2,
      textColor: C.muted,
      fontStyle: "bold",
      fontSize: 7.5,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 52 },
      1: { cellWidth: 38 },
      2: { cellWidth: 110 },
      3: {
        cellWidth: 22,
        halign: "center",
        fontStyle: "bold",
      },
    },
    didDrawCell(data) {
      // Colour-code the Status column cells
      if (data.section === "body" && data.column.index === 3) {
        const raw = kpiRows[data.row.index]?.[3] ?? "";
        const colour = statusColor(raw.toLowerCase());
        doc.setTextColor(...colour);
        doc.setFont("helvetica", "bold");
        const cell = data.cell;
        doc.text(
          raw,
          cell.x + cell.width / 2,
          cell.y + cell.height / 2 + 1,
          { align: "center" }
        );
        // Reset after custom draw
        doc.setTextColor(...C.text);
      }
    },
  });

  cursorY = doc.lastAutoTable.finalY + 10;

  // 5. ── Audit records table ───────────────────────────────────────────────

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.muted);
  doc.text("AUDIT RECORDS", margin, cursorY - 2);

  const recordRows = records.map((r, i) => [
    String(i + 1),
    fmtDate(r.createdAt),
    truncate(r.author,   22),
    truncate(r.branch,   18),
    r.commitSha ? r.commitSha.slice(0, 8) : "—",
    truncate(r.repoName, 22),
    String(r.violations?.length ?? 0),
    r.allowCommit ? "PASS" : "FAIL",
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [["#", "Date", "Author", "Branch", "Commit", "Repo", "Violations", "Status"]],
    body: recordRows.length ? recordRows : [["—", "No records match the selected filter.", "", "", "", "", "", ""]],
    theme: "plain",
    styles: {
      fontSize: 7.8,
      cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
      textColor: [200, 210, 220],
      fillColor: C.surface,
      lineColor: C.border,
      lineWidth: 0.2,
      overflow: "ellipsize",
    },
    headStyles: {
      fillColor: C.surface2,
      textColor: C.muted,
      fontStyle: "bold",
      fontSize: 7.2,
    },
    alternateRowStyles: {
      fillColor: [18, 23, 30],
    },
    columnStyles: {
      0:  { cellWidth: 8,  halign: "right",  textColor: C.muted },
      1:  { cellWidth: 32 },
      2:  { cellWidth: 38 },
      3:  { cellWidth: 30 },
      4:  { cellWidth: 22, fontStyle: "bold" },
      5:  { cellWidth: 40 },
      6:  { cellWidth: 20, halign: "center" },
      7:  { cellWidth: 18, halign: "center", fontStyle: "bold" },
    },
    didDrawCell(data) {
      // Colour-code the Status column
      if (data.section === "body" && data.column.index === 7) {
        const val = recordRows[data.row.index]?.[7] ?? "";
        const colour = val === "PASS" ? C.ok : C.fail;
        doc.setTextColor(...colour);
        doc.setFont("helvetica", "bold");
        const cell = data.cell;
        doc.text(
          val,
          cell.x + cell.width / 2,
          cell.y + cell.height / 2 + 1,
          { align: "center" }
        );
        doc.setTextColor(...C.text);
      }
    },
  });

  // 6. ── Page footers on all pages ──────────────────────────────────────────
  addPageFooters(doc);

  // 7. ── Save / download ────────────────────────────────────────────────────
  const from = dateFrom || "all";
  const to   = dateTo   || "records";
  const filename = dateFrom || dateTo
    ? `bobguard-report-${from}-to-${to}.pdf`
    : `bobguard-report-all.pdf`;

  doc.save(filename);
}
