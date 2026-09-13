import { useEffect, useMemo, useRef, useState } from "react";
import AuthLayout from "@/components/AuthLayout";
import { PageHeader, Panel, EmptyState } from "@/components/common";
import {
  useConfigSnapshot,
  useDatabaseConfigs,
  useDashboardOverview,
  useHistoryRuns,
  useProjects,
  useRescanConfig,
  useStorageCurrent,
  useStorageSeries,
} from "@/api/hooks";
import {
  formatBytes,
  formatNumber,
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
import { useNotifications } from "@/components/NotificationProvider";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
  const [gran, setGran] = useState<ChartGranularity>("day");
  const scrollRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (scrollRef.current && chartData.length > 0) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [chartData.length]);

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
                    ? "bg-[var(--accent-blue)] text-[var(--foreground)]"
                    : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
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
        <div ref={scrollRef} className="h-64 overflow-x-auto pb-1">
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
  const projects = useProjects();
  const configs = useDatabaseConfigs();
  const [configId, setConfigId] = useState<string | null>(null);

  // snapshot theo config: mỗi database-config = 1 database cố định
  const effectiveConfigId = configId ?? configs.data?.[0]?.id ?? null;
  const snapshot = useConfigSnapshot(effectiveConfigId);
  const rescan = useRescanConfig();
  const { addNotification } = useNotifications();

  const selectedConfig = configs.data?.find((c) => c.id === effectiveConfigId);
  const selectedProjectId = selectedConfig?.projectId ?? null;
  const cfgProject = projects.data?.find((p) => p.id === selectedProjectId);

  const handleRescan = () => {
    if (!effectiveConfigId) return;
    const label = `${selectedConfig?.databaseName ?? "?"} (${selectedConfig?.configCode ?? effectiveConfigId})`;
    rescan.mutate(effectiveConfigId, {
      onSuccess: async () => {
        toast.info("Đã gửi yêu cầu quét lại config, đang chờ kết quả...");
        addNotification(`Đã gửi yêu cầu quét lại "${label}", đang chờ...`);
        const res = await pollScanResult(
          snapshot.refetch,
          snapshot.data?.scannedAt ?? null,
        );
        if (!res?.data) {
          toast.error("Quét config chưa xong sau 30s — thử tải lại sau.");
          addNotification(`Quét config "${label}" chưa xong sau 30s`);
        } else if (res.data.status === "FAILED") {
          const errMsg = res.data.errorMessage ?? "không rõ";
          toast.error(`Quét config lỗi: ${errMsg}`);
          addNotification(`Quét config "${label}" lỗi: ${errMsg}`);
        } else {
          toast.success(`Đã quét xong tables của "${label}"`);
          addNotification(`Đã quét xong tables của "${label}"`);
        }
      },
      onError: (e) => toast.error(`Gửi yêu cầu quét thất bại: ${e.message}`),
    });
  };

  return (
    <Panel
      title="Database Inspector"
      right={
        selectedConfig && (
          <span className="mono-nums text-[10px] text-[var(--text-muted)]">
            {selectedConfig.host ?? "—"} · {(selectedConfig.databaseType ?? "?").toUpperCase()}
          </span>
        )
      }
      className="lg:col-span-3"
    >
      <div className="grid md:grid-cols-3">
        {/* projects */}
        <div className="border-b border-[var(--panel-mid)] md:border-b-0 md:border-r">
          <div className="panel-label px-4 py-3">Projects được cấp quyền</div>
          {(projects.data ?? []).map((p) => (
            <div key={p.id} className="mb-1">
              <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--panel-light)]">
                <Server className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                {p.name}
              </div>
              {(configs.data ?? [])
                .filter((c) => c.projectId === p.id)
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setConfigId(c.id)}
                    className={`flex w-full items-center justify-between py-1.5 pl-9 pr-4 text-left text-xs transition-colors ${
                      c.id === effectiveConfigId
                        ? "bg-[var(--panel-mid)]/40 text-[var(--foreground)]"
                        : "text-[var(--panel-light)] hover:bg-[var(--panel-mid)]/20"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Database className="h-3 w-3 text-[var(--accent-blue)]" />
                      {c.databaseName ?? "?"}
                    </span>
                    <span className="mono-nums text-[9px] text-[var(--text-muted)]">
                      {c.configCode ? c.configCode : ""}
                    </span>
                  </button>
                ))}
            </div>
          ))}
          {projects.data?.length === 0 && (
            <p className="px-4 py-4 text-xs text-[var(--text-muted)]">
              Tài khoản chưa được cấp quyền project nào.
            </p>
          )}
        </div>

        {/* config info */}
        <div className="border-b border-[var(--panel-mid)] md:border-b-0 md:border-r">
          <div className="panel-label px-4 py-3">Config</div>
          {selectedConfig ? (
            <div className="space-y-2 px-4 py-2 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Config code
                </div>
                <div className="mono-nums">{selectedConfig.configCode ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Project
                </div>
                <div>{cfgProject?.name ?? selectedProjectId ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Database
                </div>
                <div className="mono-nums">{selectedConfig.databaseName ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Host
                </div>
                <div className="mono-nums">
                  {selectedConfig.host ?? "—"}
                  {selectedConfig.port ? `:${selectedConfig.port}` : ""}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  User
                </div>
                <div className="mono-nums">{selectedConfig.username ?? "—"}</div>
              </div>
              {snapshot.data?.scannedAt && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    Quét gần nhất
                  </div>
                  <div className="mono-nums">{snapshot.data.scannedAt}</div>
                </div>
              )}
              {snapshot.data?.status === "FAILED" && (
                <p className="border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 px-2 py-1.5 text-[var(--accent-red)]">
                  Quét lỗi: {snapshot.data.errorMessage ?? "không rõ nguyên nhân"}
                </p>
              )}
            </div>
          ) : (
            <p className="px-4 py-4 text-xs text-[var(--text-muted)]">
              Chưa có database config nào.
            </p>
          )}
        </div>

        {/* snapshot tables */}
        <div className="max-h-[100vh] overflow-y-auto">
          <div className="panel-label sticky top-0 z-10 flex items-center justify-between bg-[var(--panel-dark)] px-4 py-3">
            <span>
              Tables{" "}
              {selectedConfig?.databaseName
                ? `— ${selectedConfig.databaseName}`
                : ""}
            </span>
            <button
              onClick={handleRescan}
              disabled={!effectiveConfigId || rescan.isPending}
              title={`Quét lại snapshot của "${selectedConfig?.databaseName ?? ""}"`}
              className="p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-40"
            >
              <RefreshCw
                className={`h-3 w-3 ${rescan.isPending ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {(snapshot.data?.items ?? []).map((t) => (
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
              {snapshot.data?.items.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">
                    {snapshot.isLoading
                      ? "Đang tải..."
                      : snapshot.data && !snapshot.data.scannedAt
                        ? "Config chưa có bản quét nào — bấm nút ↻ để quét."
                        : "Không có table nào"}
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
  const runs = useHistoryRuns({});
  const chartData = useMemo(() => {
    const days = 7;
    const buckets = new Map<string, { success: number; failed: number }>();
    const bucketKey = (t: number) => {
      const d = new Date(t);
      return `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1,
      ).padStart(2, "0")}`;
    };
    for (let i = days - 1; i >= 0; i--) {
      const t = Date.now() - i * 24 * 60 * 60 * 1000;
      buckets.set(bucketKey(t), { success: 0, failed: 0 });
    }
    for (const r of runs.data ?? []) {
      const at = r.startedAt ?? r.finishedAt;
      if (!at) continue;
      const t = new Date(at).getTime();
      if (Number.isNaN(t)) continue;
      const key = bucketKey(t);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (r.status === "success") bucket.success += 1;
      else if (r.status === "failed") bucket.failed += 1;
    }
    return [...buckets.entries()].map(([date, v]) => ({ date, ...v }));
  }, [runs.data]);
  const totalJobs = chartData.reduce(
    (sum, b) => sum + b.success + b.failed,
    0,
  );
  return (
    <Panel
      title="Hoạt động 7 ngày"
      right={
        <span className="mono-nums text-xs text-[var(--panel-light)]">
          {totalJobs} job đã thực hiện
        </span>
      }
    >
      <div className="p-5">
        {runs.isError ? (
          <EmptyState
            icon={Activity}
            message={`Không tải được hoạt động: ${(runs.error as Error).message}`}
          />
        ) : chartData.every((b) => b.success === 0 && b.failed === 0) ? (
          <EmptyState
            icon={Activity}
            message="Chưa có hoạt động nào"
            hint="Các lần chạy backup/sync job sẽ xuất hiện ở đây."
          />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={18} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--panel-mid)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    background: "var(--panel-dark)",
                    border: "1px solid var(--panel-mid)",
                    borderRadius: 0,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--panel-light)" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="success" name="Thành công" stackId="a" fill="#2c9e28" />
                <Bar dataKey="failed" name="Thất bại" stackId="a" fill="#da391d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Panel>
  );
}

function DashboardContent() {
  const overview = useDashboardOverview();
  const o = overview.data;

  return (
    <>
      <PageHeader
        title="Trang chủ"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={DatabaseBackup}
          label="Lịch sao lưu dữ liệu"
          value={String(o?.backupJobCount ?? "—")}
          sub="đã đăng ký"
        />
        <StatCard
          icon={RefreshCcw}
          label="Lịch đồng bộ dữ liệu"
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
          label="Tỉ lệ thành công"
          value={o ? `${o.successRate}%` : "—"}
          sub={`trên ${o?.projectCount ?? 0} projects được cấp quyền`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StorageChart />
        <RecentRuns />
        <DatabaseInspector />
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
