/**
 * Dashboard — BobGuard Enterprise Command Center
 *
 * Polls GET /api/audit/stats   every 10 s → five compact stat cards
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
import StatCard from "../components/StatCard";
import StatsChart from "../components/StatsChart";
import ThemeToggle from "../components/ThemeToggle";
import DateRangeFilter from "../components/DateRangeFilter";
import AuditTable from "../components/AuditTable";
import PaginationBar from "../components/PaginationBar";
import { generateReport } from "../utils/generateReport";
import {
  IconShield,
  IconBrain,
  IconFileText,
  IconBug,
  IconGhost,
  IconLock,
  IconDownload,
  IconAlertTriangle,
} from "../components/Icons";

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
  const [stats, setStats] = useState(null);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [statsData, recordsData] = await Promise.all([
        fetchStats(),
        fetchRecords(page, dateFrom, dateTo, pageSize),
      ]);
      setStats(statsData);
      setRecords(recordsData.records ?? []);
      setTotal(recordsData.total ?? 0);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to reach the BobGuard backend.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, dateFrom, dateTo]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  function handleDateChange(from, to) {
    setPage(0);
    setDateFrom(from);
    setDateTo(to);
  }

  function handlePageSizeChange(e) {
    setPage(0);
    setPageSize(Number(e.target.value));
  }

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
      {/* Sticky header */}
      <header className="dashboard__header">
        <div className="dashboard__header-inner">
          {/* Brand */}
          <div className="dashboard__brand-wrap">
            {/* <IconShield size={30} className="dashboard__shield" /> */}
            <div className="dashboard__title-block">
              <span className="dashboard__brand">BobGuard</span>
              <span className="dashboard__brand-sub">
                Enterprise Command Center
              </span>
            </div>
          </div>

          {/* Right cluster — status dot · record pill · theme toggle */}
          <div className="dashboard__header-right">
            <span
              className={`status-dot ${
                error
                  ? "status-dot--error"
                  : loading
                    ? "status-dot--loading"
                    : "status-dot--live"
              }`}
              title={
                error
                  ? "Connection error"
                  : loading
                    ? "Loading…"
                    : `Live · auto-refresh ${POLL_MS / 1000}s`
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
            <IconAlertTriangle size={15} />
            {error}
          </div>
        )}

        {/* ── Metrics strip ─────────────────────────────────────────────── */}
        <section className="dashboard__metrics">
          <StatCard
            title="AI Provenance Ratio"
            value={stats ? stats.provenanceRatio.toFixed(1) : "—"}
            unit="%"
            status={stats ? provenanceStatus(stats.provenanceRatio) : "neutral"}
            icon={<IconBrain size={20} />}
          />
          <StatCard
            title="License Contamination"
            value={stats ? stats.licenseContaminationIndex : "—"}
            unit=" violations"
            status={
              stats ? licenseStatus(stats.licenseContaminationIndex) : "neutral"
            }
            icon={<IconFileText size={20} />}
          />
          <StatCard
            title="Vulnerability Density"
            value={stats ? stats.vulnerabilityDensity.toFixed(2) : "—"}
            unit="/100 lines"
            status={stats ? vulnStatus(stats.vulnerabilityDensity) : "neutral"}
            icon={<IconBug size={20} />}
          />
          <StatCard
            title="Phantom Packages"
            value={stats ? stats.phantomPackagesDetected : "—"}
            unit=" detected"
            status={
              stats ? phantomStatus(stats.phantomPackagesDetected) : "neutral"
            }
            icon={<IconGhost size={20} />}
          />
          <StatCard
            title="Tamper-Evidence"
            value={
              stats ? `${stats.tamperEvidenceState}/${stats.totalRecords}` : "—"
            }
            status={
              stats
                ? tamperStatus(stats.tamperEvidenceState, stats.totalRecords)
                : "neutral"
            }
            icon={<IconLock size={20} />}
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
                {" "}
                ({total} record{total !== 1 ? "s" : ""}
                {dateFrom || dateTo ? ", filtered" : ""})
              </span>
            </h2>
            <button
              className="report-btn"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || total === 0}
              title={
                total === 0
                  ? "No records to export"
                  : "Download PDF report for current filter"
              }
            >
              <IconDownload size={14} />
              {downloadingPdf ? "Generating…" : "Download Report"}
            </button>
          </div>

          {/* Date-range filter */}
          <DateRangeFilter
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChange={handleDateChange}
          />

          {/* Pagination info bar */}
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
          {loading && records.length === 0 ? (
            <p className="dashboard__loading">Fetching records…</p>
          ) : (
            <AuditTable records={records} />
          )}

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
