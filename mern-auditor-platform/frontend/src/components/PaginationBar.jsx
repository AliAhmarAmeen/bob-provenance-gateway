/**
 * PaginationBar — prev / page-numbers / next navigation.
 *
 * Props:
 *   page          {number}  — 0-based current page
 *   total         {number}  — total record count
 *   pageSize      {number}  — records per page (default 20)
 *   onPageChange  {(page: number) => void}
 */
import { IconChevronLeft, IconChevronRight } from "./Icons";

export default function PaginationBar({ page, total, pageSize = 20, onPageChange }) {
  const totalPages = Math.ceil(total / pageSize);

  if (totalPages <= 1) return null;

  // Build a window of up to 5 page buttons centered on the current page
  const windowSize = 5;
  let start = Math.max(0, page - Math.floor(windowSize / 2));
  let end   = start + windowSize;
  if (end > totalPages) {
    end   = totalPages;
    start = Math.max(0, end - windowSize);
  }

  const pages = [];
  for (let i = start; i < end; i++) pages.push(i);

  return (
    <nav className="pagination" aria-label="Audit log pagination">
      <button
        className="pagination__btn pagination__btn--nav"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        aria-label="Previous page"
      >
        <IconChevronLeft size={14} /> Prev
      </button>

      {start > 0 && (
        <>
          <button className="pagination__btn" onClick={() => onPageChange(0)}>1</button>
          {start > 1 && <span className="pagination__ellipsis">…</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          className={`pagination__btn${p === page ? " pagination__btn--active" : ""}`}
          onClick={() => onPageChange(p)}
          aria-current={p === page ? "page" : undefined}
        >
          {p + 1}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="pagination__ellipsis">…</span>}
          <button className="pagination__btn" onClick={() => onPageChange(totalPages - 1)}>
            {totalPages}
          </button>
        </>
      )}

      <button
        className="pagination__btn pagination__btn--nav"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages - 1}
        aria-label="Next page"
      >
        Next <IconChevronRight size={14} />
      </button>

      <span className="pagination__info">
        Page {page + 1} of {totalPages}
      </span>
    </nav>
  );
}
