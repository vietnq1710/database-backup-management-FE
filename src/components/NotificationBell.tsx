import { useRef, useState } from "react";
import { useNotifications } from "./NotificationProvider";
import { Bell, X } from "lucide-react";

export function NotificationBell() {
  const { notifications, unreadCount, dismiss, clearAll, markAllRead } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    if (!open) markAllRead();
    setOpen((prev) => !prev);
  };

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--panel-mid)]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4 text-[var(--text-muted)]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent-red)] px-1 text-[9px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            className="absolute right-0 top-full z-50 mt-2 w-80 border border-[var(--panel-mid)] bg-[var(--panel-dark)] shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--panel-mid)] px-3 py-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Thông báo
              </span>
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-red)]"
                >
                  Xóa tất cả
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-[var(--text-muted)]">
                  Chưa có thông báo
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="group flex items-start gap-2 border-b border-[var(--panel-mid)]/50 px-3 py-2.5 last:border-0 hover:bg-[var(--panel-mid)]/20"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-relaxed text-[var(--panel-light)]">
                        {n.text}
                      </p>
                      <p className="mt-1 text-[9px] text-[var(--text-muted)]">
                        {new Date(n.createdAt).toLocaleTimeString("vi-VN")}
                      </p>
                    </div>
                    <button
                      onClick={() => dismiss(n.id)}
                      className="mt-0.5 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                      aria-label="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
