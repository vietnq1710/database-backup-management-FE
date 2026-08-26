import { useState } from "react";
import AuthLayout from "@/components/AuthLayout";
import { PageHeader, Panel, StatusBadge, TableStateRow } from "@/components/common";
import { downloadRunFile, useHistoryRuns, useBackupJobLabels, useUsers } from "@/api/hooks";
import { formatBytes, formatDateTime, formatDuration, shortId } from "@/lib/format";
import type { BackupRun } from "@/types/api";
import { Download, FileText, Loader2, X } from "lucide-react";
import { toast } from "sonner";

type Run = BackupRun;

function LogDialog({
  run,
  label,
  onClose,
}: {
  run: Run;
  label: string;
  onClose: () => void;
}) {
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
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <pre className="mono-nums flex-1 overflow-auto whitespace-pre-wrap break-words p-5 text-xs leading-relaxed text-[var(--panel-light)]">
          {run.log || "(không có log)"}
        </pre>
      </div>
    </div>
  );
}

function HistoryContent() {
  const [kind, setKind] = useState<"all" | "backup" | "sync">("all");
  const [status, setStatus] = useState<"all" | "success" | "failed" | "running">("all");
  const [logRun, setLogRun] = useState<Run | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const runs = useHistoryRuns({ kind, status });
  // backup-history chỉ có backupJobId — join tên job phía FE;
  // run sync tự mang sẵn jobName ("config nguồn → config đích")
  const jobLabels = useBackupJobLabels();
  const jobLabel = (r: Run) =>
    r.jobName ??
    (r.jobId ? (jobLabels.get(r.jobId) ?? shortId(r.jobId)) : null) ??
    "—";

  // triggeredBy của run sync là _id user — join tên qua /user/many
  const users = useUsers();
  const userById = new Map((users.data ?? []).map((u) => [u.id, u]));
  const triggerLabel = (r: Run): string | null => {
    if (!r.triggeredBy) return null;
    const u = userById.get(r.triggeredBy);
    return u?.fullname ?? u?.username ?? u?.email ?? shortId(r.triggeredBy);
  };

  const download = async (run: Run) => {
    setDownloadingId(run.id);
    try {
      const { blob, fileName } = await downloadRunFile(
        run.id,
        run.fileName ?? "backup.sql",
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Đã tải ${fileName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được file");
    } finally {
      setDownloadingId(null);
    }
  };

  const filterBtn = (active: boolean) =>
    `px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] transition-colors ${
      active
        ? "bg-white text-[var(--panel-dark)]"
        : "text-[var(--text-muted)] hover:text-white"
    }`;

  // Run sync không có file/dung lượng/thời lượng đáng kể — ẩn 3 cột này ở tab sync
  const showFileCols = kind !== "sync";

  return (
    <>
      <PageHeader
        title="Backup History"
        sub="Lịch sử chạy job, xem log và tải file backup từ R2 Storage CloudFlare"
      />

      <Panel
        title={`${runs.data?.length ?? 0} runs`}
        right={
          <div className="flex items-center gap-1">
            <div className="flex border border-[var(--panel-mid)]">
              {(["all", "backup", "sync"] as const).map((k) => (
                <button key={k} className={filterBtn(kind === k)} onClick={() => setKind(k)}>
                  {k === "all" ? "Tất cả" : k}
                </button>
              ))}
            </div>
            <div className="flex border border-[var(--panel-mid)]">
              {(["all", "success", "failed", "running"] as const).map((s) => (
                <button key={s} className={filterBtn(status === s)} onClick={() => setStatus(s)}>
                  {s === "all" ? "Mọi trạng thái" : s}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--panel-mid)] text-left">
                <th className="panel-label px-5 py-3 font-extrabold">Thời gian chạy</th>
                <th className="panel-label px-5 py-3 font-extrabold">Job</th>
                <th className="panel-label px-5 py-3 font-extrabold">Loại</th>
                <th className="panel-label px-5 py-3 font-extrabold">Server / DB</th>
                {showFileCols && (
                  <>
                    <th className="panel-label px-5 py-3 font-extrabold">File</th>
                    <th className="panel-label px-5 py-3 text-right font-extrabold">Dung lượng</th>
                    <th className="panel-label px-5 py-3 text-right font-extrabold">Thời lượng</th>
                  </>
                )}
                <th className="panel-label px-5 py-3 font-extrabold">Trạng thái</th>
                <th className="panel-label px-5 py-3 font-extrabold"></th>
              </tr>
            </thead>
            <tbody>
              {(runs.data ?? []).map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[var(--panel-mid)]/50 last:border-0 hover:bg-[var(--panel-mid)]/20"
                >
                  <td className="mono-nums px-5 py-3 text-xs text-[var(--panel-light)]">
                    {formatDateTime(r.startedAt)}
                  </td>
                  <td className="px-5 py-3 font-semibold">
                    {jobLabel(r)}
                    {triggerLabel(r) && (
                      <div
                        className="text-[10px] font-normal text-[var(--text-muted)]"
                        title={`Người tạo: ${r.triggeredBy}`}
                      >
                        bởi {triggerLabel(r)}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`mono-nums border px-1.5 py-0.5 text-[10px] ${
                        r.kind === "backup"
                          ? "border-[var(--accent-blue)]/50 text-[var(--accent-blue)]"
                          : "border-[var(--accent-green)]/50 text-[var(--accent-green)]"
                      }`}
                    >
                      {r.kind.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-xs">{r.serverName}</div>
                    <div className="mono-nums text-[10px] text-[var(--text-muted)]">
                      {r.databaseName}
                    </div>
                  </td>
                  {showFileCols && (
                    <>
                      <td className="mono-nums max-w-[200px] truncate px-5 py-3 text-xs text-[var(--text-muted)]">
                        {r.fileName ?? "—"}
                      </td>
                      <td className="mono-nums px-5 py-3 text-right text-xs">
                        {r.sizeBytes ? formatBytes(r.sizeBytes) : "—"}
                      </td>
                      <td className="mono-nums px-5 py-3 text-right text-xs text-[var(--panel-light)]">
                        {r.durationMs != null ? formatDuration(r.durationMs) : "—"}
                      </td>
                    </>
                  )}
                  <td className="px-5 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1.5">
                      <button
                        title="Xem log"
                        onClick={() => setLogRun(r as Run)}
                        className="flex h-8 w-8 items-center justify-center border border-[var(--panel-mid)] text-[var(--panel-light)] transition-colors hover:border-[var(--accent-blue)] hover:text-white"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                      {r.kind === "backup" && (
                        <button
                          title={r.status === "success" ? "Tải file backup" : "Không có file để tải"}
                          disabled={r.status !== "success" || downloadingId === r.id}
                          onClick={() => download(r as Run)}
                          className="flex h-8 w-8 items-center justify-center border border-[var(--panel-mid)] text-[var(--panel-light)] transition-colors hover:border-[var(--accent-green)] hover:text-white disabled:opacity-30"
                        >
                          {downloadingId === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(runs.isLoading || runs.data?.length === 0) && (
                <TableStateRow
                  colSpan={showFileCols ? 9 : 6}
                  loading={runs.isLoading}
                  empty="Không có run nào khớp bộ lọc"
                />
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {logRun && (
        <LogDialog
          run={logRun}
          label={jobLabel(logRun)}
          onClose={() => setLogRun(null)}
        />
      )}
    </>
  );
}

export default function History() {
  return (
    <AuthLayout>
      <HistoryContent />
    </AuthLayout>
  );
}
