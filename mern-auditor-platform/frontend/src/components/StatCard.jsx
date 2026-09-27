/**
 * StatCard — compact horizontal metric card.
 *
 * Layout: [status-accent bar left] [icon] [value + label stacked]
 * Replaces the old ring-SVG MetricCircle with a concise single-row card
 * so the metrics strip stays thin and the audit table gets more focus.
 *
 * Props:
 *   title   {string}                          — metric label
 *   value   {string|number}                   — formatted display value
 *   unit    {string}                          — optional suffix (%, "violations", …)
 *   status  {"ok"|"warn"|"fail"|"neutral"}    — drives accent colour
 *   icon    {ReactNode}                       — icon component element
 */
export default function StatCard({ title, value, unit = "", status = "neutral", icon }) {
  return (
    <div className={`stat-card stat-card--${status}`}>
      {/* Status-coloured left accent bar is done via CSS border-left */}
      <div className="stat-card__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="stat-card__body">
        <div className="stat-card__value">
          {value ?? "—"}
          {unit && <span className="stat-card__unit">{unit}</span>}
        </div>
        <div className="stat-card__title">{title}</div>
      </div>
    </div>
  );
}
