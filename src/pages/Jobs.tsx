import { Fragment, useMemo, useState, type FormEvent } from "react";
import AuthLayout from "@/components/AuthLayout";
import { PageHeader, StatusBadge, TableStateRow, ViewToggle } from "@/components/common";
import { Pagination } from "@/components/Pagination";
import {
  useBackupJobsPage,
  useCreateBackupJob,
  useCreateSyncJob,
  useDatabaseConfigs,
  useMyPermissionsView,
  useProjects,
  useRemoveJob,
  useSyncJobsPage,
  useToggleJob,
  useUpdateBackupJob,
  useUsers,
} from "@/api/hooks";
import { cronLabel, formatDateTime, shortId, totalPagesOf } from "@/lib/format";
import { CRON_PRESETS } from "@/lib/cron-presets";
import {
  DatabaseBackup,
  History,
  Loader2,
  Pause,
  Pencil,
  Play,
  RefreshCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router";
import type { BackupJob, DatabaseConfig, ManagedUser } from "@/types/api";
import { useNotifications } from "@/components/NotificationProvider";
import { JobHistoryDialog } from "@/components/JobHistoryDialog";

const inputCls =
  "w-full border border-[var(--panel-mid)] bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-blue)] placeholder:text-[var(--text-muted)]";
const selectCls = inputCls + " appearance-none";

const submitBtnCls =
  "flex w-full items-center justify-center gap-2 border border-[var(--foreground)] bg-[var(--foreground)] py-2.5 text-[11px] font-black uppercase tracking-[0.25em] text-[var(--background)] transition-all hover:bg-transparent hover:text-[var(--foreground)] disabled:opacity-50";

function userLabel(u?: ManagedUser): string {
  if (!u) return "";
  return u.fullname ?? u.username ?? u.email ?? shortId(u.id);
}

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
        className="text-[var(--text-muted)] hover:text-[var(--foreground)]"
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
                  ? "border-[var(--accent-blue)] bg-[var(--accent-blue)]/15 text-[var(--foreground)]"
                  : "border-[var(--panel-mid)] text-[var(--text-muted)] hover:text-[var(--foreground)]")
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

function DetailRow({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-4 py-3">
      <dt className="w-44 shrink-0 pt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </dt>
      <dd className={"min-w-0 flex-1 text-xs " + (mono ? "mono-nums" : "")}>
        {children}
      </dd>
    </div>
  );
}

// Hiện full thông tin của một backup job — phong cách giống JobHistoryDialog
function BackupJobDetailDialog({
  job,
  cfg,
  onClose,
}: {
  job: BackupJob;
  cfg?: DatabaseConfig;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="panel w-full max-w-2xl p-6">
        <DialogHeader title="Chi tiết Backup Job" onClose={onClose} />

        <div className="mb-5 flex items-center gap-2">
          <StatusBadge status={job.isActive ? "active" : "paused"} />
        </div>

        <dl className="divide-y divide-[var(--panel-mid)]/50 border-y border-[var(--panel-mid)]">
          <DetailRow label="Job ID" mono>
            <div className="break-all text-[var(--panel-light)]">{job.id}</div>
          </DetailRow>
          <DetailRow label="Database Config ID" mono>
            <div className="break-all text-[var(--panel-light)]">
              {job.databaseConfigId}
            </div>
          </DetailRow>
          <DetailRow label="Config code">
            <div className="text-[var(--panel-light)]">
              {cfg?.configCode ?? shortId(job.databaseConfigId)}
            </div>
          </DetailRow>
          <DetailRow label="Môi trường">
            <div className="text-[var(--panel-light)]">
              {cfg?.environment ?? "—"}
            </div>
          </DetailRow>
          <DetailRow label="Database" mono>
            <div className="text-[var(--panel-light)]">
              {cfg?.databaseName ?? "—"}
            </div>
          </DetailRow>
          <DetailRow label="Host / Port" mono>
            <div className="text-[var(--panel-light)]">
              {cfg?.host ?? "—"}
              {cfg?.port ? `:${cfg.port}` : ""}
            </div>
          </DetailRow>
          <DetailRow label="Lịch chạy">
            <div className="text-[var(--panel-light)]">
              {cronLabel(job.cronExpression ?? "")}
            </div>
            <div className="mono-nums text-[10px] text-[var(--text-muted)]">
              {job.cronExpression}
            </div>
          </DetailRow>
          <DetailRow label="Retention" mono>
            <div className="text-[var(--panel-light)]">
              {job.retentionDays != null ? `${job.retentionDays} ngày` : "—"}
            </div>
          </DetailRow>
          <div className="flex items-start gap-4 py-3">
            <dt className="w-44 shrink-0 pt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Tạo lúc
            </dt>
            <dd className="mono-nums min-w-0 flex-1 text-xs text-[var(--panel-light)]">
              {formatDateTime(job.createdAt)}
            </dd>
            <dt className="w-44 shrink-0 border-l border-[var(--panel-mid)]/50 pl-4 pt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Cập nhật
            </dt>
            <dd className="mono-nums min-w-0 flex-1 text-xs text-[var(--panel-light)]">
              {formatDateTime(job.updatedAt)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
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
      className={`flex h-8 w-8 items-center justify-center rounded transition-colors disabled:opacity-40 ${
        danger
          ? "text-[var(--text-muted)] hover:bg-[var(--panel-mid-40)] hover:text-[var(--accent-red)]"
          : "text-[var(--panel-light)] hover:bg-[var(--panel-mid-40)] hover:text-[var(--foreground)]"
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
  const [historyJob, setHistoryJob] = useState<BackupJob | null>(null);
  const [detailJob, setDetailJob] = useState<BackupJob | null>(null);
  const [backupView, setBackupView] = useState<"table" | "grid">("grid");
  const [backupSearch, setBackupSearch] = useState("");
  const [backupPage, setBackupPage] = useState(1);
  const [backupLimit, setBackupLimit] = useState(20);
  const backups = useBackupJobsPage({ page: backupPage, limit: backupLimit });
  const [syncPage, setSyncPage] = useState(1);
  const [syncLimit, setSyncLimit] = useState(20);
  const syncs = useSyncJobsPage({ page: syncPage, limit: syncLimit });
  const configs = useDatabaseConfigs();
  const projects = useProjects();
  const users = useUsers();
  const view = useMyPermissionsView();
  // join databaseConfigId -> config để hiện tên database thay vì id
  const configById = new Map((configs.data ?? []).map((c) => [c.id, c]));
  const projectById = new Map((projects.data ?? []).map((p) => [p.id, p.name]));
  // triggeredBy bên BE có thể là _id, ssoId, username, email hay fullname
  const findUserByTrigger = useMemo(() => {
    const list = users.data ?? [];
    return (triggeredBy: string) =>
      list.find(
        (u) =>
          u.id === triggeredBy ||
          u.ssoId === triggeredBy ||
          u.username === triggeredBy ||
          u.email === triggeredBy ||
          u.fullname === triggeredBy,
      );
  }, [users.data]);
  // Chỉ admin / user có quyền "quản lý phân quyền" được xem ai đã tạo job
  const showTriggeredBy = view.canManage;

  const jobProjectName = (job: BackupJob): string => {
    const cfg = configById.get(job.databaseConfigId);
    if (!cfg?.projectId) return "Khác";
    return projectById.get(cfg.projectId) ?? cfg.projectId;
  };
  const jobProjectKey = (job: BackupJob): string => {
    const cfg = configById.get(job.databaseConfigId);
    return cfg?.projectId ?? "other";
  };

  const filteredBackupJobs = (backups.data?.result ?? []).filter((it) => {
    const q = backupSearch.trim().toLowerCase();
    if (!q) return true;
    const cfg = configById.get(it.job.databaseConfigId);
    return (
      jobProjectName(it.job).toLowerCase().includes(q) ||
      (cfg?.configCode ?? "").toLowerCase().includes(q) ||
      (cfg?.databaseName ?? "").toLowerCase().includes(q) ||
      (cfg?.host ?? "").toLowerCase().includes(q) ||
      it.job.databaseConfigId.toLowerCase().includes(q)
    );
  });

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

  const thCls = "px-5 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)] whitespace-nowrap";
  const tdCls = "px-5 py-2.5 align-middle";

  return (
    <>
      <PageHeader title="Quản lý Job" />

      <div className="flex items-center border-b border-[var(--panel-mid)]">
          {(
            [
              { key: "backup", label: "Backup Jobs", icon: DatabaseBackup },
              { key: "sync", label: "Sync Jobs", icon: RefreshCcw },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-colors ${
                tab === t.key
                  ? "border-b-2 border-[var(--accent-blue)] text-[var(--foreground)]"
                  : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
          <span className="ml-auto px-5 text-sm font-semibold text-[var(--text-muted)]">
            <span className="text-[var(--foreground)]">
              {(tab === "backup" ? backups.data?.total : syncs.data?.total) ?? 0}
            </span>{" "}
            {tab === "backup" ? "backup job được cấp quyền" : "sync job được cấp quyền"}
          </span>
      </div>

      <div className="flex items-center justify-between gap-2 px-5 py-3">
        <div className="ml-auto flex items-center gap-2">
          {tab === "backup" && <ViewToggle value={backupView} onChange={setBackupView} />}
          <button
            onClick={() => setDialog({ kind: tab })}
            className="flex items-center gap-2 border border-[var(--accent-blue)] bg-[var(--accent-blue)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:brightness-110 hover:scale-105"
          >
            {tab === "backup" ? "Backup Job" : "Sync Job"}
          </button>
        </div>
      </div>

      {tab === "backup" && (
        <div className="flex justify-end px-5">
          <div className="relative w-[13.25rem]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={backupSearch}
              onChange={(e) => setBackupSearch(e.target.value)}
              placeholder="Tìm theo project / config..."
              className="w-full border border-[var(--panel-mid)] bg-black/[0.015] py-1.5 pl-8 pr-3 text-xs outline-none transition-colors focus:border-[var(--accent-blue)] placeholder:text-[var(--text-muted)]"
            />
          </div>
        </div>
      )}

      {tab === "backup" ? (
          backupView === "grid" ? (
            <>
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {(() => {
                const jobs = filteredBackupJobs;
                const groups = new Map<string, { name: string; jobs: typeof jobs }>();
                for (const it of jobs) {
                  const key = jobProjectKey(it.job);
                  const g = groups.get(key);
                  if (g) g.jobs.push(it);
                  else groups.set(key, { name: jobProjectName(it.job), jobs: [it] });
                }
                return Array.from(groups.entries())
                  .sort((a, b) =>
                    a[0] === "other" ? 1 : b[0] === "other" ? -1 : a[1].name.localeCompare(b[1].name, "vi"),
                  )
                  .map(([key, g]) => (
                    <Fragment key={key}>
                      <div className="col-span-full border-b border-[var(--panel-mid)]/50 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--panel-light)]">
                        <span>{g.name}</span>
                      </div>
                      {g.jobs.map(({ job }) => {
                        const cfg = configById.get(job.databaseConfigId);
                        return (
                  <div
                    key={job.id}
                    onClick={() => setDetailJob(job)}
                    className="flex min-h-44 cursor-pointer flex-col justify-between gap-3 border border-[var(--panel-mid)] bg-[var(--panel-dark)] p-5 transition-all duration-200 hover:z-10 hover:scale-[1.135] hover:border-[var(--accent-blue)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={job.isActive ? "active" : "paused"} />
                      <span
                        className="mono-nums text-[10px] text-[var(--text-muted)]"
                        title={job.id}
                      >
                        {shortId(job.id)}
                      </span>
                    </div>
                    <div className="text-xs">
                      {cfg ? (
                        <>
                          <div className="font-bold">
                            {cfg.configCode ?? shortId(cfg.id)}
                          </div>
                          <div className="mono-nums text-[10px] text-[var(--text-muted)]">
                            {cfg.databaseName ?? "?"} @ {cfg.host ?? "?"}
                            {cfg.port ? `:${cfg.port}` : ""}
                          </div>
                        </>
                      ) : (
                        <div className="mono-nums">
                          {shortId(job.databaseConfigId)}
                        </div>
                      )}
                    </div>
                    <div className="text-xs">
                      <div>{cronLabel(job.cronExpression ?? "")}</div>
                      <div className="mono-nums text-[10px] text-[var(--text-muted)]">
                        {job.cronExpression}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-muted)]">Retention</span>
                      <span className="mono-nums">
                        {job.retentionDays != null ? `${job.retentionDays}d` : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-muted)]">Cập nhật</span>
                      <span className="mono-nums">
                        {formatDateTime(job.updatedAt)}
                      </span>
                    </div>
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-auto flex gap-1.5 border-t border-[var(--panel-mid)]/50 pt-3"
                    >
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
                        title="Lịch sử chạy"
                        disabled={busy}
                        onClick={() => setHistoryJob(job)}
                      >
                        <History className="h-3.5 w-3.5" />
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
                  </div>
                );
              })}
                    </Fragment>
                  ));
              })()}
              {(backups.isLoading || (backups.data?.total ?? 0) === 0 || filteredBackupJobs.length === 0) && (
                <div className="col-span-full px-5 py-10 text-center text-sm text-[var(--text-muted)]">
                  {backups.isLoading
                    ? "Đang tải dữ liệu..."
                    : (backups.data?.total ?? 0) > 0
                      ? "Không tìm thấy backup job nào khớp từ khóa"
                      : 'Chưa có backup job nào — bấm "Backup Job" để tạo (hoặc bạn chưa được cấp quyền xem database nào)'}
                </div>
              )}
            </div>
            <Pagination
              page={backupPage}
              totalPages={totalPagesOf(backups.data?.total ?? 0, backupLimit)}
              total={backups.data?.total ?? 0}
              limit={backupLimit}
              onPageChange={setBackupPage}
              onLimitChange={(l) => {
                setBackupLimit(l);
                setBackupPage(1);
              }}
            />
          </>
          ) : (
          <>
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
                {(() => {
                  const jobs = filteredBackupJobs;
                  const groups = new Map<string, { name: string; jobs: typeof jobs }>();
                  for (const it of jobs) {
                    const key = jobProjectKey(it.job);
                    const g = groups.get(key);
                    if (g) g.jobs.push(it);
                    else groups.set(key, { name: jobProjectName(it.job), jobs: [it] });
                  }
                  return Array.from(groups.entries())
                    .sort((a, b) =>
                      a[0] === "other" ? 1 : b[0] === "other" ? -1 : a[1].name.localeCompare(b[1].name, "vi"),
                    )
                    .map(([key, g]) => (
                      <Fragment key={key}>
                        <tr className="border-b border-[var(--panel-mid)]/50 bg-[var(--panel-mid)]/10">
                          <td
                            colSpan={7}
                            className="px-5 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--panel-light)]"
                          >
                            {g.name}
                          </td>
                        </tr>
                        {g.jobs.map(({ job }) => {
                          const cfg = configById.get(job.databaseConfigId);
                          return (
                          <tr
                            key={job.id}
                            onClick={() => setDetailJob(job)}
                    className="cursor-pointer border-b border-transparent last:border-0 transition-colors hover:border-[var(--panel-mid-40)] hover:bg-[var(--panel-mid-20)]"
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
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex gap-1.5"
                      >
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
                          title="Lịch sử chạy"
                          disabled={busy}
                          onClick={() => setHistoryJob(job)}
                        >
                          <History className="h-3.5 w-3.5" />
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
                        </Fragment>
                      ));
                })()}
                {(backups.isLoading || (backups.data?.total ?? 0) === 0 || filteredBackupJobs.length === 0) && (
                  <TableStateRow
                    colSpan={7}
                    loading={backups.isLoading}
                    empty={
                      (backups.data?.total ?? 0) > 0
                        ? "Không tìm thấy backup job nào khớp từ khóa"
                        : 'Chưa có backup job nào — bấm "Backup Job" để tạo (hoặc bạn chưa được cấp quyền xem database nào)'
                    }
                  />
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={backupPage}
            totalPages={totalPagesOf(backups.data?.total ?? 0, backupLimit)}
            total={backups.data?.total ?? 0}
            limit={backupLimit}
            onPageChange={setBackupPage}
            onLimitChange={(l) => {
              setBackupLimit(l);
              setBackupPage(1);
            }}
          />
          </>
          )
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--panel-mid)]">
                  <th className={thCls}>Job</th>
                  <th className={thCls}>Project nguồn</th>
                  <th className={thCls}>Nguồn → Đích</th>
                  <th className={thCls}>Trạng thái</th>
                  {showTriggeredBy && <th className={thCls}>Người tạo</th>}
                  <th className={thCls}>Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {(syncs.data?.result ?? []).map((job) => {
                  const src = job.sourceDatabaseConfig;
                  const tgt = job.targetDatabaseConfig;
                  return (
                    <tr
                      key={job.id}
                      className="border-b border-transparent last:border-0 transition-colors hover:border-[var(--panel-mid-40)] hover:bg-[var(--panel-mid-20)]"
                      title={job.errorMessage ?? undefined}
                    >
                      <td className={tdCls + " mono-nums text-xs"} title={job.id}>
                        {shortId(job.id)}
                      </td>
                      <td className={tdCls + " text-xs"}>
                        {src?.projectId
                          ? (projectById.get(src.projectId) ?? src.projectId)
                          : "—"}
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
                      {showTriggeredBy && (
                        <td className={tdCls + " text-xs whitespace-nowrap"} title={job.triggeredBy ?? undefined}>
                          {job.triggeredBy
                            ? (userLabel(findUserByTrigger(job.triggeredBy)) || job.triggeredBy)
                            : "—"}
                        </td>
                      )}
                      <td className={tdCls + " mono-nums text-xs"}>
                        {formatDateTime(job.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
                {(syncs.isLoading || (syncs.data?.total ?? 0) === 0) && (
                  <TableStateRow
                    colSpan={5 + (showTriggeredBy ? 1 : 0)}
                    loading={syncs.isLoading}
                    empty={'Chưa có sync job nào — bấm "Sync Job" để tạo (hoặc bạn chưa được cấp quyền xem database nào)'}
                  />
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={syncPage}
            totalPages={totalPagesOf(syncs.data?.total ?? 0, syncLimit)}
            total={syncs.data?.total ?? 0}
            limit={syncLimit}
            onPageChange={setSyncPage}
            onLimitChange={(l) => {
              setSyncLimit(l);
              setSyncPage(1);
            }}
          />
          </>
        )}

      {dialog && (
        <JobDialog
          kind={dialog.kind}
          editJob={dialog.editJob}
          onClose={() => setDialog(null)}
        />
      )}

      {historyJob && (
        <JobHistoryDialog
          job={historyJob}
          onClose={() => setHistoryJob(null)}
        />
      )}

      {detailJob && (
        <BackupJobDetailDialog
          job={detailJob}
          cfg={configById.get(detailJob.databaseConfigId)}
          onClose={() => setDetailJob(null)}
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
