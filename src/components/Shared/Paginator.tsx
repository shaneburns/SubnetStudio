import React from 'react';

interface PaginatorProps {
  page:       number;
  totalPages: number;
  totalItems: number;
  pageSize:   number;
  startIdx:   number;
  setPage:    (p: number) => void;
  /** Extra class applied to the root element for layout tweaks per context */
  className?: string;
  /** Label shown in the count summary, e.g. "blocks" or "rows" */
  itemLabel?: string;
}

/**
 * Compact pagination control bar.
 * Shows: «  ‹  1 … 4 [5] 6 … 12  ›  »  ·  21–25 of 60 rows
 * Returns null when totalPages ≤ 1 (nothing to paginate).
 */
export const Paginator: React.FC<PaginatorProps> = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  startIdx,
  setPage,
  className = '',
  itemLabel = 'items',
}) => {
  if (totalPages <= 1) return null;

  const rangeStart = startIdx + 1;
  const rangeEnd   = Math.min(startIdx + pageSize, totalItems);

  // Build window: always show first, last, current ±1, and ellipsis gaps
  const buildWindow = (): (number | '…')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const show = new Set<number>([1, totalPages, page, page - 1, page + 1].filter(p => p >= 1 && p <= totalPages));
    const sorted = [...show].sort((a, b) => a - b);
    const result: (number | '…')[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('…');
      result.push(sorted[i]);
    }
    return result;
  };

  const window = buildWindow();

  return (
    <div className={`paginator ${className}`}>
      {/* Range info */}
      <span className="paginator__info mono">
        {rangeStart}–{rangeEnd}
        <span className="paginator__of"> of {totalItems.toLocaleString()} {itemLabel}</span>
      </span>

      {/* Navigation buttons */}
      <div className="paginator__nav">
        <button
          className="paginator__btn"
          onClick={() => setPage(1)}
          disabled={page === 1}
          title="First page"
          aria-label="First page"
        >«</button>

        <button
          className="paginator__btn"
          onClick={() => setPage(page - 1)}
          disabled={page === 1}
          title="Previous page"
          aria-label="Previous page"
        >‹</button>

        {window.map((p, i) =>
          p === '…'
            ? <span key={`ell-${i}`} className="paginator__ellipsis">…</span>
            : <button
                key={p}
                className={`paginator__btn paginator__btn--page${p === page ? ' active' : ''}`}
                onClick={() => setPage(p as number)}
                aria-current={p === page ? 'page' : undefined}
              >{p}</button>
        )}

        <button
          className="paginator__btn"
          onClick={() => setPage(page + 1)}
          disabled={page === totalPages}
          title="Next page"
          aria-label="Next page"
        >›</button>

        <button
          className="paginator__btn"
          onClick={() => setPage(totalPages)}
          disabled={page === totalPages}
          title="Last page"
          aria-label="Last page"
        >»</button>
      </div>
    </div>
  );
};
