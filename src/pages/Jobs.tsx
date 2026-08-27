import { useState, type FormEvent } from "react";
import AuthLayout from "@/components/AuthLayout";
import { PageHeader, Panel, StatusBadge, TableStateRow } from "@/components/common";
import {
  useBackupJobs,
  useCreateBackupJob,
  useCreateSyncJob,
  useDatabaseConfigs,
  useRemoveJob,
  useSyncJobs,
  useToggleJob,
  useUpdateBackupJob,
} from "@/api/hooks";
import { cronLabel, formatDateTime, shortId } from "@/lib/format";
import { CRON_PRESETS } from "@/lib/cron-presets";
import {
  DatabaseBackup,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router";
import type { BackupJob } from "@/types/api";
import { useNotifications } from "@/components/NotificationProvider";

const inputCls =
  "w-full border border-[var(--panel-mid)] bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-blue)] placeholder:text-[var(--text-muted)]";
const selectCls = inputCls + " appearance-none";

const submitBtnCls =
  "flex w-full items-center justify-center gap-2 border border-white bg-white py-2.5 text-[11px] font-black uppercase tracking-[0.25em] text-[var(--panel-dark)] transition-all hover:bg-transparent hover:text-white disabled:opacity-50";

function DialogHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h2 className="text-sm font-black uppercase tracking-[0.2em]">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        className="text-[var(--text-muted)] hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mb-4 border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
      {message}
    </p>
  );
}

// POST /backup-job + PUT /backup-job/:id (cùng DTO bắt buộc):
// databaseConfigId + isActive + retentionDays
// và MỘT TRONG HAI cronExpressionPreset (key enum BE) | cronExpressionCustom
function BackupJobDialog({
  job,
  onClose,
}: {
  job?: BackupJob;
  onClose: () => void;
}) {
  const configs = useDatabaseConfigs();
  const editing = job !== undefined;
  // cron hiện tại khớp preset nào thì chọn preset đó, không thì chuyển custom
  const matchedPreset = job
    ? CRON_PRESETS.find((p) => p.expr === job.cronExpression)
    : undefined;
  const [configId, setConfigId] = useState(job?.databaseConfigId ?? "");
  const [retentionDays, setRetentionDays] = useState(job?.retentionDays ?? 7);
  const [mode, setMode] = useState<"preset" | "custom">(
    job && !matchedPreset ? "custom" : "preset",
  );
  const [presetKey, setPresetKey] = useState(matchedPreset?.key ?? "EVERY_DAY_AT_2AM");
  const [customCron, setCustomCron] = useState(
    job && !matchedPreset ? (job.cronExpression ?? "") : "",
  );
  const [isActive, setIsActive] = useState(job?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const createBackup = useCreateBackupJob();
  const updateBackup = useUpdateBackupJob();
  const { addNotification } = useNotifications();
  const pending = createBackup.isPending || updateBackup.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!configId.trim()) return setError("Nhập databaseConfigId");
    if (mode === "custom" && !customCron.trim())
      return setError("Nhập biểu thức cron tùy chỉnh");
    // class-validator bên BE từ chối mọi giá trị không phải number hợp lệ
    // (NaN khi JSON.stringify thành null) — chặn và ép kiểu số nguyên >= 1
    const days = Math.floor(Number(retentionDays));
    if (!Number.isFinite(days) || days < 1)
      return setError("Retention phải là số nguyên >= 1 ngày");
    const payload = {
      databaseConfigId: configId.trim(),
      isActive,
      retentionDays: days,
      ...(mode === "preset"
        ? { cronExpressionPreset: presetKey }
        : { cronExpressionCustom: customCron.trim() }),
    };
    const opts = {
      onSuccess: () => {
        toast.success(editing ? "Đã cập nhật backup job" : "Đã tạo backup job");
        addNotification(editing ? "Đã cập nhật backup job" : "Đã tạo backup job mới");
        onClose();
      },
      onError: (err: Error) => setError(err.message),
    };
    if (editing) updateBackup.mutate({ id: job.id, payload }, opts);
    else createBackup.mutate(payload, opts);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="panel w-full max-w-md p-6">
        <DialogHeader
          title={editing ? "Sửa Backup Job" : "Tạo Backup Job"}
          onClose={onClose}
        />

        <label className="panel-label mb-1.5 block">Database Config</label>
        <select
          className={selectCls + " mb-4"}
          value={configId}
          onChange={(e) => setConfigId(e.target.value)}
          required
        >
          <option value="" disabled>
            — chọn database config —
          </option>
          {(configs.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.configCode ?? shortId(c.id)} — {c.databaseName ?? "?"} @{" "}
              {c.host ?? "?"}
              {c.port ? `:${c.port}` : ""}
            </option>
          ))}
        </select>

        <label className="panel-label mb-1.5 block">Retention (ngày)</label>
        <input
          type="number"
          min={1}
          step={1}
          max={3650}
          className={inputCls + " mb-4"}
          value={retentionDays}
          onChange={(e) => setRetentionDays(e.target.valueAsNumber)}
          required
        />

        <label className="panel-label mb-1.5 block">Lịch chạy</label>
        <div className="mb-2 grid grid-cols-2 gap-2">
          {(["preset", "custom"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                "border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors " +
                (mode === m
                  ? "border-[var(--accent-blue)] bg-[var(--accent-blue)]/15 text-white"
                  : "border-[var(--panel-mid)] text-[var(--text-muted)] hover:text-white")
              }
            >
              {m === "preset" ? "Chọn sẵn" : "Tùy chỉnh"}
            </button>
          ))}
        </div>

        {mode === "preset" ? (
          <>
            <select
              className={selectCls + " mb-1"}
              value={presetKey}
              onChange={(e) => setPresetKey(e.target.value)}
            >
              {CRON_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="mono-nums mb-4 text-[10px] text-[var(--text-muted)]">
              {CRON_PRESETS.find((p) => p.key === presetKey)?.expr}
            </p>
          </>
        ) : (
          <input
            className={inputCls + " mono-nums mb-4 text-xs"}
            value={customCron}
            onChange={(e) => setCustomCron(e.target.value)}
            placeholder="0 30 2 * * *"
          />
        )}

        <label className="mb-4 flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="accent-[var(--accent-green)]"
          />
          Kích hoạt job ngay khi tạo
        </label>

        <ErrorBox message={error} />

        <button
          type="submit"
          disabled={pending}
          className={submitBtnCls}
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {editing ? "Lưu thay đổi" : "Tạo job"}
        </button>
      </form>
    </div>
  );
}

// POST /sync-job thật: chỉ cần sourceDatabaseConfigId + targetDatabaseConfigId
function SyncJobDialog({ onClose }: { onClose: () => void }) {
  const configs = useDatabaseConfigs();
  const [sourceConfigId, setSourceConfigId] = useState("");
  const [targetConfigId, setTargetConfigId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createSync = useCreateSyncJob();
  const { addNotification } = useNotifications();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!sourceConfigId || !targetConfigId)
      return setError("Chọn database config nguồn và đích");
    createSync.mutate(
      {
        sourceDatabaseConfigId: sourceConfigId,
        targetDatabaseConfigId: targetConfigId,
      },
      {
        onSuccess: () => {
          toast.success("Đã tạo sync job");
          addNotification("Đã tạo sync job mới, đang chờ xử lý...");
          onClose();
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="panel w-full max-w-md p-6">
        <DialogHeader title="Tạo Sync Job" onClose={onClose} />

        <label className="panel-label mb-1.5 block">Config nguồn</label>
        <select
          className={selectCls + " mb-4"}
          value={sourceConfigId}
          onChange={(e) => setSourceConfigId(e.target.value)}
          required
        >
          <option value="" disabled>
            — chọn database config nguồn —
          </option>
          {(configs.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.configCode ?? shortId(c.id)} — {c.databaseName ?? "?"} @{" "}
              {c.host ?? "?"}
              {c.port ? `:${c.port}` : ""}
            </option>
          ))}
        </select>

        <label className="panel-label mb-1.5 block">Config đích</label>
        <select
          className={selectCls + " mb-4"}
          value={targetConfigId}
          onChange={(e) => setTargetConfigId(e.target.value)}
          required
        >
          <option value="" disabled>
            — chọn database config đích —
          </option>
          {(configs.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.configCode ?? shortId(c.id)} — {c.databaseName ?? "?"} @{" "}
              {c.host ?? "?"}
              {c.port ? `:${c.port}` : ""}
            </option>
          ))}
        </select>

        <p className="mb-4 text-[10px] leading-relaxed text-[var(--text-muted)]">
          Sync job chạy ngay khi tạo — trạng thái lần đầu là PENDING/RUNNING,
          kết quả xem ở cột Trạng thái.
        </p>

        <ErrorBox message={error} />

        <button
          type="submit"
          disabled={createSync.isPending}
          className={submitBtnCls}
        >
          {createSync.isPending && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          Tạo job
        </button>
      </form>
    </div>
  );
}

function JobDialog({
  kind,
  editJob,
  onClose,
}: {
  kind: "backup" | "sync";
  editJob?: BackupJob;
  onClose: () => void;
}) {
  return kind === "backup" ? (
    <BackupJobDialog job={editJob} onClose={onClose} />
  ) : (
    <SyncJobDialog onClose={onClose} />
  );
}

function ActionButton({
  title,
  onClick,
  disabled,
  children,
  danger,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center border border-[var(--panel-mid)] transition-colors disabled:opacity-40 ${
        danger
          ? "text-[var(--accent-red)] hover:border-[var(--accent-red)]"
          : "text-[var(--panel-light)] hover:border-[var(--accent-blue)] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function JobsContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "sync" ? "sync" : "backup";
  const setTab = (t: "backup" | "sync") =>
    setSearchParams(t === "sync" ? { tab: t } : {}, { replace: true });
  const [dialog, setDialog] = useState<{
    kind: "backup" | "sync";
    editJob?: BackupJob;
  } | null>(null);
  const backups = useBackupJobs();
  const syncs = useSyncJobs();
  const configs = useDatabaseConfigs();
  // join databaseConfigId -> config để hiện tên database thay vì id
  const configById = new Map((configs.data ?? []).map((c) => [c.id, c]));

  const toggle = useToggleJob();
  const remove = useRemoveJob();
  const { addNotification } = useNotifications();
  const busy = toggle.isPending || remove.isPending;

  const onToggleBackup = (job: BackupJob) => {
    toggle.mutate(
      {
        kind: "backup",
        id: job.id,
        isActive: !job.isActive,
        current: job,
      },
      {
        onSuccess: () => {
          const msg = !job.isActive ? "Đã kích hoạt job" : "Đã tạm dừng job";
          toast.success(msg);
          addNotification(msg);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const onRemove = (kind: "backup" | "sync", id: string, name: string) => {
    if (!confirm(`Xóa job "${name}"?`)) return;
    remove.mutate(
      { kind, id },
      {
        onSuccess: () => {
          toast.success("Đã xóa job");
          addNotification(`Đã xóa job "${name}"`);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const thCls = "panel-label px-5 py-3 text-left font-extrabold";
  const tdCls = "px-5 py-3";

  return (
    <>
      <PageHeader
        title="Quản lý Job"
        sub="Quản lí hoạt động của backup job & sync job"
      />

      <Panel
        title="Danh sách jobs"
        right={
          <button
            onClick={() => setDialog({ kind: tab })}
            className="flex items-center gap-2 border border-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] transition-colors hover:bg-white hover:text-[var(--panel-dark)]"
          >
            <Plus className="h-3.5 w-3.5" />
            {tab === "backup" ? "Backup Job" : "Sync Job"}
          </button>
        }
      >
        <div className="flex border-b border-[var(--panel-mid)]">
          {(
            [
              { key: "backup", label: "Backup Jobs", icon: DatabaseBackup, count: backups.data?.length },
              { key: "sync", label: "Sync Jobs", icon: RefreshCcw, count: syncs.data?.length },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-colors ${
                tab === t.key
                  ? "border-b-2 border-[var(--accent-blue)] text-white"
                  : "text-[var(--text-muted)] hover:text-white"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {t.count !== undefined && (
                <span className="mono-nums border border-[var(--panel-mid)] px-1.5 text-[10px]">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "backup" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--panel-mid)]">
                  <th className={thCls}>Job</th>
                  <th className={thCls}>Database Config</th>
                  <th className={thCls}>Lịch chạy</th>
                  <th className={thCls}>Retention</th>
                  <th className={thCls}>Trạng thái</th>
                  <th className={thCls}>Cập nhật</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody>
                {(backups.data ?? []).map(({ job }) => {
                  const cfg = configById.get(job.databaseConfigId);
                  return (
                  <tr
                    key={job.id}
                    className="border-b border-[var(--panel-mid)]/50 last:border-0 hover:bg-[var(--panel-mid)]/20"
                  >
                    <td className={tdCls + " mono-nums text-xs"} title={job.id}>
                      {shortId(job.id)}
                    </td>
                    <td className={tdCls + " text-xs"} title={job.databaseConfigId}>
                      {cfg ? (
                        <>
                          <div>{cfg.configCode ?? shortId(cfg.id)}</div>
                          <div className="mono-nums text-[10px] text-[var(--text-muted)]">
                            {cfg.databaseName ?? "?"} @ {cfg.host ?? "?"}
                            {cfg.port ? `:${cfg.port}` : ""}
                          </div>
                        </>
                      ) : (
                        <span className="mono-nums">
                          {shortId(job.databaseConfigId)}
                        </span>
                      )}
                    </td>
                    <td className={tdCls}>
                      <div className="text-xs">{cronLabel(job.cronExpression ?? "")}</div>
                      <div className="mono-nums text-[10px] text-[var(--text-muted)]">{job.cronExpression}</div>
                    </td>
                    <td className={tdCls + " mono-nums text-xs"}>
                      {job.retentionDays != null ? `${job.retentionDays}d` : "—"}
                    </td>
                    <td className={tdCls}>
                      <StatusBadge status={job.isActive ? "active" : "paused"} />
                    </td>
                    <td className={tdCls + " mono-nums text-xs"}>
                      {formatDateTime(job.updatedAt)}
                    </td>
                    <td className={tdCls}>
                      <div className="flex gap-1.5">
                        <ActionButton
                          title={job.isActive ? "Tạm dừng" : "Kích hoạt"}
                          disabled={busy}
                          onClick={() => onToggleBackup(job)}
                        >
                          {job.isActive ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                        </ActionButton>
                        <ActionButton
                          title="Sửa"
                          disabled={busy}
                          onClick={() => setDialog({ kind: "backup", editJob: job })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </ActionButton>
                        <ActionButton
                          title="Xóa"
                          danger
                          disabled={busy}
                          onClick={() => onRemove("backup", job.id, shortId(job.id))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {(backups.isLoading || backups.data?.length === 0) && (
                  <TableStateRow
                    colSpan={7}
                    loading={backups.isLoading}
                    empty={'Chưa có backup job nào — bấm "+ Backup Job" để tạo (hoặc bạn chưa được cấp quyền xem database nào)'}
                  />
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--panel-mid)]">
                  <th className={thCls}>Job</th>
                  <th className={thCls}>Nguồn → Đích</th>
                  <th className={thCls}>Trạng thái</th>
                  <th className={thCls}>Cập nhật</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody>
                {(syncs.data ?? []).map((job) => {
                  const src = job.sourceDatabaseConfig;
                  const tgt = job.targetDatabaseConfig;
                  return (
                    <tr
                      key={job.id}
                      className="border-b border-[var(--panel-mid)]/50 last:border-0 hover:bg-[var(--panel-mid)]/20"
                      title={job.errorMessage ?? undefined}
                    >
                      <td className={tdCls + " mono-nums text-xs"} title={job.id}>
                        {shortId(job.id)}
                      </td>
                      <td className={tdCls}>
                        <div className="text-xs">
                          {src?.configCode ?? "—"} ({src?.databaseName ?? "?"}) →{" "}
                          {tgt?.configCode ?? "—"} ({tgt?.databaseName ?? "?"})
                        </div>
                        <div className="mono-nums text-[10px] text-[var(--text-muted)]">
                          {src?.host ?? "—"}
                          {src?.port ? `:${src.port}` : ""} → {tgt?.host ?? "—"}
                          {tgt?.port ? `:${tgt.port}` : ""}
                        </div>
                      </td>
                      <td className={tdCls}>
                        <StatusBadge status={job.status} />
                      </td>
                      <td className={tdCls + " mono-nums text-xs"}>
                        {formatDateTime(job.updatedAt)}
                      </td>
                      <td className={tdCls}>
                        <div className="flex gap-1.5">
                          <ActionButton
                            title="Xóa"
                            danger
                            disabled={busy}
                            onClick={() => onRemove("sync", job.id, shortId(job.id))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {(syncs.isLoading || syncs.data?.length === 0) && (
                  <TableStateRow
                    colSpan={5}
                    loading={syncs.isLoading}
                    empty={'Chưa có sync job nào — bấm "+ Sync Job" để tạo (hoặc bạn chưa được cấp quyền xem database nào)'}
                  />
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {dialog && (
        <JobDialog
          kind={dialog.kind}
          editJob={dialog.editJob}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

export default function Jobs() {
  return (
    <AuthLayout>
      <JobsContent />
    </AuthLayout>
  );
}
