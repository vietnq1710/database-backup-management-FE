import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, DatabaseBackup, Loader2 } from "lucide-react";
import { handleCallback } from "@/lib/keycloak";

export default function AuthCallback() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // URL không có code/error → quay về từ logout của Keycloak
    // (post_logout_redirect_uri=/callback) → về trang đăng nhập luôn
    const params = new URLSearchParams(window.location.search);
    if (!params.has("code") && !params.has("error")) {
      window.history.replaceState({}, "", "/login");
      navigate("/login", { replace: true });
      return;
    }

    handleCallback()
      .then(async () => {
        await queryClient.invalidateQueries();
        navigate("/", { replace: true });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Đăng nhập SSO thất bại");
      });
  }, [navigate, queryClient]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--panel-dark)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(var(--panel-mid) 1px, transparent 1px), linear-gradient(90deg, var(--panel-mid) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative flex w-full max-w-sm flex-col items-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center border border-[var(--panel-mid)] bg-[var(--panel-dark)]">
          <DatabaseBackup className="h-6 w-6 text-[var(--accent-blue)]" />
        </div>

        {error ? (
          <>
            <AlertTriangle className="h-5 w-5 text-[var(--accent-red)]" />
            <p className="text-sm text-[var(--accent-red)]">{error}</p>
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className="border border-white bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.25em] text-[var(--panel-dark)] transition-all hover:bg-transparent hover:text-white"
            >
              Về trang đăng nhập
            </button>
          </>
        ) : (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent-blue)]" />
            <p className="text-xs tracking-wide text-[var(--text-muted)]">
              Đang hoàn tất đăng nhập...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
