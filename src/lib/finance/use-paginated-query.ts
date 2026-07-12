import { useCallback, useEffect, useRef, useState } from "react";

export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 50;

export type FetchResult<T> = { rows: T[]; total: number };

/**
 * Server-side pagination hook.
 * - Keeps previous rows visible while the next page loads (no flicker).
 * - Requests count and page in a single fetch call; caller is responsible for
 *   sending filters/sort/range to the server.
 */
export function usePaginatedQuery<T>(
  fetcher: (args: { page: number; pageSize: PageSize; signal: AbortSignal }) => Promise<FetchResult<T>>,
  deps: any[],
  initialPageSize: PageSize = DEFAULT_PAGE_SIZE,
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(initialPageSize);
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seq = useRef(0);

  // Reset page when filter deps change (keep pageSize).
  const depsKey = JSON.stringify(deps);
  const prevKey = useRef(depsKey);
  useEffect(() => {
    if (prevKey.current !== depsKey) {
      prevKey.current = depsKey;
      setPage(1);
    }
  }, [depsKey]);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher({ page, pageSize, signal: ctrl.signal });
      if (my !== seq.current) return;
      setRows(res.rows);
      setTotal(res.total);
    } catch (e: any) {
      if (ctrl.signal.aborted) return;
      setError(e?.message ?? "خطأ");
    } finally {
      if (my === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, depsKey]);

  useEffect(() => { load(); return () => abortRef.current?.abort(); }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return {
    rows, total, page, pageSize, pageCount, loading, error,
    setPage: (p: number) => setPage(Math.min(Math.max(1, p), pageCount)),
    setPageSize: (s: PageSize) => { setPageSize(s); setPage(1); },
    reload: load,
  };
}
