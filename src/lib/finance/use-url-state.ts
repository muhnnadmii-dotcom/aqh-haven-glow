import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

/**
 * Small hook that mirrors a useState<string> but persists the value in the
 * current route's URL search params (TanStack Router).
 *
 * - Reads initial value from URL on mount (so back-navigation restores state).
 * - Writes to URL on change with `replace: true` (no history spam).
 * - Optional debounce for text inputs.
 * - Empty / default values are OMITTED from the URL to keep it clean.
 * - Any filter change resets `page` (unless the key itself is `page`).
 */
export function useUrlState(
  key: string,
  defaultValue: string,
  opts?: { debounceMs?: number; resetPageOnChange?: boolean },
): [string, (v: string) => void] {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, any>;
  const debounceMs = opts?.debounceMs ?? 0;
  const resetPage = opts?.resetPageOnChange ?? key !== "page";

  const [value, setValue] = useState<string>(() => {
    const v = search?.[key];
    return v == null || v === "" ? defaultValue : String(v);
  });

  const first = useRef(true);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const write = () => {
      navigateRef.current({
        to: ".",
        search: (prev: any) => {
          const next: Record<string, any> = { ...(prev ?? {}) };
          if (!value || value === defaultValue) delete next[key];
          else next[key] = value;
          if (resetPage) delete next.page;
          return next;
        },
        replace: true,
      });
    };
    if (debounceMs > 0) {
      const t = setTimeout(write, debounceMs);
      return () => clearTimeout(t);
    }
    write();
    return;
  }, [value, key, defaultValue, debounceMs, resetPage]);

  return [value, setValue];
}

/** Read the initial page number from the URL (for hooks that manage their own page state). */
export function useInitialUrlPage(): number {
  const search = useSearch({ strict: false }) as Record<string, any>;
  const raw = Number(search?.page);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
}

/** Sync a current page value to the URL (?page=N, omitted when N === 1). */
export function useSyncPageToUrl(page: number) {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    navigateRef.current({
      to: ".",
      search: (prev: any) => {
        const next: Record<string, any> = { ...(prev ?? {}) };
        if (page > 1) next.page = page;
        else delete next.page;
        return next;
      },
      replace: true,
    });
  }, [page]);
}
