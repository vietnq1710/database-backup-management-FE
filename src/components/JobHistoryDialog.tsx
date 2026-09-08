import { useState } from "react";
import { StatusBadge, TableStateRow } from "@/components/common";
import { LogDialog } from "@/components/LogDialog";
import { downloadRunFile, useHistoryRuns, useBackupJobLabels } from "@/api/hooks";
import { formatBytes, formatDateTime, formatDuration, shortId } from "@/lib/format";
import type { BackupJob, BackupRun } from "@/types/api";
import { Download, FileText, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "@/components/NotificationProvider";

type Run = BackupRun;

const thCls = "panel-label px-5 py-3 text-left font-extrabold";
const tdCls = "px-5 py-3";

export function JobHistoryDialog({
  job,
  onClose,
}: {
  job: BackupJob;
  onClose: () => void;
}) {
  const [logRun, setLogRun] = useState<Run | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { addNotification } = useNotifications();

  const runs = useHistoryRuns({ kind: "backup" });
  const jobLabels = useBackupJobLabels();
  // Chỉ giữ các run thuộc đúng backup job này (backup history lưu backupJobId)
  const rows = (runs.data ?? []).filter((r) => r.jobId === job.id);
  const jobLabel = jobLabels.get(job.id) ?? shortId(job.id);

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
      addNotification(`Đã tải ${fileName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được file");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="panel flex max-h-[85vh] w-full max-w-4xl flex-col">
        <div className="flex items-center justify-between border-b border-[var(--panel-mid)] px-5 py-3">
          <div>
            <span className="panel-label">Lịch sử chạy — {jobLabel}</span>
            <div className="mono-nums mt-1 text-[10px] text-[var(--text-muted)]">
              {job.databaseConfigId}
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--foreground)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--panel-mid)] text-left">
                <th className={thCls}>Thời gian chạy</th>
                <th className={thCls}>Server / DB</th>
                <th className={thCls}>File</th>
                <th className={thCls + " text-right"}>Dung lượng</th>
                <th className={thCls + " text-right"}>Thời lượng</th>
                <th className={thCls}>Trạng thái</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[var(--panel-mid)]/50 last:border-0 hover:bg-[var(--panel-mid)]/20"
                >
                  <td className={tdCls + " mono-nums text-xs text-[var(--panel-light)]"}>
                    {formatDateTime(r.startedAt)}
                  </td>
                  <td className={tdCls}>
                    <div className="text-xs">{r.serverName}</div>
                    <div className="mono-nums text-[10px] text-[var(--text-muted)]">
                      {r.databaseName}
                    </div>
                  </td>
                  <td className={tdCls + " mono-nums max-w-[200px] truncate text-xs text-[var(--text-muted)]"}>
                    {r.fileName ?? "—"}
                  </td>
                  <td className={tdCls + " mono-nums text-right text-xs"}>
                    {r.sizeBytes != null ? formatBytes(r.sizeBytes) : "—"}
                  </td>
                  <td className={tdCls + " mono-nums text-right text-xs text-[var(--panel-light)]"}>
                    {r.durationMs != null ? formatDuration(r.durationMs) : "—"}
                  </td>
                  <td className={tdCls}>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className={tdCls}>
                    <div className="flex gap-1.5">
                      <button
                        title="Xem log"
                        onClick={() => setLogRun(r)}
                        className="flex h-8 w-8 items-center justify-center border border-[var(--panel-mid)] text-[var(--panel-light)] transition-colors hover:border-[var(--accent-blue)] hover:text-[var(--foreground)]"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title={r.status === "success" ? "Tải file backup" : "Không có file để tải"}
                        disabled={r.status !== "success" || downloadingId === r.id}
                        onClick={() => download(r)}
                        className="flex h-8 w-8 items-center justify-center border border-[var(--panel-mid)] text-[var(--panel-light)] transition-colors hover:border-[var(--accent-green)] hover:text-[var(--foreground)] disabled:opacity-30"
                      >
                        {downloadingId === r.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(runs.isLoading || rows.length === 0) && (
                <TableStateRow
                  colSpan={7}
                  loading={runs.isLoading}
                  empty="Chưa có lần chạy nào cho job này"
                />
              )}
            </tbody>
          </table>
        </div>
      </div>

      {logRun && (
        <LogDialog
          run={logRun}
          label={jobLabel}
          onClose={() => setLogRun(null)}
        />
      )}
    </div>
  );
}
