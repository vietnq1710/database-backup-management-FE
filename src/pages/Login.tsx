import { useState } from "react";
import { DatabaseBackup, KeyRound, Loader2 } from "lucide-react";
import { keycloakConfigured, loginWithKeycloak } from "@/lib/keycloak";

export default function Login() {
  const [pending, setPending] = useState(false);

  const login = async () => {
    setPending(true);
    await loginWithKeycloak();
    // Nếu cấu hình thiếu, redirect sẽ không xảy ra — nhả nút ra
    setPending(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--panel-dark)]">
      {/* background grid + glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(var(--panel-mid) 1px, transparent 1px), linear-gradient(90deg, var(--panel-mid) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-blue)] opacity-10 blur-[120px]" />

      <div className="relative w-full max-w-sm px-6">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center border border-[var(--panel-mid)] bg-[var(--panel-dark)]">
            <DatabaseBackup className="h-6 w-6 text-[var(--accent-blue)]" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-[0.2em]">Backup Management</h1>
          <p className="text-xs tracking-wide text-[var(--text-muted)]">
            Hệ thống quản lý backup tập trung
          </p>
        </div>

        <div className="panel p-6">
          {!keycloakConfigured ? (
            <p className="border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
              Chưa cấu hình SSO — khai báo VITE_KEYCLOAK_URL, VITE_KEYCLOAK_REALM và
              VITE_KEYCLOAK_CLIENT_ID trong file .env
            </p>
          ) : null}

          <button
            type="button"
            onClick={login}
            disabled={pending || !keycloakConfigured}
            className="flex w-full items-center justify-center gap-2 border border-white bg-white py-2.5 text-[11px] font-black uppercase tracking-[0.25em] text-[var(--panel-dark)] transition-all hover:bg-transparent hover:text-white disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <KeyRound className="h-3.5 w-3.5" />
            )}
            Đăng nhập qua Keycloak
          </button>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-[var(--text-muted)]">
            Bạn sẽ được chuyển tới trang đăng nhập tập trung của keycloak
          </p>
        </div>
      </div>
    </div>
  );
}
