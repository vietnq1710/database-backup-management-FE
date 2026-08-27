// Toàn bộ đường dẫn API tới BE NestJS nằm ở đây.
// Đăng nhập qua Keycloak (src/lib/keycloak.ts) — không gọi /auth/* của BE.
// BE không có global prefix — proxy Vite tự strip "/api" khi forward request.
export const endpoints = {
  servers: {
    list: "/database-server/many",
    create: "/database-server",
    update: (id: string) => `/database-server/${id}`,
    remove: (id: string) => `/database-server/${id}`,
  },
  databaseConfigs: {
    list: "/database-config/many",
    create: "/database-config",
    update: (id: string) => `/database-config/${id}`,
    remove: (id: string) => `/database-config/${id}`,
  },
  inspector: {
    databases: (serverId: string) =>
      `/database-inspector/${serverId}/databases`,
    tables: (serverId: string, databaseName: string) =>
      `/database-inspector/${serverId}/databases/${encodeURIComponent(databaseName)}/tables`,
    rescanServer: (serverId: string) =>
      `/database-inspector/${serverId}/rescan`,
    rescanTables: (serverId: string, databaseName: string) =>
      `/database-inspector/${serverId}/databases/${encodeURIComponent(databaseName)}/rescan`,
  },
  backupJobs: {
    list: "/backup-job/many",
    create: "/backup-job",
    update: (id: string) => `/backup-job/${id}`,
    remove: (id: string) => `/backup-job/${id}`,
  },
  syncJobs: {
    list: "/sync-job/many",
    create: "/sync-job",
    updateMany: "/sync-job/many/ids",
    removeMany: "/sync-job/many/ids",
  },
  userPermissions: {
    list: "/user-permission/many",
    create: "/user-permission",
    update: (id: string) => `/user-permission/${id}`,
    remove: (id: string) => `/user-permission/${id}`,
  },
  users: {
    list: "/user/many",
  },
  history: {
    list: "/backup-history/many",
    download: (id: string) => `/backup-history/${id}/download`,
  },
  storage: {
    current: "/storage/current",
    series: "/storage/history",
  },
} as const;
