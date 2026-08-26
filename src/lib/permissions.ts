// Khớp mô hình phân quyền thật của BE:
// - Entry = { userId, resourceType, resourceId, permissions[] }
// - resourceType chỉ quyết định phạm vi áp dụng (global / theo server / theo database)
//   còn permissions có thể là BẤT KỲ action nào — vd entry global chứa
//   database-server:manage + permission:manage là hợp lệ.
// - "Tạo server" (database-server:create) được cấp kiểu global, không cần chọn server.
// FE chỉ gán permission có sẵn trong danh sách này — không cho nhập tự do.
import type { PermissionResourceType } from "@/types/api";

export const RESOURCE_TYPES: ReadonlyArray<{
  value: PermissionResourceType;
  label: string;
}> = [
  { value: "global", label: "Toàn cục (global)" },
  { value: "database-server", label: "Database Server" },
  { value: "database-config", label: "Database Config" },
];

export const ALL_PERMISSIONS: ReadonlyArray<{
  action: string;
  label: string;
  group: string;
}> = [
  // Database Server
  { action: "database-server:create", label: "Tạo server", group: "Database Server" },
  { action: "database-server:manage", label: "Quản lý server", group: "Database Server" },
  { action: "database-server:view", label: "Xem server", group: "Database Server" },
  // Database Config
  { action: "database-config:manage", label: "Quản lý config", group: "Database Config" },
  { action: "database-config:view", label: "Xem config", group: "Database Config" },
  // Backup Job
  { action: "backup-job:manage", label: "Quản lý backup job", group: "Backup Job" },
  { action: "backup-job:view", label: "Xem backup job", group: "Backup Job" },
  // Lịch sử backup
  { action: "backup-history:view", label: "Xem lịch sử backup", group: "Lịch sử backup" },
  { action: "backup-history:download", label: "Tải file backup", group: "Lịch sử backup" },
  // Sync Job
  { action: "sync-job:create", label: "Tạo sync job", group: "Sync Job" },
  { action: "sync-job:view", label: "Xem sync job", group: "Sync Job" },
  // Phân quyền
  { action: "permission:manage", label: "Quản lý phân quyền", group: "Phân quyền" },
];

// Các quyền dành cho tài nguyên database-config (dùng ở phần "quyền liên quan")
export const DATABASE_CONFIG_ACTIONS = ALL_PERMISSIONS.filter((o) =>
  o.action.startsWith("database-config:"),
).map((o) => o.action);

// Các quyền phía database-server — bị ẩn khi gán quyền cho entry database-config
export const DATABASE_SERVER_ACTIONS = ALL_PERMISSIONS.filter((o) =>
  o.action.startsWith("database-server:"),
).map((o) => o.action);

export const PERMISSION_MANAGE_ACTION = "permission:manage";
export const SERVER_CREATE_ACTION = "database-server:create";

// Quyền chỉ có ý nghĩa ở phạm vi toàn cục — chỉ cấp qua entry global
const GLOBAL_ONLY_ACTIONS = [SERVER_CREATE_ACTION, PERMISSION_MANAGE_ACTION];

// Quyền bị ẩn khi gán cho entry KHÔNG phải global
export function hiddenActionsForResource(
  resourceType: PermissionResourceType,
): string[] {
  if (resourceType === "global") return [];
  if (resourceType === "database-config")
    return [
      ...DATABASE_SERVER_ACTIONS.filter((a) => a !== SERVER_CREATE_ACTION),
      ...GLOBAL_ONLY_ACTIONS,
    ];
  return [...GLOBAL_ONLY_ACTIONS];
}

export function permissionLabel(action: string): string {
  return ALL_PERMISSIONS.find((o) => o.action === action)?.label ?? action;
}
