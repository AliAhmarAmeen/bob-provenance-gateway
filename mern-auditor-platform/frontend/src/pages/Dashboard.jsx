/**
 * Dashboard — BobGuard Enterprise Command Center
 *
 * Polls GET /api/audit/stats   every 10 s → five animated metric circles
 * Polls GET /api/audit/records every 10 s → audit log table (paginated, filterable)
 *
 * State:
 *   stats    — aggregated metric object from /stats
 *   records  — current page of AuditRecord documents
 *   total    — total matching record count (reflects active date filter)
 *   page     — 0-based current page
 *   dateFrom — ISO date string "YYYY-MM-DD" or "" (no filter)
 *   dateTo   — ISO date string "YYYY-MM-DD" or "" (no filter)
 *   loading  — true until first successful fetch
 *   error    — error message string or null
 */
import { useState, useEffect, useCallback } from "react";
import { fetchStats, fetchRecords } from "../api/auditApi";
import MetricCircle    from "../components/MetricCircle";
import StatsChart      from "../components/StatsChart";
import ThemeToggle     from "../components/ThemeToggle";
import DateRangeFilter from "../components/DateRangeFilter";
import AuditTable      from "../components/AuditTable";
import PaginationBar   from "../components/PaginationBar";
import { generateReport } from "../utils/generateReport";

const POLL_MS = 10_000;

/* ── Metric status helpers ────────────────────────────────────────────────── */

function provenanceStatus(ratio) {
  if (ratio >= 80) return "fail";
  if (ratio >= 50) return "warn";
  return "ok";
}

function licenseStatus(count) {
  return count > 0 ? "fail" : "ok";
}

function vulnStatus(density) {
  if (density > 5) return "fail";
  if (density > 0) return "warn";
  return "ok";
}

function phantomStatus(count) {
  return count > 0 ? "fail" : "ok";
}

function tamperStatus(state, total) {
  if (total === 0) return "neutral";
  return state === total ? "ok" : "warn";
}

/* ── Component ───────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const [stats,    setStats]    = useState(null);
  const [records,  setRecords]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // refresh depends on page + pageSize + date filters — any change re-fetches records
  const refresh = useCallback(async () => {
    try {
      const [statsData, recordsData] = await Promise.all([
        fetchStats(),
        fetchRecords(page, dateFrom, dateTo, pageSize),
      ]);
      setStats(statsData);
      setRecords(recordsData.records ?? []);
      setTotal(recordsData.total    ?? 0);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to reach the BobGuard backend.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, dateFrom, dateTo]);

  /* Initial fetch + polling */
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  /* When date filter changes, reset to page 0 */
  function handleDateChange(from, to) {
    setPage(0);
    setDateFrom(from);
    setDateTo(to);
  }

  /* When page size changes, reset to page 0 */
  function handlePageSizeChange(e) {
    setPage(0);
    setPageSize(Number(e.target.value));
  }

  /* Download PDF — fetches all records matching the active filter */
  async function handleDownloadPdf() {
    if (downloadingPdf || total === 0) return;
    setDownloadingPdf(true);
    try {
      await generateReport({ stats, dateFrom, dateTo });
    } finally {
      setDownloadingPdf(false);
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <>
      {/* Sticky header — full viewport width */}
      <header className="dashboard__header">
        <div className="dashboard__header-inner">
          {/* Brand — shield icon + two-line title */}
          <div className="dashboard__brand-wrap">
            <svg className="dashboard__shield" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 2L4 5.5V11c0 4.97 3.4 9.63 8 10.93C16.6 20.63 20 15.97 20 11V5.5L12 2Z"
                fill="currentColor"
                opacity="0.18"
              />
              <path
                d="M12 2L4 5.5V11c0 4.97 3.4 9.63 8 10.93C16.6 20.63 20 15.97 20 11V5.5L12 2Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M9 12l2 2 4-4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="dashboard__title-block">
              <span className="dashboard__brand">BobGuard</span>
              <span className="dashboard__brand-sub">Enterprise Command Center</span>
            </div>
          </div>

          {/* Right cluster — status dot · record pill · theme toggle */}
          <div className="dashboard__header-right">
            <span
              className={`status-dot ${
                error    ? "status-dot--error"   :
                loading  ? "status-dot--loading" :
                           "status-dot--live"
              }`}
              title={
                error   ? "Connection error"      :
                loading ? "Loading…"              :
                          `Live · auto-refresh ${POLL_MS / 1000}s`
              }
            />
            {!loading && (
              <span className="record-pill">
                {total} record{total !== 1 ? "s" : ""}
              </span>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="dashboard">
        {/* Error banner */}
        {error && (
          <div className="dashboard__error-banner">
            ⚠ {error}
          </div>
        )}

      {/* Metrics grid */}
      <section className="dashboard__metrics">
        <MetricCircle
          title="AI Provenance Ratio"
          value={stats ? stats.provenanceRatio.toFixed(1) : "—"}
          unit="%"
          status={stats ? provenanceStatus(stats.provenanceRatio) : "neutral"}
          detail="Avg % of AI-authored lines per commit"
          percent={stats ? Math.min(stats.provenanceRatio, 100) : 0}
        />
        <MetricCircle
          title="License Contamination"
          value={stats ? stats.licenseContaminationIndex : "—"}
          unit="violations"
          status={stats ? licenseStatus(stats.licenseContaminationIndex) : "neutral"}
          detail="Commits with banned SPDX identifiers"
          percent={stats ? Math.min(stats.licenseContaminationIndex * 10, 100) : 0}
        />
        <MetricCircle
          title="Vulnerability Density"
          value={stats ? stats.vulnerabilityDensity.toFixed(2) : "—"}
          unit="/100 AI lines"
          status={stats ? vulnStatus(stats.vulnerabilityDensity) : "neutral"}
          detail="OWASP vuln hits per 100 AI-authored lines"
          percent={stats ? Math.min(stats.vulnerabilityDensity * 10, 100) : 0}
        />
        <MetricCircle
          title="Phantom Packages"
          value={stats ? stats.phantomPackagesDetected : "—"}
          unit="detected"
          status={stats ? phantomStatus(stats.phantomPackagesDetected) : "neutral"}
          detail="npm packages not found in registry"
          percent={stats ? Math.min(stats.phantomPackagesDetected * 20, 100) : 0}
        />
        <MetricCircle
          title="Tamper-Evidence State"
          value={stats ? `${stats.tamperEvidenceState}/${stats.totalRecords}` : "—"}
          status={stats ? tamperStatus(stats.tamperEvidenceState, stats.totalRecords) : "neutral"}
          detail="Records with valid SHA-256 provenance hash"
          percent={stats && stats.totalRecords > 0
            ? (stats.tamperEvidenceState / stats.totalRecords) * 100
            : 0}
        />
      </section>

      {/* Stats chart */}
      <StatsChart stats={stats} />

      {/* Audit log */}
      <section className="dashboard__log">
        <div className="dashboard__log-header">
          <h2 className="dashboard__section-title">
            Audit Log
            <span className="dashboard__section-sub">
              {" "}({total} record{total !== 1 ? "s" : ""}{dateFrom || dateTo ? ", filtered" : ""})
            </span>
          </h2>
          <button
            className="report-btn"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf || total === 0}
            title={total === 0 ? "No records to export" : "Download PDF report for current filter"}
          >
            {downloadingPdf ? "Generating…" : "⬇ Download Report"}
          </button>
        </div>

        {/* Date-range filter */}
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={handleDateChange}
        />

        {/* Pagination info bar — "Showing X–Y of Z records" + per-page selector */}
        <div className="pagination-info">
          <span className="pagination-info__range">
            {total === 0
              ? "No records"
              : `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} of ${total} record${total !== 1 ? "s" : ""}`}
          </span>
          <label className="pagination-info__per-page">
            Per page:
            <select
              className="pagination-info__select"
              value={pageSize}
              onChange={handlePageSizeChange}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>

        {/* Table */}
        {loading && records.length === 0
          ? <p className="dashboard__loading">Fetching records…</p>
          : <AuditTable records={records} />
        }

        {/* Pagination */}
        <PaginationBar
          page={page}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </section>
      </div>
    </>
  );
}
