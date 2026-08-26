import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request, requestFile } from "@/lib/api-client";
import { endpoints } from "@/api/endpoints";
import { shortId } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import type {
  BackupJob,
  BackupJobWithServer,
  BackupRun,
  CreateBackupJobPayload,
  CreateDatabaseConfigPayload,
  CreateDatabaseServerPayload,
  CreateSyncJobPayload,
  CreateUserPermissionPayload,
  DashboardOverview,
  DatabaseConfig,
  DatabaseConfigRef,
  DatabaseSummary,
  DbObject,
  HistoryFilter,
  JobKind,
  ManagedUser,
  PermissionResourceType,
  RawServer,
  Server,
  StorageSnapshot,
  SyncJob,
  UpdateBackupJobPayload,
  UpdateDatabaseConfigPayload,
  UpdateDatabaseServerPayload,
  UpdateUserPermissionPayload,
  UserPermission,
} from "@/types/api";

const KEYS = {
  servers: ["servers"] as const,
  databaseConfigs: ["database-configs"] as const,
  users: ["users"] as const,
  userPermissions: ["user-permissions"] as const,
  databases: (serverId: string) => ["servers", serverId, "databases"] as const,
  tables: (serverId: string, db: string) =>
    ["servers", serverId, "databases", db, "tables"] as const,
  backupJobs: ["jobs", "backup"] as const,
  syncJobs: ["jobs", "sync"] as const,
  history: (filter: HistoryFilter) => ["history", filter] as const,
};

// BE có thể trả mảng trực tiếp hoặc bọc trong { items } / { data }
type ManyResponse<T> = T[] | { items?: T[]; data?: T[] };

function unwrapMany<T>(data: ManyResponse<T>): T[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray((data as ManyResponse<T> & { data?: T[] }).data))
    return (data as { data: T[] }).data;
  return [];
}

// /database-inspector trả MỘT object snapshot ({ success, data: { scope, status, scannedAt, errorMessage, data: [...] } })
// hoặc data = null khi server/db chưa từng được quét
export type InspectionPayload<T> = {
  items: T[];
  scannedAt: string | null;
  status: string | null;
  errorMessage: string | null;
};

function parseInspection<T>(
  body: unknown,
  mapItem: (raw: Record<string, unknown>) => T,
): InspectionPayload<T> {
  if (Array.isArray(body)) {
    return { items: body.map(mapItem), scannedAt: null, status: null, errorMessage: null };
  }
  const rec = (body ?? {}) as Record<string, unknown>;
  const inner = rec.data;
  let items: unknown[] = [];
  let snap: Record<string, unknown> | null = null;
  if (Array.isArray(inner)) {
    items = inner;
  } else if (inner && typeof inner === "object") {
    snap = inner as Record<string, unknown>;
    if (Array.isArray(snap.data)) items = snap.data;
  }
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    items: (items as Record<string, unknown>[]).map(mapItem),
    scannedAt: snap ? str(snap.scannedAt) : null,
    status: snap ? str(snap.status) : null,
    errorMessage: snap ? str(snap.errorMessage) : null,
  };
}

// BE trả object phẳng (không bọc { job }) — gắn job = chính item để FE dùng thống nhất
function withNestedJob<T>(items: T[]): T[] {
  return items.map((item) => {
    const rec = item as Record<string, unknown>;
    return rec.job ? item : ({ ...rec, job: item } as T);
  });
}

// Mongo trả _id (ObjectId string) — chuẩn hóa thành id
function withIds<T>(items: T[]): T[] {
  return items.map((item) => {
    const rec = item as Record<string, unknown>;
    return rec.id ? item : ({ ...rec, id: rec._id } as T);
  });
}

function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function mapServer(raw: RawServer): Server {
  return {
    id: raw._id ?? raw.id ?? "",
    name: raw.serverName ?? raw.name ?? "(không tên)",
    environment: raw.environment ?? null,
    type: raw.type ?? raw.dbType ?? "postgres",
    host: raw.host ?? null,
    port: raw.port ?? null,
    username: raw.username ?? null,
    status: "online",
  };
}

// Item database thật của BE: { name, sizeBytes }
function mapDatabase(raw: Record<string, unknown>): DatabaseSummary {
  return {
    databaseName: (raw.databaseName ?? raw.name ?? "(không tên)") as string,
    totalBytes: num(raw.totalBytes ?? raw.sizeBytes),
  };
}

// Item table thật của BE có thể là { name, rowCount, sizeBytes } hoặc { tableName, ... }
function mapDbObject(raw: Record<string, unknown>): DbObject {
  return {
    id: String(raw.id ?? raw._id ?? raw.tableName ?? raw.name ?? ""),
    tableName: (raw.tableName ?? raw.name ?? "(không tên)") as string,
    rowCount: num(raw.rowCount ?? raw.rows),
    sizeBytes: num(raw.sizeBytes ?? raw.totalBytes),
  };
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

// Item thật của GET /backup-history/many:
// { _id, backupJobId, fileName, filePath, status: "SUCCESS", startTime, endTime,
//   expiredAt, databaseType, tool, description, stdout, stderr (rất dài),
//   size, exitCode, databaseConfigId, createdAt, updatedAt }
// Lưu ý: startTime/endTime của BE hiện CHỈ chứa ngày ("2026-08-22") nên
// giờ chạy hiển thị theo createdAt; duration chỉ tính được khi có ISO đầy đủ.
function mapBackupRun(raw: Record<string, unknown>): BackupRun {
  const description = str(raw.description);
  const dbName = description?.match(/database "([^"]+)"/i)?.[1] ?? null;
  const server = description?.match(/from (\S+) using/i)?.[1] ?? null;
  const startIso =
    typeof raw.startTime === "string" && raw.startTime.length > 10
      ? raw.startTime
      : null;
  const endIso =
    typeof raw.endTime === "string" && raw.endTime.length > 10
      ? raw.endTime
      : null;
  const statusRaw = str(raw.status)?.toLowerCase() ?? "";
  const durationMs =
    startIso && endIso
      ? Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime())
      : null;
  const stdout = str(raw.stdout);
  const stderr = str(raw.stderr);
  return {
    id: String(raw.id ?? raw._id ?? ""),
    kind: "backup",
    jobId: str(raw.backupJobId ?? raw.jobId),
    databaseName: dbName,
    serverName: server,
    startedAt: str(raw.createdAt) ?? startIso,
    finishedAt: endIso,
    status:
      statusRaw === "success"
        ? "success"
        : statusRaw === "failed"
          ? "failed"
          : "running",
    sizeBytes: num(raw.size ?? raw.sizeBytes) ?? null,
    durationMs,
    fileName: str(raw.fileName),
    log: [stdout, stderr].filter(Boolean).join("\n") || null,
    filePath: str(raw.filePath),
    tool: str(raw.tool),
    exitCode: num(raw.exitCode) ?? null,
    expiredAt: str(raw.expiredAt),
  };
}

// Sync job thật của BE: config nguồn/đích nằm lồng trong item (có _id riêng)
function mapConfig(raw: Record<string, unknown>): DatabaseConfigRef {
  return {
    id: String(raw.id ?? raw._id ?? ""),
    configCode: str(raw.configCode),
    databaseType: str(raw.databaseType),
    host: str(raw.host),
    port: num(raw.port),
    databaseName: str(raw.databaseName),
    username: str(raw.username),
    environment: str(raw.environment),
  };
}

function mapSyncJob(raw: Record<string, unknown>): SyncJob {
  const src = raw.sourceDatabaseConfig;
  const tgt = raw.targetDatabaseConfig;
  return {
    id: String(raw.id ?? raw._id ?? ""),
    sourceDatabaseConfigId: str(raw.sourceDatabaseConfigId),
    targetDatabaseConfigId: str(raw.targetDatabaseConfigId),
    triggeredBy: str(raw.triggeredBy),
    status: str(raw.status),
    dumpFilePath: str(raw.dumpFilePath),
    errorMessage: str(raw.errorMessage),
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt),
    sourceDatabaseConfig:
      src && typeof src === "object"
        ? mapConfig(src as Record<string, unknown>)
        : null,
    targetDatabaseConfig:
      tgt && typeof tgt === "object"
        ? mapConfig(tgt as Record<string, unknown>)
        : null,
  };
}

// Item sync-job cũng là một "run" (mỗi bản ghi mang status lần chạy riêng) —
// map sang shape Run để hiển thị chung bảng lịch sử ở tab Sync.
// Lưu ý: BE chỉ có createdAt/updatedAt, KHÔNG lưu thời điểm bắt đầu chạy →
// không tính duration (updatedAt - createdAt gồm cả thời gian chờ queue)
function mapSyncRun(raw: Record<string, unknown>): BackupRun {
  const s = mapSyncJob(raw);
  const label = (c?: DatabaseConfigRef | null) =>
    c ? c.configCode ?? shortId(c.id) : "?";
  const running = s.status === "PENDING" || s.status === "RUNNING";
  const statusRaw = s.status?.toLowerCase() ?? "";
  return {
    id: s.id,
    kind: "sync",
    jobName: `${label(s.sourceDatabaseConfig)} → ${label(s.targetDatabaseConfig)}`,
    serverName: s.sourceDatabaseConfig?.host ?? null,
    databaseName: s.sourceDatabaseConfig?.databaseName ?? null,
    status:
      statusRaw === "success"
        ? "success"
        : statusRaw === "failed"
          ? "failed"
          : "running",
    startedAt: s.createdAt,
    finishedAt: running ? null : s.updatedAt,
    durationMs: null,
    fileName: s.dumpFilePath?.split(/[\\/]/).pop() ?? null,
    log: s.errorMessage ?? null,
    triggeredBy: s.triggeredBy,
  };
}

// Item đầy đủ của GET /database-config/many
function mapDatabaseConfig(raw: Record<string, unknown>): DatabaseConfig {
  return {
    ...mapConfig(raw),
    databaseServerId: str(raw.databaseServerId),
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt),
  };
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

// ── Servers / database inspector ─────────────────────────────────

export function useServers() {
  return useQuery({
    queryKey: KEYS.servers,
    queryFn: async () =>
      unwrapMany<RawServer>(await request(endpoints.servers.list)).map(mapServer),
  });
}

export function useCreateDatabaseServer() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (payload: CreateDatabaseServerPayload) =>
      request<unknown>(endpoints.servers.create, {
        method: "POST",
        // api-client tự JSON.stringify — không stringify sẵn để tránh double-encode
        body: payload,
      }),
    onSuccess: invalidateAll,
  });
}

export function useUpdateDatabaseServer() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDatabaseServerPayload }) =>
      request<unknown>(endpoints.servers.update(id), {
        method: "PUT",
        body: payload,
      }),
    onSuccess: invalidateAll,
  });
}

export function useDeleteDatabaseServer() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) =>
      request<unknown>(endpoints.servers.remove(id), { method: "DELETE" }),
    onSuccess: invalidateAll,
  });
}

// ── Database configs ─────────────────────────────────────────────

export function useDatabaseConfigs() {
  return useQuery({
    queryKey: KEYS.databaseConfigs,
    queryFn: async () =>
      unwrapMany<Record<string, unknown>>(
        await request(endpoints.databaseConfigs.list),
      ).map(mapDatabaseConfig),
  });
}

export function useCreateDatabaseConfig() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (payload: CreateDatabaseConfigPayload) =>
      request<unknown>(endpoints.databaseConfigs.create, {
        method: "POST",
        body: payload,
      }),
    onSuccess: invalidateAll,
  });
}

export function useUpdateDatabaseConfig(id: string) {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (payload: UpdateDatabaseConfigPayload) =>
      request<unknown>(endpoints.databaseConfigs.update(id), {
        method: "PUT",
        body: payload,
      }),
    onSuccess: invalidateAll,
  });
}

export function useDatabases(serverId: string | null) {
  return useQuery({
    queryKey: serverId !== null ? KEYS.databases(serverId) : ["servers", "databases"],
    queryFn: async () =>
      parseInspection(
        await request(endpoints.inspector.databases(serverId!)),
        mapDatabase,
      ),
    enabled: serverId !== null,
  });
}

export function useTables(serverId: string | null, databaseName: string | null) {
  return useQuery({
    queryKey:
      serverId !== null && databaseName !== null
        ? KEYS.tables(serverId, databaseName)
        : ["servers", "tables"],
    queryFn: async () =>
      parseInspection(
        await request(endpoints.inspector.tables(serverId!, databaseName!)),
        mapDbObject,
      ),
    enabled: serverId !== null && databaseName !== null,
  });
}

export function useRescanServer() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (serverId: string) =>
      request<unknown>(endpoints.inspector.rescanServer(serverId), {
        method: "POST",
      }),
    onSuccess: () => invalidate(),
  });
}

export function useRescanTables() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({
      serverId,
      databaseName,
    }: {
      serverId: string;
      databaseName: string;
    }) =>
      request<unknown>(
        endpoints.inspector.rescanTables(serverId, databaseName),
        { method: "POST" },
      ),
    onSuccess: () => invalidate(),
  });
}

// ── Jobs ─────────────────────────────────────────────────────────

export function useBackupJobs() {
  return useQuery({
    queryKey: KEYS.backupJobs,
    queryFn: async () =>
      withNestedJob(
        withIds<BackupJobWithServer>(
          unwrapMany<BackupJobWithServer>(
            await request(endpoints.backupJobs.list),
          ),
        ),
      ),
  });
}

export function useSyncJobs() {
  return useQuery({
    queryKey: KEYS.syncJobs,
    queryFn: async () =>
      unwrapMany<Record<string, unknown>>(
        await request(endpoints.syncJobs.list),
      ).map(mapSyncJob),
    // Sync chạy bất đồng bộ phía BE — tự poll để trạng thái
    // PENDING/RUNNING cập nhật thành SUCCESS/FAILED mà không cần F5
    refetchInterval: (query) => {
      const active = query.state.data?.some(
        (j) => j.status === "PENDING" || j.status === "RUNNING",
      );
      return active ? 3000 : 15000;
    },
  });
}

// /backup-history chỉ có backupJobId (không có tên job) — join phía FE:
// backupJobId -> backup job -> database config (configCode + databaseName)
export function useBackupJobLabels() {
  const backups = useBackupJobs();
  const configs = useDatabaseConfigs();
  return useMemo(() => {
    const cfgById = new Map((configs.data ?? []).map((c) => [c.id, c]));
    const labels = new Map<string, string>();
    for (const { job } of backups.data ?? []) {
      const cfg = cfgById.get(job.databaseConfigId);
      labels.set(
        job.id,
        cfg
          ? `${cfg.configCode ?? shortId(job.id)} — ${cfg.databaseName ?? "?"}`
          : shortId(job.id),
      );
    }
    return labels;
  }, [backups.data, configs.data]);
}

export function useCreateBackupJob() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (payload: CreateBackupJobPayload) =>
      request<unknown>(endpoints.backupJobs.create, {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateBackupJob() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBackupJobPayload }) =>
      request<unknown>(endpoints.backupJobs.update(id), {
        method: "PUT",
        body: payload,
      }),
    onSuccess: () => invalidate(),
  });
}

export function useCreateSyncJob() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (payload: CreateSyncJobPayload) =>
      request<unknown>(endpoints.syncJobs.create, {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => invalidate(),
  });
}

// BE không có route toggle riêng — dùng update.
// Entity job của BE dùng boolean isActive (không có status) → body gửi { isActive }.
// sync-job chỉ có PUT /many/ids — body vẫn đang đoán, cần đối chiếu DTO.
export function useToggleJob() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({
      kind,
      id,
      isActive,
      current,
    }: {
      kind: JobKind;
      id: string;
      isActive: boolean;
      // PUT /backup-job/:id: DTO update bên BE yêu cầu đủ các trường bắt buộc
      // như create — chỉ gửi { isActive } sẽ bị từ chối
      // ("retentionDays must be a number conforming to the specified constraints")
      current?: BackupJob;
    }) =>
      kind === "backup"
        ? request<unknown>(endpoints.backupJobs.update(id), {
            method: "PUT",
            body: {
              databaseConfigId: current?.databaseConfigId,
              cronExpression: current?.cronExpression,
              retentionDays: current?.retentionDays,
              isActive,
            },
          })
        : request<unknown>(endpoints.syncJobs.updateMany, {
            method: "PUT",
            body: { ids: [id], isActive },
          }),
    onSuccess: () => invalidate(),
  });
}

export function useRemoveJob() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: JobKind; id: string }) =>
      kind === "backup"
        ? request<unknown>(endpoints.backupJobs.remove(id), { method: "DELETE" })
        : request<unknown>(endpoints.syncJobs.removeMany, {
            method: "DELETE",
            body: [id],
          }),
    onSuccess: () => invalidate(),
  });
}

// ── Users / user permissions ─────────────────────────────────────

export function useUsers() {
  return useQuery({
    queryKey: KEYS.users,
    queryFn: async () =>
      unwrapMany<Record<string, unknown>>(await request(endpoints.users.list)).map(
        (raw): ManagedUser => ({
          id: String(raw.id ?? raw._id ?? ""),
          ssoId: str(raw.ssoId),
          username: str(raw.username),
          fullname: str(raw.fullname),
          email: str(raw.email),
          systemRole: str(raw.systemRole),
        }),
      ),
  });
}

export function useUserPermissions() {
  return useQuery({
    queryKey: KEYS.userPermissions,
    queryFn: async () =>
      withIds<UserPermission>(
        unwrapMany<UserPermission>(await request(endpoints.userPermissions.list)),
      ),
    // Endpoint yêu cầu quyền quản lý — user thường ăn 403 ngay,
    // không retry làm chậm việc xác định canManage
    retry: false,
  });
}

export function useCreateUserPermission() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (payload: CreateUserPermissionPayload) =>
      request<unknown>(endpoints.userPermissions.create, {
        method: "POST",
        body: payload,
      }),
    onSuccess: invalidateAll,
  });
}

// PUT /user-permission/:id chỉ chấp nhận { permissions }
export function useUpdateUserPermission(id: string) {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (payload: UpdateUserPermissionPayload) =>
      request<unknown>(endpoints.userPermissions.update(id), {
        method: "PUT",
        body: payload,
      }),
    onSuccess: invalidateAll,
  });
}

export function useDeleteUserPermission() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) =>
      request<unknown>(endpoints.userPermissions.remove(id), {
        method: "DELETE",
      }),
    onSuccess: invalidateAll,
  });
}

// Đảm bảo user có entry (userId + resourceType + resourceId) mang các permissions chỉ định:
// đã có entry → PUT gộp (union) permissions; chưa có → POST tạo mới.
// Dùng cho flow "thêm quyền liên quan" trong dialog Sửa quyền — ví dụ cấp server A
// xong cấp luôn quyền database-config trên các config con của A mà không tạo entry trùng.
export function useEnsureUserPermission() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      resourceType: PermissionResourceType;
      resourceId?: string;
      permissions: string[];
    }) => {
      if (input.permissions.length === 0) return null;
      const list = withIds<UserPermission>(
        unwrapMany<UserPermission>(
          await request(endpoints.userPermissions.list),
        ),
      );
      const existing = list.find(
        (p) =>
          p.userId === input.userId &&
          p.resourceType === input.resourceType &&
          (p.resourceId ?? "") === (input.resourceId ?? ""),
      );
      if (!existing) {
        return request<unknown>(endpoints.userPermissions.create, {
          method: "POST",
          body: {
            userId: input.userId,
            resourceType: input.resourceType,
            ...(input.resourceId ? { resourceId: input.resourceId } : {}),
            permissions: input.permissions,
          } satisfies CreateUserPermissionPayload,
        });
      }
      const merged = Array.from(
        new Set([...existing.permissions, ...input.permissions]),
      );
      if (merged.length === existing.permissions.length) return existing;
      return request<unknown>(endpoints.userPermissions.update(existing.id), {
        method: "PUT",
        body: { permissions: merged } satisfies UpdateUserPermissionPayload,
      });
    },
    onSuccess: invalidateAll,
  });
}

// Capability quản lý trang phân quyền: chỉ admin (realm role Keycloak hoặc
// systemRole bên BE) hoặc user có entry chứa "permission:manage".
// /user-permission/many yêu cầu quyền quản lý — user thường bị chặn (403)
// nên query lỗi coi như không có quyền; entry của mình nhận diện qua
// userId = _id collection users (tìm bằng ssoId = sub Keycloak trong token)
export function useMyPermissionsView() {
  const { user } = useAuth();
  const users = useUsers();
  const perms = useUserPermissions();

  // Bản ghi user của mình trong BE (so sánh cả id phòng khi BE lưu thẳng sub)
  const myRecord = useMemo(() => {
    if (!user) return null;
    return (
      (users.data ?? []).find(
        (u) => u.ssoId === user.unionId || u.id === user.unionId,
      ) ?? null
    );
  }, [user, users.data]);

  const isAdmin =
    user?.role === "admin" ||
    (myRecord?.systemRole ?? "").toLowerCase().includes("admin");

  const hasManageEntry =
    perms.data?.some(
      (p) =>
        p.userId === (myRecord?.id ?? "") &&
        p.permissions.includes("permission:manage"),
    ) ?? false;

  const canManage = isAdmin || hasManageEntry;

  return {
    isAdmin,
    canManage,
    // chưa xác định được (đang load users/permissions) thì chờ, đừng flash UI
    resolving: users.isLoading || perms.isLoading,
  };
}

// ── Dashboard (tổng hợp phía client từ các endpoint có sẵn) ──────

export function useDashboardOverview() {
  const backups = useBackupJobs();
  const syncs = useSyncJobs();
  const servers = useServers();
  const runs = useHistoryRuns({});
  // Mốc "7 ngày gần nhất" — chốt 1 lần khi mount để useMemo giữ tính thuần khiết
  const [weekCutoff] = useState(
    () => Date.now() - 7 * 24 * 60 * 60 * 1000,
  );

    const data = useMemo<DashboardOverview | undefined>(() => {
      if (!backups.data || !syncs.data || !servers.data || !runs.data) return undefined;
      const allRuns = [...runs.data].sort(
        (a, b) =>
          new Date(b.startedAt ?? 0).getTime() - new Date(a.startedAt ?? 0).getTime(),
      );
      // Success rate chỉ tính trên run của 7 ngày gần nhất
      const weekRuns = allRuns.filter(
        (r) =>
          new Date(r.startedAt ?? r.finishedAt ?? 0).getTime() >= weekCutoff,
      );
      const successful = weekRuns.filter((r) => r.status === "success").length;
      return {
        backupJobCount: backups.data.length,
        syncJobCount: syncs.data.length,
        // BE không có trạng thái "running" ở mức job — backup job có boolean isActive,
        // sync job chỉ có status lần chạy → chỉ đếm backup active
        runningCount: backups.data.filter((r) => r.job.isActive).length,
        serverCount: servers.data.length,
        successRate: weekRuns.length
          ? Math.round((successful / weekRuns.length) * 100)
          : 100,
        recentRuns: allRuns.slice(0, 6),
      };
    }, [backups.data, syncs.data, servers.data, runs.data, weekCutoff]);

  return {
    data,
    isLoading:
      backups.isLoading || syncs.isLoading || servers.isLoading || runs.isLoading,
  };
}

export function useStorageSeries() {
  return useQuery({
    queryKey: ["storage", "series"],
    queryFn: async () =>
      unwrapMany<StorageSnapshot>(await request(endpoints.storage.series)),
  });
}

// Snapshot mới nhất của R2 (dùng làm fallback khi chuỗi lịch sử trống/lỗi).
// Response thật là object bọc trong { success, data } — KHÔNG phải mảng
export function useStorageCurrent() {
  return useQuery({
    queryKey: ["storage", "current"],
    queryFn: async () => {
      const body = await request<unknown>(endpoints.storage.current);
      const rec = body as Record<string, unknown> | null;
      const inner =
        rec && typeof rec === "object" && "data" in rec ? rec.data : body;
      return (inner ?? null) as StorageSnapshot | null;
    },
    // Snapshot thay đổi mỗi lần BE quét R2 — làm mới nhẹ mỗi phút
    refetchInterval: 60000,
  });
}

// ── History ──────────────────────────────────────────────────────

export function useHistoryRuns(filter: HistoryFilter) {
  return useQuery({
    queryKey: KEYS.history(filter),
    queryFn: async () => {
      // Endpoint many của BE bỏ qua tham số ?status/?kind (và giá trị status
      // bên BE là chữ hoa) nên lọc + sắp xếp phía FE cho chắc chắn
      const backups = unwrapMany<Record<string, unknown>>(
        await request(endpoints.history.list),
      ).map(mapBackupRun);
      // /backup-history chỉ chứa run backup — run sync lấy từ GET /sync-job/many
      const needSync =
        !filter.kind || filter.kind === "all" || filter.kind === "sync";
      const syncs = needSync
        ? unwrapMany<Record<string, unknown>>(
            await request(endpoints.syncJobs.list),
          ).map(mapSyncRun)
        : [];
      const all = [...backups, ...syncs];
      const byKind =
        filter.kind && filter.kind !== "all"
          ? all.filter((r) => r.kind === filter.kind)
          : all;
      const filtered =
        filter.status && filter.status !== "all"
          ? byKind.filter((r) => r.status === filter.status)
          : byKind;
      return filtered.sort(
        (a, b) =>
          new Date(b.startedAt ?? b.finishedAt ?? 0).getTime() -
          new Date(a.startedAt ?? a.finishedAt ?? 0).getTime(),
      );
    },
    // Run đang chạy → poll nhanh để khi xong hiện ngay kết quả
    refetchInterval: (query) =>
      query.state.data?.some((r) => r.status === "running") ? 3000 : 20000,
  });
}

export function downloadRunFile(id: string, fallbackName?: string) {
  return requestFile(endpoints.history.download(id), fallbackName);
}
