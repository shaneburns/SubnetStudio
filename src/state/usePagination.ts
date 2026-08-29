import { useState, useMemo, useEffect } from 'react';

export interface PaginationResult<T> {
  page:       number;
  totalPages: number;
  pageSize:   number;
  totalItems: number;
  slice:      T[];
  setPage:    (p: number) => void;
  goFirst:    () => void;
  goLast:     () => void;
  goPrev:     () => void;
  goNext:     () => void;
  hasPrev:    boolean;
  hasNext:    boolean;
  /** Start index (0-based, inclusive) of the current page within items */
  startIdx:   number;
}

/**
 * Generic client-side pagination hook.
 * Page numbers are 1-based throughout.
 * Resets to page 1 whenever `items` reference or `pageSize` changes.
 */
export function usePagination<T>(items: T[], pageSize: number): PaginationResult<T> {
  const [page, setPageRaw] = useState(1);

  // Reset to page 1 when the list or page size changes
  useEffect(() => {
    setPageRaw(1);
  }, [items, pageSize]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  const setPage = (p: number) => {
    setPageRaw(Math.max(1, Math.min(p, totalPages)));
  };

  const safePage  = Math.min(page, totalPages);
  const startIdx  = (safePage - 1) * pageSize;
  const slice     = useMemo(
    () => items.slice(startIdx, startIdx + pageSize),
    [items, startIdx, pageSize]
  );

  return {
    page:       safePage,
    totalPages,
    pageSize,
    totalItems: items.length,
    slice,
    setPage,
    goFirst:  () => setPage(1),
    goLast:   () => setPage(totalPages),
    goPrev:   () => setPage(safePage - 1),
    goNext:   () => setPage(safePage + 1),
    hasPrev:  safePage > 1,
    hasNext:  safePage < totalPages,
    startIdx,
  };
}
