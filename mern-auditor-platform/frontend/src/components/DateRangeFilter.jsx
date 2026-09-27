/**
 * DateRangeFilter — compact from/to date picker bar for the audit log.
 *
 * Props:
 *   dateFrom  {string}                   — ISO date string "YYYY-MM-DD" or ""
 *   dateTo    {string}                   — ISO date string "YYYY-MM-DD" or ""
 *   onChange  {(from: string, to: string) => void}  — called on every change
 */
import { IconX, IconFilter } from "./Icons";

export default function DateRangeFilter({ dateFrom, dateTo, onChange }) {
  function handleFrom(e) {
    onChange(e.target.value, dateTo);
  }

  function handleTo(e) {
    onChange(dateFrom, e.target.value);
  }

  function handleClear() {
    onChange("", "");
  }

  const hasFilter = dateFrom || dateTo;

  return (
    <div className="date-filter">
      <span className="date-filter__label"><IconFilter size={12} /> Filter by date:</span>

      <label className="date-filter__group">
        <span className="date-filter__field-label">From</span>
        <input
          type="date"
          className="date-filter__input"
          value={dateFrom}
          onChange={handleFrom}
          max={dateTo || undefined}
        />
      </label>

      <label className="date-filter__group">
        <span className="date-filter__field-label">To</span>
        <input
          type="date"
          className="date-filter__input"
          value={dateTo}
          onChange={handleTo}
          min={dateFrom || undefined}
        />
      </label>

      {hasFilter && (
        <button className="date-filter__clear" onClick={handleClear} title="Clear date filter">
          <IconX size={13} /> Clear
        </button>
      )}
    </div>
  );
}
