/**
 * MetricCircle — animated SVG radial-ring stat card.
 *
 * Props:
 *   title   {string}         — metric label (uppercase, small)
 *   value   {string|number}  — formatted display value
 *   unit    {string}         — optional suffix (%, "violations", etc.)
 *   status  {"ok"|"warn"|"fail"|"neutral"}  — drives ring + border color
 *   detail  {string}         — sub-text description
 *   percent {number}         — 0–100, controls ring fill arc
 */

const RADIUS  = 38;
const CIRCUM  = 2 * Math.PI * RADIUS; // ≈ 238.76

export default function MetricCircle({
  title,
  value,
  unit    = "",
  status  = "neutral",
  detail,
  percent = 0,
}) {
  const clampedPct = Math.min(100, Math.max(0, percent));
  // offset = full circumference minus the filled arc
  const offset     = CIRCUM * (1 - clampedPct / 100);

  return (
    <div className={`metric-circle metric-circle--${status}`}>
      {/* SVG ring */}
      <div className="metric-circle__ring-wrap">
        <svg
          className="metric-circle__svg"
          viewBox="0 0 90 90"
          aria-hidden="true"
        >
          {/* Track (background ring) */}
          <circle
            className="metric-circle__track"
            cx="45" cy="45"
            r={RADIUS}
            fill="none"
            strokeWidth="7"
          />
          {/* Fill arc */}
          <circle
            className={`metric-circle__arc metric-circle__arc--${status}`}
            cx="45" cy="45"
            r={RADIUS}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRCUM}
            strokeDashoffset={offset}
            style={{ "--offset": offset, "--circum": CIRCUM }}
          />
        </svg>

        {/* Center text overlay */}
        <div className="metric-circle__center">
          <span className="metric-circle__value">{value}</span>
          {unit && <span className="metric-circle__unit">{unit}</span>}
        </div>
      </div>

      {/* Label + description */}
      <p className="metric-circle__title">{title}</p>
      {detail && <p className="metric-circle__detail">{detail}</p>}
    </div>
  );
}
