import { ChevronLeft, ChevronRight } from "lucide-react";

const btnCls =
  "flex items-center gap-1 border border-[var(--panel-mid)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)] transition-colors hover:border-[var(--accent-blue)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--panel-mid)] disabled:hover:text-[var(--text-muted)]";

const PAGE_SIZES = [10, 20, 50, 100];

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  if (total <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--panel-mid)] px-5 py-3">
      <div className="flex items-center gap-2">
        <span className="mono-nums text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Tổng: {total}
        </span>
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="border border-[var(--panel-mid)] bg-transparent px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] outline-none focus:border-[var(--accent-blue)]"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s} / trang
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button
          className={btnCls}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          title="Trang trước"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Trước
        </button>
        <span className="mono-nums px-2 text-[10px] uppercase tracking-[0.18em] text-[var(--panel-light)]">
          Trang {page} / {Math.max(totalPages, 1)}
        </span>
        <button
          className={btnCls}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          title="Trang sau"
        >
          Sau
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}