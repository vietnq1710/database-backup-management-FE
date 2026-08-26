import {
  clearSessionAndGoLogin,
  getAccessToken,
  tryRefreshToken,
} from "@/lib/keycloak";

// BE NestJS không có global prefix — Vite proxy tự strip "/api" khi forward
const API_BASE = "/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | undefined>;
};

function extractErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const msg = (data as Record<string, unknown>).message;
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg)) return msg.join(", ");
    const err = (data as Record<string, unknown>).error;
    if (typeof err === "string") return err;
  }
  return `HTTP ${status}`;
}

async function execute(path: string, opts: RequestOptions): Promise<Response> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (opts.params) {
    for (const [key, value] of Object.entries(opts.params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

export async function request<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  let res = await execute(path, opts);

  // Access token hết hạn → thử refresh rồi gọi lại đúng 1 lần
  if (res.status === 401 && (await tryRefreshToken())) {
    res = await execute(path, opts);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    if (res.status === 401) clearSessionAndGoLogin();
    // 403 = hết quyền (không phải lỗi hệ thống) → thông điệp thân thiện theo spec phân quyền
    throw new ApiError(
      res.status,
      res.status === 403
        ? "Bạn không có quyền thực hiện thao tác này"
        : extractErrorMessage(data, res.status),
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Tải file nhị phân (backup .sql...) — KHÔNG parse JSON.
// Tên file ưu tiên lấy từ header Content-Disposition của BE.
export async function requestFile(
  path: string,
  fallbackName = "download",
): Promise<{ blob: Blob; fileName: string }> {
  const doFetch = (): Promise<Response> => {
    const url = new URL(`${API_BASE}${path}`, window.location.origin);
    const headers: Record<string, string> = {};
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url.toString(), { headers });
  };

  let res = await doFetch();
  if (res.status === 401 && (await tryRefreshToken())) {
    res = await doFetch();
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    if (res.status === 401) clearSessionAndGoLogin();
    // 403 = hết quyền (vd thiếu BACKUP_HISTORY_DOWNLOAD khi tải file backup)
    throw new ApiError(
      res.status,
      res.status === 403
        ? "Bạn không có quyền thực hiện thao tác này"
        : extractErrorMessage(data, res.status),
    );
  }

  const blob = await res.blob();
  const dispo = res.headers.get("Content-Disposition") ?? "";
  const m =
    /filename\*=(?:UTF-8'')?([^;]+)/i.exec(dispo) ??
    /filename="?([^";]+)"?/i.exec(dispo);
  const fileName = m ? decodeURIComponent(m[1].replace(/["']/g, "")) : fallbackName;
  return { blob, fileName };
}
