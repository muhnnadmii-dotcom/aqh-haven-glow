import { ChevronRight, ChevronLeft } from "lucide-react";
import { PAGE_SIZES, type PageSize } from "@/lib/finance/use-paginated-query";

type Props = {
  page: number;
  pageCount: number;
  pageSize: PageSize;
  total: number;
  loading?: boolean;
  onPage: (p: number) => void;
  onPageSize: (s: PageSize) => void;
};

export function PaginationBar({ page, pageCount, pageSize, total, loading, onPage, onPageSize }: Props) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px] text-muted-foreground">
      <div>
        {loading ? "…جارٍ التحميل" : `عرض ${from}–${to} من ${total}`}
      </div>
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-1">
          حجم الصفحة
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value) as PageSize)}
            className="bg-background/60 border border-white/10 rounded px-1.5 py-0.5"
          >
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <div className="inline-flex items-center gap-1">
          <button
            onClick={() => onPage(page - 1)}
            disabled={page <= 1 || loading}
            className="p-1 rounded border border-white/10 hover:bg-white/5 disabled:opacity-40"
            aria-label="السابق"
          ><ChevronRight size={14} /></button>
          <span className="tabular-nums px-1.5">{page} / {pageCount}</span>
          <button
            onClick={() => onPage(page + 1)}
            disabled={page >= pageCount || loading}
            className="p-1 rounded border border-white/10 hover:bg-white/5 disabled:opacity-40"
            aria-label="التالي"
          ><ChevronLeft size={14} /></button>
        </div>
      </div>
    </div>
  );
}
