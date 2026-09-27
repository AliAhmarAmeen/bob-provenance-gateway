/**
 * AuditTable — renders the 20 most-recent audit records.
 *
 * Each row shows:
 *   • pass/fail badge
 *   • short commit SHA
 *   • author + branch
 *   • repo
 *   • AI ratio %
 *   • timestamp
 *
 * Clicking a row toggles an expanded detail panel showing:
 *   • full violation list
 *   • PatchViewer (if a remediation patch is available)
 *
 * Props:
 *   records  {object[]}  — AuditRecord documents from GET /api/audit/records
 */
import { useState } from "react";
import PatchViewer from "./PatchViewer";

function shortSha(sha = "") {
  return sha.length > 8 ? sha.slice(0, 8) : sha;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

export default function AuditTable({ records = [] }) {
  const [expandedId, setExpandedId] = useState(null);

  if (records.length === 0) {
    return <p className="audit-table__empty">No audit records yet. Make a commit to generate one.</p>;
  }

  return (
    <div className="audit-table-wrap">
    <table className="audit-table">
      <thead>
        <tr>
          <th>Status</th>
          <th>Commit</th>
          <th>Author / Branch</th>
          <th>Repo</th>
          <th>AI%</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        {records.map((rec) => {
          const isExpanded = expandedId === rec._id;
          const passed     = rec.allowCommit;

          return (
            <>
              <tr
                key={rec._id}
                className={`audit-table__row audit-table__row--${passed ? "pass" : "fail"}`}
                onClick={() => setExpandedId(isExpanded ? null : rec._id)}
                title="Click to expand"
              >
                <td>
                  <span className={`badge badge--${passed ? "pass" : "fail"}`}>
                    {passed ? "PASS" : "BLOCKED"}
                  </span>
                </td>
                <td className="audit-table__mono">{shortSha(rec.commitSha)}</td>
                <td>
                  <span className="audit-table__author">{rec.author}</span>
                  <span className="audit-table__branch"> @ {rec.branch}</span>
                </td>
                <td>{rec.repoName}</td>
                <td>{rec.aiRatio?.aiPercent ?? 0}%</td>
                <td>{formatDate(rec.createdAt)}</td>
              </tr>

              {isExpanded && (
                <tr key={`${rec._id}-detail`} className="audit-table__detail-row">
                  <td colSpan={6}>
                    <div className="audit-detail">
                      {/* Violations */}
                      {rec.violations?.length > 0 ? (
                        <div className="audit-detail__violations">
                          <p className="audit-detail__section-label">Violations</p>
                          <ul>
                            {rec.violations.map((v, i) => (
                              <li key={i}>{v}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="audit-detail__clean">✓ No violations detected.</p>
                      )}

                      {/* Provenance hash */}
                      <p className="audit-detail__hash">
                        <span className="audit-detail__section-label">SHA-256: </span>
                        <span className="audit-table__mono">{rec.sha256ProvenanceHash}</span>
                      </p>

                      {/* Remediation patch */}
                      {rec.remediation?.patchAvailable && (
                        <PatchViewer patchContent={rec.remediation.patchContent} />
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
