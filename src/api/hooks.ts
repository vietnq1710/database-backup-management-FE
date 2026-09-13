import { useEffect, useMemo, useRef, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { request, requestFile } from "@/lib/api-client";
import { endpoints } from "@/api/endpoints";
import { shortId } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type {
  BackupJob,
  BackupJobWithServer,
  BackupRun,
  CreateBackupJobPayload,
  CreateDatabaseConfigPayload,
  CreateProjectPayload,
  CreateSyncJobPayload,
  CreateUserPermissionPayload,
  DashboardOverview,
  DatabaseConfig,
  DatabaseConfigRef,
  DbObject,
  HistoryFilter,
  JobKind,
  ManagedUser,
  PageResult,
  PermissionResourceType,
  Project,
  RawProject,
  StorageSnapshot,
  SyncJob,
  UpdateBackupJobPayload,
  UpdateDatabaseConfigPayload,
  UpdateProjectPayload,
  UpdateUserPermissionPayload,
  UserPermission,
} from "@/types/api";

const KEYS = {
  projects: ["projects"] as const,
  databaseConfigs: ["database-configs"] as const,
  users: ["users"] as const,
  userPermissions: ["user-permissions"] as const,
  snapshot: (databaseConfigId: string) =>
    ["snapshot", databaseConfigId] as const,
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

// GET /<resource>/page — BE bọc { success, data: PageableDto },
// PageableDto = { total, skip, limit, page, result: [...] }
function parsePage<T>(
  body: unknown,
  mapItem: (raw: Record<string, unknown>) => T,
): PageResult<T> {
  const rec = (body ?? {}) as Record<string, unknown>;
  const data = (rec.data && typeof rec.data === "object"
    ? rec.data
    : rec) as Record<string, unknown>;
  const items = Array.isArray(data.result) ? data.result : [];
  return {
    total: typeof data.total === "number" ? data.total : items.length,
    skip: typeof data.skip === "number" ? data.skip : 0,
    limit: typeof data.limit === "number" ? data.limit : items.length,
    page: typeof data.page === "number" ? data.page : 1,
    result: (items as Record<string, unknown>[]).map(mapItem),
  };
}

// /database-inspector/:configId/tables trả MỘT object snapshot của config
// ({ success, data: { scope, status, databaseName, errorMessage, scannedAt, data: [...] } })
// hoặc data = null khi config chưa từng được quét
export type InspectionPayload<T> = {
  items: T[];
  scannedAt: string | null;
  status: string | null;
  errorMessage: string | null;
  databaseName: string | null;
  scope: string | null;
};

function parseInspection<T>(
  body: unknown,
  mapItem: (raw: Record<string, unknown>) => T,
): InspectionPayload<T> {
  if (Array.isArray(body)) {
    return {
      items: body.map(mapItem),
      scannedAt: null,
      status: null,
      errorMessage: null,
      databaseName: null,
      scope: null,
    };
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
    databaseName: snap ? str(snap.databaseName) : null,
    scope: snap ? str(snap.scope) : null,
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

// Nhận cả number lẫn chuỗi số ("28212" → 28212); BE hay trả size dạng string
function numLike(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Item thật của GET /projects/many: { _id, name, createdAt, updatedAt }
function mapProject(raw: RawProject): Project {
  return {
    id: raw._id ?? raw.id ?? "",
    name: raw.name ?? "(không tên)",
  };
}

// Item row/table thật của snapshot config có thể là { name, rowCount, sizeBytes } hoặc { tableName, ... }
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
    sizeBytes: numLike(raw.size ?? raw.sizeBytes),
    durationMs,
    fileName: str(raw.fileName),
    log: [stdout, stderr].filter(Boolean).join("\n") || null,
    stdout,
    stderr,
    filePath: str(raw.filePath),
    tool: str(raw.tool),
    exitCode: num(raw.exitCode) ?? null,
    expiredAt: str(raw.expiredAt),
  };
}

// Sync job thật của BE: config nguồn/đích nằm lồng trong item (có _id riêng)
// Config thật của BE: config code + đủ field kết nối (thay database-server cũ)
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
    databaseServerId: str(raw.databaseServerId),
    projectId: str(raw.projectId),
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
    projectId: str(raw.projectId) ?? str(raw.databaseServerId),
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt),
  };
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

// ── Projects / database configs / inspector ─────────────────────

export function useProjects() {
  return useQuery({
    queryKey: KEYS.projects,
    queryFn: async () =>
      unwrapMany<RawProject>(await request(endpoints.projects.list)).map(mapProject),
  });
}

// Phân trang server: GET /projects/page?page&limit — dùng cho bảng Projects
export function useProjectsPage(params: { page: number; limit: number }) {
  return useQuery({
    queryKey: [...KEYS.projects, "page", params.page, params.limit] as const,
    queryFn: async () =>
      parsePage<Project>(
        await request(endpoints.projects.page(params)),
        (raw) => mapProject(raw as RawProject),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useCreateProject() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (payload: CreateProjectPayload) =>
      request<unknown>(endpoints.projects.create, {
        method: "POST",
        // api-client tự JSON.stringify — không stringify sẵn để tránh double-encode
        body: payload,
      }),
    onSuccess: invalidateAll,
  });
}

export function useUpdateProject() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProjectPayload }) =>
      request<unknown>(endpoints.projects.update(id), {
        method: "PUT",
        body: payload,
      }),
    onSuccess: invalidateAll,
  });
}

export function useDeleteProject() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) =>
      request<unknown>(endpoints.projects.remove(id), { method: "DELETE" }),
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

// Phân trang server: GET /database-config/page?page&limit — dùng cho bảng Config
export function useDatabaseConfigsPage(params: { page: number; limit: number }) {
  return useQuery({
    queryKey: [...KEYS.databaseConfigs, "page", params.page, params.limit] as const,
    queryFn: async () =>
      parsePage<DatabaseConfig>(
        await request(endpoints.databaseConfigs.page(params)),
        mapDatabaseConfig,
      ),
    placeholderData: keepPreviousData,
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

export function useDeleteDatabaseConfig() {
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) =>
      request<unknown>(endpoints.databaseConfigs.remove(id), {
        method: "DELETE",
      }),
    onSuccess: invalidateAll,
  });
}

// Snapshot của một database config — data = bảng (tables) của database config đó
export function useConfigSnapshot(databaseConfigId: string | null) {
  return useQuery({
    queryKey:
      databaseConfigId !== null
        ? KEYS.snapshot(databaseConfigId)
        : ["snapshot", "none"],
    queryFn: async () =>
      parseInspection(
        await request(endpoints.inspector.tables(databaseConfigId!)),
        mapDbObject,
      ),
    enabled: databaseConfigId !== null,
  });
}

// POST /database-inspector/:configId/rescan — bất đồng bộ (BullMQ),
// snapshot mới có scannedAt mới; FE poll snapshot qua useConfigSnapshot
export function useRescanConfig() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (databaseConfigId: string) =>
      request<unknown>(endpoints.inspector.rescan(databaseConfigId), {
        method: "POST",
      }),
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

// Phân trang server: GET /backup-job/page?page&limit — dùng cho tab Backup Jobs
export function useBackupJobsPage(params: { page: number; limit: number }) {
  return useQuery({
    queryKey: [...KEYS.backupJobs, "page", params.page, params.limit] as const,
    queryFn: async () =>
      parsePage<BackupJobWithServer>(
        await request(endpoints.backupJobs.page(params)),
        (raw) =>
          withNestedJob(
            withIds<BackupJobWithServer>([raw as unknown as BackupJobWithServer]),
          )[0] as BackupJobWithServer,
      ),
    placeholderData: keepPreviousData,
  });
}

// GET /backup-job/count — endpoint nhẹ trả { total, active } cho dashboard,
// tránh phải kéo /backup-job/many full list chỉ để đếm.
export function useBackupJobCount() {
  return useQuery({
    queryKey: [...KEYS.backupJobs, "count"],
    queryFn: async () => {
      // Response bọc trong { success, data } như các endpoint khác của BE
      const body = await request<unknown>(endpoints.backupJobs.count);
      const rec = body as { success?: boolean; data?: unknown } | null;
      const inner =
        rec && typeof rec === "object" && "data" in rec ? rec.data : body;
      const counts = (inner ?? {}) as { total?: number; active?: number };
      return { total: counts.total ?? 0, active: counts.active ?? 0 };
    },
    // isActive hiếm đổi — không cần poll nhanh
    refetchInterval: 30_000,
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

// Phân trang server: GET /sync-job/page?page&limit — dùng cho tab Sync Jobs
export function useSyncJobsPage(params: { page: number; limit: number }) {
  return useQuery({
    queryKey: [...KEYS.syncJobs, "page", params.page, params.limit] as const,
    queryFn: async () =>
      parsePage<SyncJob>(
        await request(endpoints.syncJobs.page(params)),
        mapSyncJob,
      ),
    placeholderData: keepPreviousData,
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
  const counts = useBackupJobCount();
  const syncs = useSyncJobs();
  const projects = useProjects();
  const runs = useHistoryRuns({});
  // Mốc "7 ngày gần nhất" — chốt 1 lần khi mount để useMemo giữ tính thuần khiết
  const [weekCutoff] = useState(
    () => Date.now() - 7 * 24 * 60 * 60 * 1000,
  );

    const data = useMemo<DashboardOverview | undefined>(() => {
      if (!counts.data || !syncs.data || !projects.data || !runs.data) return undefined;
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
        backupJobCount: counts.data.total,
        syncJobCount: syncs.data.length,
        runningCount: counts.data.active,
        projectCount: projects.data.length,
        successRate: weekRuns.length
          ? Math.round((successful / weekRuns.length) * 100)
          : 100,
        recentRuns: allRuns.slice(0, 6),
      };
    }, [counts.data, syncs.data, projects.data, runs.data, weekCutoff]);

  return {
    data,
    isLoading:
      counts.isLoading || syncs.isLoading || projects.isLoading || runs.isLoading,
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

// ── Completion notifications ────────────────────────────────────
// Theo dõi polling data từ sync jobs & backup history, phát hiện
// khi một job hoàn thành rồi bắn toast + bell notification.
//
// Case 1 (sync): job chuyển từ PENDING/RUNNING → SUCCESS/FAILED
// Case 2 (backup): job mới xuất tại FE đã là success/failed
//   (BE chạy xong mới tạo history record → FE không thấy "running")

function syncLabel(j: SyncJob) {
  const label = (c?: DatabaseConfigRef | null) =>
    c ? c.configCode ?? shortId(c.id) : "?";
  return `${label(j.sourceDatabaseConfig)} → ${label(j.targetDatabaseConfig)}`;
}

const KEYSNotifications = {
  backupRuns: ["notifications", "backup-runs"] as const,
};

export function useCompletionNotifications(
  addNotification: (text: string) => void,
) {
  const qc = useQueryClient();
  const seenSyncRef = useRef(new Map<string, string>());
  const seenBackupRef = useRef(new Map<string, string>());
  const initSyncRef = useRef(false);
  const initBackupRef = useRef(false);

  const syncs = useSyncJobs();

  const backupRuns = useQuery({
    queryKey: KEYSNotifications.backupRuns,
    queryFn: async () =>
      unwrapMany<Record<string, unknown>>(
        await request(endpoints.history.list),
      ).map(mapBackupRun),
    refetchInterval: (query) =>
      query.state.data?.some((r) => r.status === "running") ? 3000 : 20000,
  });

  // ── Sync completions ──
  useEffect(() => {
    const jobs = syncs.data;
    if (!jobs) return;
    const seen = seenSyncRef.current;

    if (!initSyncRef.current) {
      for (const j of jobs) {
        if (j.id && j.status) seen.set(j.id, j.status);
      }
      initSyncRef.current = true;
      return;
    }

    let didComplete = false;
    for (const j of jobs) {
      if (!j.id || !j.status) continue;
      const isCompleted = j.status === "SUCCESS" || j.status === "FAILED";
      if (!isCompleted) {
        seen.set(j.id, j.status);
        continue;
      }
      const old = seen.get(j.id);
      const wasCompleted = old === "SUCCESS" || old === "FAILED";
      if (old === undefined || !wasCompleted) {
        const label = syncLabel(j);
        didComplete = true;
        if (j.status === "SUCCESS") {
          toast.success(`Sync hoàn thành: ${label}`);
          addNotification(`Sync hoàn thành: ${label}`);
        } else {
          toast.error(`Sync thất bại: ${label}`);
          addNotification(`Sync thất bại: ${label}`);
        }
      }
      seen.set(j.id, j.status);
    }
    // Có job sync vừa hoàn thành → làm mới query sync (cả many lẫn page)
    // để bảng Quản lý Job cập nhật trạng thái real-time
    if (didComplete) qc.invalidateQueries({ queryKey: KEYS.syncJobs });
  }, [syncs.data, addNotification, qc]);

  // ── Backup completions ──
  useEffect(() => {
    const runs = backupRuns.data;
    if (!runs) return;
    const seen = seenBackupRef.current;

    if (!initBackupRef.current) {
      for (const r of runs) {
        if (r.id) seen.set(r.id, r.status);
      }
      initBackupRef.current = true;
      return;
    }

    for (const r of runs) {
      if (!r.id || !r.status) continue;
      const isCompleted = r.status === "success" || r.status === "failed";
      if (!isCompleted) {
        seen.set(r.id, r.status);
        continue;
      }
      if (!seen.has(r.id)) {
        const label = r.databaseName ?? r.jobName ?? shortId(r.id);
        if (r.status === "success") {
          toast.success(`Backup hoàn thành: ${label}`);
          addNotification(`Backup hoàn thành: ${label}`);
        } else {
          toast.error(`Backup thất bại: ${label}`);
          addNotification(`Backup thất bại: ${label}`);
        }
      }
      seen.set(r.id, r.status);
    }
  }, [backupRuns.data, addNotification]);
}
