import type { BackupRun } from "@/types/api";
import { formatDateTime } from "@/lib/format";
import { Download, X } from "lucide-react";

type Run = BackupRun;

function safeName(v: string | null | undefined, fallback: string): string {
  return v?.trim() ? v.trim().replace(/[^a-zA-Z0-9._-]+/g, "_") : fallback;
}

export function LogDialog({
  run,
  label,
  onClose,
}: {
  run: Run;
  label: string;
  onClose: () => void;
}) {
  const downloadLog = () => {
    const sep = "─".repeat(40);
    const header = [
      `# Run log: ${label}`,
      `# id: ${run.id}`,
      `# server: ${run.serverName ?? "—"}`,
      `# database: ${run.databaseName ?? "—"}`,
      `# started: ${formatDateTime(run.startedAt) ?? "—"}`,
      `# status: ${run.status}`,
    ].join("\n");
    const stdout = run.stdout?.trim() ? `[STDOUT]\n${run.stdout}` : "";
    const stderr = run.stderr?.trim() ? `[STDERR]\n${run.stderr}` : "";
    const text = [header, sep, stdout, stderr].filter(Boolean).join("\n\n");

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const db = safeName(run.databaseName, "run");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `${safeName(run.serverName, "log")}_${db}_${ts}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="panel flex max-h-[80vh] w-full max-w-2xl flex-col">
        <div className="flex items-center justify-between border-b border-[var(--panel-mid)] px-5 py-3">
          <div>
            <span className="panel-label">Run Log — {label}</span>
            <div className="mono-nums mt-1 text-[10px] text-[var(--text-muted)]">
              {run.serverName} · {run.databaseName} · {formatDateTime(run.startedAt)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadLog}
              className="flex items-center gap-2 border border-[var(--panel-mid)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] transition-colors hover:border-[var(--accent-green)] hover:text-[var(--foreground)]"
            >
              <Download className="h-3.5 w-3.5" />
              Tải log
            </button>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--foreground)]">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <pre className="mono-nums flex-1 overflow-auto whitespace-pre-wrap break-words p-5 text-xs leading-relaxed text-[var(--panel-light)]">
          {run.log || "(không có log)"}
        </pre>
      </div>
    </div>
  );
}
