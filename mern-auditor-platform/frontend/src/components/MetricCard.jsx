/**
 * MetricCard — displays a single dashboard KPI.
 *
 * Props:
 *   title   {string}  — metric label
 *   value   {string|number}  — formatted metric value
 *   unit    {string}  — optional unit suffix (e.g. "%", "records")
 *   status  {"ok"|"warn"|"fail"|"neutral"}  — drives the accent colour
 *   detail  {string}  — optional sub-line below the value
 */
export default function MetricCard({ title, value, unit = "", status = "neutral", detail }) {
  return (
    <div className={`metric-card metric-card--${status}`}>
      <span className="metric-card__title">{title}</span>
      <span className="metric-card__value">
        {value ?? "—"}
        {unit && <span className="metric-card__unit">{unit}</span>}
      </span>
      {detail && <span className="metric-card__detail">{detail}</span>}
    </div>
  );
}
