/**
 * Dashboard — BobGuard Enterprise Command Center
 *
 * Polls GET /api/audit/stats  every 10 s → five metric cards
 * Polls GET /api/audit/records every 10 s → audit log table
 *
 * Handles loading (initial fetch) and error states gracefully.
 */
import { useState, useEffect, useCallback } from "react";
import { fetchStats, fetchRecords } from "../api/auditApi";
import MetricCard from "../components/MetricCard";
import AuditTable from "../components/AuditTable";

const POLL_MS = 10_000;

/* ── Metric status helpers ────────────────────────────────────────────────── */

function provenanceStatus(ratio) {
  if (ratio >= 80) return "fail";
  if (ratio >= 50) return "warn";
  return "ok";
}

function licenseStatus(count) {
  if (count > 0) return "fail";
  return "ok";
}

function vulnStatus(density) {
  if (density > 5) return "fail";
  if (density > 0) return "warn";
  return "ok";
}

function phantomStatus(count) {
  if (count > 0) return "fail";
  return "ok";
}

function tamperStatus(state, total) {
  if (total === 0) return "neutral";
  return state === total ? "ok" : "warn";
}

/* ── Component ───────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const [stats,   setStats]   = useState(null);
  const [records, setRecords] = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [statsData, recordsData] = await Promise.all([
        fetchStats(),
        fetchRecords(0),
      ]);
      setStats(statsData);
      setRecords(recordsData.records ?? []);
      setTotal(recordsData.total   ?? 0);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to reach the BobGuard backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* Initial fetch + polling */
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard__header">
        <h1 className="dashboard__title">
          <span className="dashboard__title-icon">⬡</span> BobGuard
          <span className="dashboard__title-sub"> Enterprise Command Center</span>
        </h1>
        <span className="dashboard__poll-note">
          {loading ? "Loading…" : `Auto-refresh every ${POLL_MS / 1000}s · ${total} record${total !== 1 ? "s" : ""}`}
        </span>
      </header>

      {/* Error banner */}
      {error && (
        <div className="dashboard__error-banner">
          ⚠ {error}
        </div>
      )}

      {/* Metrics grid */}
      <section className="dashboard__metrics">
        <MetricCard
          title="AI Provenance Ratio"
          value={stats ? stats.provenanceRatio.toFixed(1) : "—"}
          unit="%"
          status={stats ? provenanceStatus(stats.provenanceRatio) : "neutral"}
          detail="Avg % of AI-authored lines per commit"
        />
        <MetricCard
          title="License Contamination"
          value={stats ? stats.licenseContaminationIndex : "—"}
          unit=" violations"
          status={stats ? licenseStatus(stats.licenseContaminationIndex) : "neutral"}
          detail="Commits with banned SPDX identifiers"
        />
        <MetricCard
          title="Vulnerability Density"
          value={stats ? stats.vulnerabilityDensity.toFixed(2) : "—"}
          unit=" / 100 AI lines"
          status={stats ? vulnStatus(stats.vulnerabilityDensity) : "neutral"}
          detail="OWASP vuln hits per 100 AI-authored lines"
        />
        <MetricCard
          title="Phantom Packages"
          value={stats ? stats.phantomPackagesDetected : "—"}
          unit=" detected"
          status={stats ? phantomStatus(stats.phantomPackagesDetected) : "neutral"}
          detail="npm packages not found in registry"
        />
        <MetricCard
          title="Tamper-Evidence State"
          value={stats ? `${stats.tamperEvidenceState} / ${stats.totalRecords}` : "—"}
          status={stats ? tamperStatus(stats.tamperEvidenceState, stats.totalRecords) : "neutral"}
          detail="Records with valid SHA-256 provenance hash"
        />
      </section>

      {/* Audit log */}
      <section className="dashboard__log">
        <h2 className="dashboard__section-title">
          Recent Audit Log
          <span className="dashboard__section-sub"> (latest 20 commits)</span>
        </h2>
        {loading && records.length === 0
          ? <p className="dashboard__loading">Fetching records…</p>
          : <AuditTable records={records} />
        }
      </section>
    </div>
  );
}
