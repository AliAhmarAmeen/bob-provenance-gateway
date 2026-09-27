/**
 * StatsChart — horizontal bar chart of all 5 dashboard metrics.
 *
 * Uses recharts ResponsiveContainer + BarChart (vertical layout so metric
 * names appear on the Y-axis and bars extend to the right).
 *
 * Props:
 *   stats  {object|null}  — stats object from GET /api/audit/stats
 */
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

/* ── status color helpers (mirrors Dashboard logic) ───────────────────────── */
function provenanceColor(v) { return v >= 80 ? "#f85149" : v >= 50 ? "#d29922" : "#3fb950"; }
function licenseColor(v)    { return v  > 0  ? "#f85149" : "#3fb950"; }
function vulnColor(v)       { return v  > 5  ? "#f85149" : v > 0     ? "#d29922" : "#3fb950"; }
function phantomColor(v)    { return v  > 0  ? "#f85149" : "#3fb950"; }
function tamperColor(s, t)  {
  if (t === 0) return "#8b949e";
  return s === t ? "#3fb950" : "#d29922";
}

/* ── Custom tooltip ──────────────────────────────────────────────────────── */
function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="stats-chart__tooltip">
      <p className="stats-chart__tooltip-name">{d.name}</p>
      <p className="stats-chart__tooltip-val" style={{ color: d.fill }}>
        {d.displayValue}
      </p>
    </div>
  );
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function StatsChart({ stats }) {
  if (!stats) {
    return (
      <div className="stats-chart stats-chart--skeleton" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="stats-chart__skel-bar" />
        ))}
      </div>
    );
  }

  const { provenanceRatio, licenseContaminationIndex, vulnerabilityDensity,
          phantomPackagesDetected, tamperEvidenceState, totalRecords } = stats;

  const data = [
    {
      name:         "AI Provenance %",
      value:        Math.min(provenanceRatio, 100),
      displayValue: `${provenanceRatio.toFixed(1)} %`,
      fill:         provenanceColor(provenanceRatio),
    },
    {
      name:         "License Contamination",
      value:        Math.min(licenseContaminationIndex * 10, 100),
      displayValue: `${licenseContaminationIndex} violations`,
      fill:         licenseColor(licenseContaminationIndex),
    },
    {
      name:         "Vulnerability Density",
      value:        Math.min(vulnerabilityDensity * 10, 100),
      displayValue: `${vulnerabilityDensity.toFixed(2)} / 100 AI lines`,
      fill:         vulnColor(vulnerabilityDensity),
    },
    {
      name:         "Phantom Packages",
      value:        Math.min(phantomPackagesDetected * 20, 100),
      displayValue: `${phantomPackagesDetected} detected`,
      fill:         phantomColor(phantomPackagesDetected),
    },
    {
      name:         "Tamper-Evidence",
      value:        totalRecords > 0 ? (tamperEvidenceState / totalRecords) * 100 : 0,
      displayValue: `${tamperEvidenceState} / ${totalRecords} records`,
      fill:         tamperColor(tamperEvidenceState, totalRecords),
    },
  ];

  return (
    <div className="stats-chart">
      <p className="stats-chart__label">Metric Overview</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: "var(--muted)", fontFamily: "var(--font-ui)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={160}
            tick={{ fontSize: 12, fill: "var(--text-2)", fontFamily: "var(--font-ui)", fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
