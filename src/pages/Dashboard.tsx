import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import AuthLayout from "@/components/AuthLayout";
import { PageHeader, Panel, StatusBadge, EmptyState, TableStateRow } from "@/components/common";
import {
  useBackupJobs,
  useBackupJobLabels,
  useDatabases,
  useDashboardOverview,
  useRescanServer,
  useRescanTables,
  useServers,
  useStorageCurrent,
  useStorageSeries,
  useSyncJobs,
  useTables,
} from "@/api/hooks";
import {
  cronLabel,
  formatBytes,
  formatDateTime,
  formatDuration,
  formatNumber,
  shortId,
} from "@/lib/format";
import {
  Activity,
  Cloud,
  Database,
  DatabaseBackup,
  RefreshCcw,
  RefreshCw,
  Server,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <span className="panel-label">{label}</span>
        <Icon className="h-4 w-4 text-[var(--accent-blue)]" />
      </div>
      <div className="mono-nums mt-3 text-3xl font-black tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}

type ChartGranularity = "hour" | "half" | "day";

const GRANULARITY_MS: Record<ChartGranularity, number> = {
  hour: 60 * 60 * 1000,
  half: 12 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
};

function formatBucketLabel(keyMs: number, gran: ChartGranularity): string {
  const d = new Date(keyMs);
  const day = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (gran === "day") return day;
  const hour = `${String(d.getHours()).padStart(2, "0")}h`;
  return gran === "half" ? `${day} ${hour}` : `${day} ${hour}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function StorageChart() {
  const series = useStorageSeries();
  const current = useStorageCurrent();
  const { data } = series;
  const [gran, setGran] = useState<ChartGranularity>("half");
  // Gom snapshot theo mốc thời gian (giờ / 12h / ngày), lấy giá trị mới nhất trong mỗi mốc
  const chartData = useMemo(() => {
    const bucketMs = GRANULARITY_MS[gran];
    const buckets = new Map<number, { t: number; used: number }>();
    for (const s of data ?? []) {
      if (!s.date) continue;
      const t = new Date(s.date).getTime();
      if (Number.isNaN(t)) continue;
      const key = Math.floor(t / bucketMs) * bucketMs;
      const prev = buckets.get(key);
      if (!prev || t >= prev.t) {
        buckets.set(key, {
          t,
          used: (s.payloadSize ?? 0) + (s.metadataSize ?? 0),
        });
      }
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a - b)
      .map(([key, b]) => ({
        date: formatBucketLabel(key, gran),
        used: b.used,
      }));
  }, [data, gran]);
  const latest = data?.at(-1) ?? current.data ?? null;
  const latestTotal = latest
    ? (latest.payloadSize ?? 0) + (latest.metadataSize ?? 0)
    : 0;

  return (
    <Panel
      title="Cloudflare R2 Storage"
      right={
        <div className="flex items-center gap-3">
          <span className="mono-nums text-xs text-[var(--panel-light)]">
            {latest
              ? `${formatBytes(latestTotal)} · ${latest.objectCount ?? 0} objects`
              : "—"}
          </span>
          <div className="flex border border-[var(--panel-mid)]">
            {(
              [
                ["day", "Ngày"],
                ["half", "12H"],
                ["hour", "Giờ"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setGran(value)}
                className={`px-2 py-1 text-[10px] font-bold tracking-[0.15em] uppercase transition-colors ${
                  gran === value
                    ? "bg-[var(--accent-blue)] text-white"
                    : "text-[var(--text-muted)] hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      }
      className="lg:col-span-2"
    >
      <div className="p-5">
        <div className="h-64 overflow-x-auto pb-1">
          {series.isError ? (
            <EmptyState
              icon={Cloud}
              message={`Không tải được dữ liệu storage: ${(series.error as Error).message}`}
              hint="Kiểm tra endpoint /storage/history trên backend."
            />
          ) : chartData.length === 0 ? (
            <EmptyState
              icon={Cloud}
              message={series.isLoading ? "Đang tải..." : "Chưa có dữ liệu dung lượng"}
              hint="Biểu đồ sẽ hiển thị khi hệ thống ghi nhận dữ liệu storage từ R2."
            />
          ) : (
          <div
            className="h-full"
            style={{ minWidth: Math.max(560, chartData.length * 90) }}
          >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="r2fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--panel-mid)" strokeDasharray="2 6" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "var(--panel-mid)" }}
                interval="preserveStartEnd"
                minTickGap={8}
                height={30}
                tickMargin={6}
              />
              <YAxis
                tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatBytes(v)}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--panel-dark)",
                  border: "1px solid var(--panel-mid)",
                  borderRadius: 0,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--panel-light)" }}
                formatter={(v: number) => [formatBytes(v), "Dung lượng"]}
              />
              <Area
                type="monotone"
                dataKey="used"
                stroke="var(--accent-blue)"
                fill="url(#r2fill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
          </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function JobsOverview() {
  const backups = useBackupJobs();
  const syncs = useSyncJobs();
  const navigate = useNavigate();

  const activeCount = (backups.data ?? []).filter((r) => r.job.isActive).length;

  const registered = [
    ...(backups.data ?? []).map((r) => ({
      key: `b-${r.job.id}`,
      name: r.job.id,
      server: r.job.databaseConfigId
        ? `config ${shortId(r.job.databaseConfigId)}`
        : "—",
      schedule: r.job.cronExpression,
      status: r.job.isActive ? "active" : "paused",
      kind: "BACKUP",
    })),
    ...(syncs.data ?? []).map((j) => ({
      key: `s-${j.id}`,
      name: j.id,
      server:
        j.sourceDatabaseConfig?.databaseName || j.targetDatabaseConfig
          ? `${j.sourceDatabaseConfig?.configCode ?? "?"}/${j.sourceDatabaseConfig?.databaseName ?? "?"} → ${j.targetDatabaseConfig?.configCode ?? "?"}/${j.targetDatabaseConfig?.databaseName ?? "?"}`
          : "—",
      schedule: null,
      status: j.status,
      kind: "SYNC",
    })),
  ];

  return (
    <Panel
      title={`Registered Jobs — ${registered.length}`}
      right={
        <span className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.15em] text-[var(--accent-blue)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-blue)]" />
          {activeCount} ACTIVE
        </span>
      }
      className="lg:col-span-3"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--panel-mid)] text-left">
              <th className="panel-label px-5 py-3 font-extrabold">Job</th>
              <th className="panel-label px-5 py-3 font-extrabold">Loại</th>
              <th className="panel-label px-5 py-3 font-extrabold">Database Config</th>
              <th className="panel-label px-5 py-3 font-extrabold">Trạng thái</th>
              <th className="panel-label px-5 py-3 font-extrabold">Lịch chạy</th>
            </tr>
          </thead>
          <tbody>
            {registered.map((j) => (
              <tr
                key={j.key}
                onClick={() =>
                  navigate(j.kind === "BACKUP" ? "/jobs?tab=backup" : "/jobs?tab=sync")
                }
                className="cursor-pointer border-b border-[var(--panel-mid)]/50 last:border-0 hover:bg-[var(--panel-mid)]/20"
              >
                <td className="px-5 py-3 font-semibold">{j.name}</td>
                <td className="px-5 py-3">
                  <span
                    className={`mono-nums border px-1.5 py-0.5 text-[10px] ${
                      j.kind === "BACKUP"
                        ? "border-[var(--accent-blue)]/50 text-[var(--accent-blue)]"
                        : "border-[var(--accent-red)]/50 text-[var(--accent-red)]"
                    }`}
                  >
                    {j.kind}
                  </span>
                </td>
                <td className="mono-nums px-5 py-3 text-xs text-[var(--text-muted)]">{j.server}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={j.status} />
                </td>
                <td className="mono-nums px-5 py-3 text-xs text-[var(--panel-light)]">
                  {j.schedule ? cronLabel(j.schedule) : "—"}
                </td>
              </tr>
            ))}
            {registered.length === 0 && (
              <TableStateRow
                colSpan={5}
                loading={backups.isLoading || syncs.isLoading}
                empty="Chưa có job nào được đăng ký"
              />
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Rescan của BE là BẤT ĐỒNG BỘ (BullMQ) — poll chờ snapshot có scannedAt mới
type ScanSnapshot = {
  scannedAt: string | null;
  status: string | null;
  errorMessage: string | null;
};

async function pollScanResult(
  refetch: () => Promise<{ data?: ScanSnapshot | undefined }>,
  baselineScannedAt: string | null,
  tries = 12,
): Promise<{ data?: ScanSnapshot | undefined } | undefined> {
  for (let i = 0; i < tries; i++) {
    await sleep(2500);
    const res = await refetch();
    const at = res.data?.scannedAt ?? null;
    if (at && at !== baselineScannedAt) return res;
  }
  return undefined;
}

function DatabaseInspector() {
  const servers = useServers();
  const [serverId, setServerId] = useState<string | null>(null);
  const [dbName, setDbName] = useState<string | null>(null);

  const effectiveServerId = serverId ?? servers.data?.[0]?.id ?? null;
  const databases = useDatabases(effectiveServerId);
  const effectiveDb = dbName ?? databases.data?.items[0]?.databaseName ?? null;
  const tables = useTables(effectiveServerId, effectiveDb);

  const rescanServer = useRescanServer();
  const rescanTables = useRescanTables();

  const selectedServer = servers.data?.find((s) => s.id === effectiveServerId);

  const handleRescanServer = () => {
    if (!effectiveServerId) return;
    rescanServer.mutate(effectiveServerId, {
      onSuccess: async () => {
        toast.info("Đã gửi yêu cầu quét lại server, đang chờ kết quả...");
        const res = await pollScanResult(
          databases.refetch,
          databases.data?.scannedAt ?? null,
        );
        if (!res?.data) {
          toast.error("Quét server chưa xong sau 30s — thử tải lại sau.");
        } else if (res.data.status === "FAILED") {
          toast.error(`Quét server lỗi: ${res.data.errorMessage ?? "không rõ"}`);
        } else {
          toast.success(`Đã quét xong databases của "${selectedServer?.name ?? effectiveServerId}"`);
        }
      },
      onError: (e) => toast.error(`Gửi yêu cầu quét thất bại: ${e.message}`),
    });
  };

  const handleRescanTables = () => {
    if (!effectiveServerId || !effectiveDb) return;
    rescanTables.mutate(
      { serverId: effectiveServerId, databaseName: effectiveDb },
      {
        onSuccess: async () => {
          toast.info(`Đã gửi yêu cầu quét lại "${effectiveDb}", đang chờ...`);
          const res = await pollScanResult(
            tables.refetch,
            tables.data?.scannedAt ?? null,
          );
          if (!res?.data) {
            toast.error("Quét tables chưa xong sau 30s — thử tải lại sau.");
          } else if (res.data.status === "FAILED") {
            toast.error(`Quét tables lỗi: ${res.data.errorMessage ?? "không rõ"}`);
          } else {
            toast.success(`Đã quét xong tables của "${effectiveDb}"`);
          }
        },
        onError: (e) => toast.error(`Gửi yêu cầu quét thất bại: ${e.message}`),
      },
    );
  };

  return (
    <Panel
      title="Database Inspector"
      right={
        selectedServer && (
          <span className="mono-nums text-[10px] text-[var(--text-muted)]">
            {selectedServer.host} · {selectedServer.type.toUpperCase()}
          </span>
        )
      }
      className="lg:col-span-3"
    >
      <div className="grid md:grid-cols-3">
        {/* servers */}
        <div className="border-b border-[var(--panel-mid)] md:border-b-0 md:border-r">
          <div className="panel-label px-4 py-3">Servers được cấp quyền</div>
          {(servers.data ?? []).map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setServerId(s.id);
                setDbName(null);
              }}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                s.id === effectiveServerId
                  ? "bg-[var(--panel-mid)]/40 text-white"
                  : "text-[var(--panel-light)] hover:bg-[var(--panel-mid)]/20"
              }`}
            >
              <span className="flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                {s.name}
              </span>
              <StatusBadge status={s.status} />
            </button>
          ))}
          {servers.data?.length === 0 && (
            <p className="px-4 py-4 text-xs text-[var(--text-muted)]">
              Tài khoản chưa được cấp quyền server nào.
            </p>
          )}
        </div>

        {/* databases */}
        <div className="border-b border-[var(--panel-mid)] md:border-b-0 md:border-r">
          <div className="panel-label flex items-center justify-between px-4 py-3">
            Databases
            <button
              onClick={handleRescanServer}
              disabled={!effectiveServerId || rescanServer.isPending}
              title="Quét lại databases của server này"
              className="p-1 text-[var(--text-muted)] transition-colors hover:text-white disabled:opacity-40"
            >
              <RefreshCw
                className={`h-3 w-3 ${rescanServer.isPending ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          {(databases.data?.items ?? []).map((d) => (
            <button
              key={d.databaseName}
              onClick={() => setDbName(d.databaseName)}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                d.databaseName === effectiveDb
                  ? "bg-[var(--panel-mid)]/40 text-white"
                  : "text-[var(--panel-light)] hover:bg-[var(--panel-mid)]/20"
              }`}
            >
              <span className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                {d.databaseName}
              </span>
              <span className="mono-nums text-[10px] text-[var(--text-muted)]">
                {d.totalBytes != null ? formatBytes(d.totalBytes) : "—"}
              </span>
            </button>
          ))}
          {(databases.isLoading || databases.data?.items.length === 0) && (
            <p className="px-4 py-4 text-xs text-[var(--text-muted)]">
              {databases.isLoading
                ? "Đang tải databases..."
                : databases.data && !databases.data.scannedAt
                  ? "Server chưa có bản quét nào — bấm nút ↻ để quét."
                  : "Không lấy được database nào từ server này."}
            </p>
          )}
          {databases.data?.status === "FAILED" && (
            <p className="px-4 py-4 text-xs text-[var(--accent-red)]">
              Quét lỗi: {databases.data.errorMessage ?? "không rõ nguyên nhân"}
            </p>
          )}
        </div>

        {/* tables */}
        <div className="max-h-[70vh] overflow-y-auto">
          <div className="panel-label sticky top-0 z-10 flex items-center justify-between bg-[var(--panel-dark)] px-4 py-3">
            <span>Tables {effectiveDb ? `— ${effectiveDb}` : ""}</span>
            <button
              onClick={handleRescanTables}
              disabled={!effectiveServerId || !effectiveDb || rescanTables.isPending}
              title={`Quét lại tables của "${effectiveDb ?? ""}"`}
              className="p-1 text-[var(--text-muted)] transition-colors hover:text-white disabled:opacity-40"
            >
              <RefreshCw
                className={`h-3 w-3 ${rescanTables.isPending ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {(tables.data?.items ?? []).map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-[var(--panel-mid)]/40 last:border-0 hover:bg-[var(--panel-mid)]/20"
                >
                  <td className="px-4 py-2.5 font-medium">{t.tableName}</td>
                  <td className="mono-nums px-4 py-2.5 text-right text-xs text-[var(--panel-light)]">
                    {formatNumber(t.rowCount ?? 0)} rows
                  </td>
                  <td className="mono-nums px-4 py-2.5 text-right text-xs text-[var(--text-muted)]">
                    {t.sizeBytes != null ? formatBytes(t.sizeBytes) : "—"}
                  </td>
                </tr>
              ))}
              {tables.data?.items.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">
                    Không có table nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}

function RecentRuns() {
  const overview = useDashboardOverview();
  const runs = overview.data?.recentRuns ?? [];
  const jobLabels = useBackupJobLabels();
  return (
    <Panel title="Hoạt động gần đây">
      {runs.length === 0 ? (
        <EmptyState
          icon={Activity}
          message="Chưa có hoạt động nào"
          hint="Các lần chạy backup/sync job sẽ xuất hiện ở đây."
        />
      ) : (
        <div className="max-h-[400px] divide-y divide-[var(--panel-mid)]/50 overflow-y-auto">
          {runs.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {r.jobId
                    ? (jobLabels.get(r.jobId) ?? shortId(r.jobId))
                    : (r.jobName ?? "—")}
                </p>
                <p className="mono-nums mt-0.5 text-[10px] text-[var(--text-muted)]">
                  {r.serverName ?? "—"} · {formatDateTime(r.startedAt ?? null)} ·{" "}
                  {r.durationMs != null ? formatDuration(r.durationMs) : "—"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="mono-nums text-xs text-[var(--panel-light)]">
                  {r.sizeBytes ? formatBytes(r.sizeBytes) : "—"}
                </span>
                <StatusBadge status={r.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function DashboardContent() {
  const overview = useDashboardOverview();
  const o = overview.data;

  return (
    <>
      <PageHeader
        title="Dashboard"
        sub="Tổng quan backup jobs, R2 storage và databases bạn được cấp quyền"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={DatabaseBackup}
          label="Backup Jobs"
          value={String(o?.backupJobCount ?? "—")}
          sub="đã đăng ký"
        />
        <StatCard
          icon={RefreshCcw}
          label="Sync Jobs"
          value={String(o?.syncJobCount ?? "—")}
          sub="đã đồng bộ"
        />
        <StatCard
          icon={Activity}
          label="Đang chạy"
          value={String(o?.runningCount ?? "—")}
          sub="job đang hoạt động"
        />
        <StatCard
          icon={Cloud}
          label="Success Rate"
          value={o ? `${o.successRate}%` : "—"}
          sub={`trên ${o?.serverCount ?? 0} servers được cấp quyền`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StorageChart />
        <RecentRuns />
        <DatabaseInspector />
        <JobsOverview />
      </div>
    </>
  );
}

export default function Dashboard() {
  return (
    <AuthLayout>
      <DashboardContent />
    </AuthLayout>
  );
}
