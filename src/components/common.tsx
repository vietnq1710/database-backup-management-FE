import type { ReactNode } from "react";
import { Inbox, LayoutGrid, LayoutList } from "lucide-react";

export function StatusBadge({ status }: { status?: string | null }) {
  const styles: Record<string, { dot: string; text: string; label: string }> = {
    success: { dot: "bg-[var(--accent-green)]", text: "text-[var(--accent-green)]", label: "SUCCESS" },
    failed: { dot: "bg-[var(--accent-red)]", text: "text-[var(--accent-red)]", label: "FAILED" },
    running: { dot: "bg-[var(--accent-blue)] animate-pulse", text: "text-[var(--accent-blue)]", label: "RUNNING" },

    pending: { dot: "bg-[var(--accent-yellow)]", text: "text-[var(--accent-yellow)]", label: "PENDING" },
    active: { dot: "bg-[var(--accent-green)]", text: "text-[var(--accent-green)]", label: "ACTIVE" },
    paused: { dot: "bg-[var(--accent-yellow)]", text: "text-[var(--accent-yellow)]", label: "PAUSED" },
    online: { dot: "bg-[var(--accent-green)]", text: "text-[var(--accent-green)]", label: "ONLINE" },
    offline: { dot: "bg-[var(--accent-red)]", text: "text-[var(--accent-red)]", label: "OFFLINE" },
    degraded: { dot: "bg-[var(--accent-yellow)]", text: "text-[var(--accent-yellow)]", label: "DEGRADED" },
  };
  let s = status != null ? styles[status] : undefined;
  if (!s && status != null) s = styles[status.toLowerCase()];
  if (!s)
    s =
      status == null
        ? { dot: "bg-[var(--foreground)]/40", text: "text-[var(--foreground)]/60", label: "—" }
        : { dot: "bg-[var(--foreground)]", text: "text-[var(--foreground)]", label: String(status).toUpperCase() };
  return (
    <span className={`inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.15em] ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-[var(--panel-mid)] px-5 py-3">
          <span className="panel-label">{title}</span>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function ViewToggle({
  value,
  onChange,
}: {
  value: "table" | "grid";
  onChange: (v: "table" | "grid") => void;
}) {
  return (
    <div className="relative inline-grid grid-cols-2 border border-[var(--panel-mid)]">
      <span
        className={
          "absolute inset-y-0 left-0 w-1/2 bg-[var(--accent-blue)] transition-transform duration-200 " +
          (value === "grid" ? "translate-x-full" : "translate-x-0")
        }
      />
      {(
        [
          { key: "table", icon: LayoutList },
          { key: "grid", icon: LayoutGrid },
        ] as const
      ).map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => onChange(v.key)}
          className={
            "relative z-10 flex items-center gap-1.5 px-3 py-1.5 transition-colors " +
            (value === v.key
              ? "text-white"
              : "text-[var(--text-muted)] hover:text-[var(--foreground)]")
          }
        >
          <v.icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight uppercase">{title}</h1>
        {sub && <p className="mt-1 text-sm text-[var(--text-muted)]">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  message,
  hint,
}: {
  icon?: typeof Inbox;
  message: string;
  hint?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-5 py-12 text-center">
      <Icon className="h-7 w-7 text-[var(--text-muted)]" />
      <p className="text-sm font-semibold text-[var(--panel-light)]">{message}</p>
      {hint && <p className="max-w-xs text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

// Dòng trạng thái của bảng: hiện "Đang tải..." khi fetch, hoặc thông báo khi trống
export function TableStateRow({
  colSpan,
  loading,
  empty,
}: {
  colSpan: number;
  loading: boolean;
  empty: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">
        {loading ? "Đang tải dữ liệu..." : empty}
      </td>
    </tr>
  );
}
