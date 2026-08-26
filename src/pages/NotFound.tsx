import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--panel-dark)]">
      <span className="mono-nums text-6xl font-black tracking-tight">404</span>
      <p className="text-sm text-[var(--text-muted)]">Trang không tồn tại</p>
      <Link
        to="/"
        className="border border-white px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.25em] transition-colors hover:bg-white hover:text-[var(--panel-dark)]"
      >
        Về Dashboard
      </Link>
    </div>
  );
}
