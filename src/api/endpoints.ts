// Toàn bộ đường dẫn API tới BE NestJS nằm ở đây.
// Đăng nhập qua Keycloak (src/lib/keycloak.ts) — không gọi /auth/* của BE.
// BE không có global prefix — proxy Vite tự strip "/api" khi forward request.

// Query phân trang của GET /<resource>/page (route "page" trong BaseControllerFactory):
// page (bắt đầu từ 1), limit (tối đa 200), skip, sort (JSON string, vd {"createdAt":-1})
export type PageQueryParams = {
  page?: number;
  limit?: number;
  skip?: number;
  sort?: string;
};

function toPageQuery(params?: PageQueryParams): string {
  if (!params) return "";
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.skip != null) q.set("skip", String(params.skip));
  if (params.sort) q.set("sort", params.sort);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const endpoints = {
  projects: {
    list: "/projects/many",
    page: (params?: PageQueryParams) => `/projects/page${toPageQuery(params)}`,
    create: "/projects",
    update: (id: string) => `/projects/${id}`,
    remove: (id: string) => `/projects/${id}`,
  },
  databaseConfigs: {
    list: "/database-config/many",
    page: (params?: PageQueryParams) =>
      `/database-config/page${toPageQuery(params)}`,
    create: "/database-config",
    update: (id: string) => `/database-config/${id}`,
    remove: (id: string) => `/database-config/${id}`,
  },
  inspector: {
    tables: (databaseConfigId: string) =>
      `/database-inspector/${databaseConfigId}/tables`,
    rescan: (databaseConfigId: string) =>
      `/database-inspector/${databaseConfigId}/rescan`,
  },
  backupJobs: {
    list: "/backup-job/many",
    page: (params?: PageQueryParams) => `/backup-job/page${toPageQuery(params)}`,
    count: "/backup-job/count",
    create: "/backup-job",
    update: (id: string) => `/backup-job/${id}`,
    remove: (id: string) => `/backup-job/${id}`,
  },
  syncJobs: {
    list: "/sync-job/many",
    page: (params?: PageQueryParams) => `/sync-job/page${toPageQuery(params)}`,
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
