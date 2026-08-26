export type Role = "user" | "admin";

export interface User {
  id: string;
  unionId: string;
  username: string | null;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: Role;
}

// BE trả "postgres" | "mongo"
export type DbType = "postgres" | "mysql" | "mongo" | "redis";
export type ServerStatus = "online" | "offline" | "degraded";

// ── Enum thật của BE (22/08/2026) ────────────────────────────────

export type DatabaseEngine = "postgres" | "mongo";
export type EnvironmentType = "DEVELOPMENT" | "UAT" | "STAGING" | "PRODUCTION";

// ── Raw shapes từ BE (Mongo, _id là ObjectId string) ────────────

export interface RawServer {
  _id?: string;
  id?: string;
  serverName?: string;
  name?: string;
  environment?: string | null;
  type?: DbType;
  dbType?: DbType;
  host?: string | null;
  port?: number | null;
  username?: string | null;
  connectionOptions?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// ── FE shapes ────────────────────────────────────────────────────

export interface Server {
  id: string;
  name: string;
  environment: string | null;
  type: DbType;
  host: string | null;
  port: number | null;
  username: string | null;
  status: ServerStatus;
  connectionOptions?: string | null;
}

// DTO thật của POST /database-server (22/08/2026)
export interface CreateDatabaseServerPayload {
  serverName: string;
  environment: EnvironmentType;
  type: DatabaseEngine;
  host: string;
  port: number;
  username: string;
  password: string;
  connectionOptions?: string;
}

// PUT /database-server/:id — base controller dùng PartialType(entity) nên mọi trường optional
export interface UpdateDatabaseServerPayload {
  serverName?: string;
  environment?: EnvironmentType;
  type?: DatabaseEngine;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  connectionOptions?: string;
}

export interface DatabaseSummary {
  databaseName: string;
  tableCount?: number;
  totalRows?: number;
  totalBytes?: number;
}

export interface DbObject {
  id: string;
  databaseName?: string;
  tableName: string;
  rowCount?: number;
  sizeBytes?: number;
  engine?: string | null;
  updatedAt?: string | null;
}

export type JobStatus = "active" | "paused" | "running";
export type RunStatus = "success" | "failed";
export type RunKind = "backup" | "sync";

// Shape thật của GET /backup-job/many (22/08/2026):
// { _id, databaseConfigId, cronExpression, retentionDays, isActive, createdAt, updatedAt }
export interface BackupJob {
  id: string;
  databaseConfigId: string;
  cronExpression: string | null;
  retentionDays?: number | null;
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface BackupJobWithServer {
  job: BackupJob;
}

export function jobStatusOf(job: Pick<BackupJob, "isActive">): "active" | "paused" {
  return job.isActive ? "active" : "paused";
}

// Shape thật của GET /sync-job/many (22/08/2026): KHÔNG có cronExpression/isActive.
// Có status lần chạy ("SUCCESS"/"FAILED"...) và config nguồn/đích populate sẵn.
export interface DatabaseConfigRef {
  id: string;
  configCode: string | null;
  databaseType: string | null;
  host: string | null;
  port?: number | null;
  databaseName: string | null;
  username?: string | null;
  environment?: string | null;
}

// Item đầy đủ của GET /database-config/many (shape khớp phần populate trong sync job)
export type DatabaseConfig = DatabaseConfigRef & {
  databaseServerId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

// DTO thật của POST /database-config (22/08/2026)
export interface CreateDatabaseConfigPayload {
  configCode: string;
  databaseServerId: string;
  databaseName: string;
}

// DTO thật của PUT /database-config/:id (22/08/2026) — mọi trường đều optional
export interface UpdateDatabaseConfigPayload {
  configCode?: string;
  username?: string;
  password?: string;
}

export interface SyncJob {
  id: string;
  sourceDatabaseConfigId: string | null;
  targetDatabaseConfigId: string | null;
  triggeredBy?: string | null;
  status: string | null;
  dumpFilePath?: string | null;
  errorMessage?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  sourceDatabaseConfig?: DatabaseConfigRef | null;
  targetDatabaseConfig?: DatabaseConfigRef | null;
}

export interface BackupRun {
  id: string;
  kind: RunKind;
  jobId?: string | null;
  jobName?: string | null;
  serverName?: string | null;
  databaseName?: string | null;
  status: "success" | "failed" | "running";
  sizeBytes?: number | null;
  durationMs?: number | null;
  fileName?: string | null;
  log?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  // Shape thật của GET /backup-history/many (22/08/2026)
  filePath?: string | null;
  tool?: string | null;
  exitCode?: number | null;
  expiredAt?: string | null;
  // Chỉ có trên run sync: _id user tạo job
  triggeredBy?: string | null;
}

export interface DashboardOverview {
  backupJobCount: number;
  syncJobCount: number;
  runningCount: number;
  serverCount: number;
  successRate: number;
  recentRuns: BackupRun[];
}

// GET /storage/history: item { date, payloadSize, metadataSize, objectCount, uploadCount, source }
// GET /storage/current: object { payloadSize, ..., infrequentAccessPayloadSize, fetchedAt } (không có date/source)
export interface StorageSnapshot {
  date?: string | null;
  payloadSize?: number | null;
  metadataSize?: number | null;
  objectCount?: number | null;
  uploadCount?: number | null;
  source?: string | null;
  infrequentAccessPayloadSize?: number | null;
  infrequentAccessObjectSize?: number | null;
  fetchedAt?: string | null;
}

// DTO thật của POST /backup-job (22/08/2026): bắt buộc một trong hai
// cronExpressionPreset (key của enum CronExpression bên BE) hoặc cronExpressionCustom
export interface CreateBackupJobPayload {
  databaseConfigId: string;
  isActive: boolean;
  retentionDays: number;
  cronExpressionPreset?: string;
  cronExpressionCustom?: string;
}

// PUT /backup-job/:id dùng cùng DTO bắt buộc như create —
// chỉ gửi { isActive } sẽ bị class-validator từ chối
export type UpdateBackupJobPayload = CreateBackupJobPayload;

// DTO thật của POST /sync-job (22/08/2026): chỉ cần id config nguồn + đích.
// SyncStatus enum BE: PENDING | RUNNING | SUCCESS | FAILED
export interface CreateSyncJobPayload {
  sourceDatabaseConfigId: string;
  targetDatabaseConfigId: string;
}

export type JobKind = RunKind;

export interface HistoryFilter {
  kind?: "all" | RunKind;
  status?: "all" | "success" | "failed" | "running";
}

// ── User permission (22/08/2026) ─────────────────────────────────

// Giá trị thật của enum PermissionResourceType bên BE
export type PermissionResourceType =
  | "database-server"
  | "database-config"
  | "global";

// Item của GET /user-permission/many
export interface UserPermission {
  id: string;
  userId: string;
  resourceType: PermissionResourceType;
  resourceId?: string | null;
  permissions: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

// User từ GET /user/many (shape phòng thủ theo entity User bên BE).
// ssoId = định danh Keycloak (= sub trong token) — dùng để nhận diện
// user hiện tại phía FE; systemRole để biết user là admin hệ thống
export interface ManagedUser {
  id: string;
  ssoId?: string | null;
  username: string | null;
  fullname: string | null;
  email: string | null;
  systemRole?: string | null;
}

// DTO thật của POST /user-permission (22/08/2026)
export interface CreateUserPermissionPayload {
  userId: string;
  resourceType: PermissionResourceType;
  resourceId?: string;
  permissions: string[];
}

// PUT /user-permission/:id — PartialType(OmitType(...)) nên chỉ đổi được permissions
export interface UpdateUserPermissionPayload {
  permissions?: string[];
}

