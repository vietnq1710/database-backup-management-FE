# Backup Manager — Frontend

Frontend React SPA cho hệ thống quản lý backup database, kết nối tới backend NestJS qua REST API (JWT Bearer).

Giao diện tiếng Việt gồm: Dashboard tổng quan (thống kê, biểu đồ dung lượng R2, Database Inspector), trang Quản lý Job (backup/sync), Backup History (log + tải file), Projects, Permissions và trang Đăng nhập Keycloak SSO.

## Tech Stack

- React 19 + TypeScript + Vite 7
- Tailwind CSS v3 + shadcn/ui
- TanStack React Query 5
- React Router v7
- Recharts, Lucide Icons, Sonner

## Yêu cầu

- Node.js 20+
- Backend NestJS đang chạy
- Keycloak server

## Cài đặt & Chạy

```bash
npm install
```

Tạo file `.env` (xem `.env.example`):

```env
VITE_API_URL=https://backup-management.onrender.com          # URL backend NestJS
VITE_KEYCLOAK_URL=https://keycloak-setup.onrender.com     # Keycloak server
VITE_KEYCLOAK_REALM=backup-system           # realm
VITE_KEYCLOAK_CLIENT_ID=backup-client       # public client
```

Chạy dev server:

```bash
npm run dev   # http://localhost:5173
```

Build production:

```bash
npm run build     # output ở dist/
npm run preview   # xem thử bản build
```

## Kết nối Backend

### Proxy khi dev

Vite proxy mọi request `/api/*` → `VITE_API_URL` và **tự strip `/api`** khi forward:

```ts
// vite.config.ts
proxy: {
  "/api": { target: apiTarget, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") },
}
```

### Danh sách endpoint

Toàn bộ path nằm tập trung trong **`src/api/endpoints.ts`**, map theo controller của BE:

| Method       | Path BE                                              | Dùng ở             |
| ------------ | ---------------------------------------------------- | ------------------ |
| GET          | `/projects/many`                                     | Dashboard, Projects|
| POST         | `/projects`                                          | Projects           |
| PUT / DELETE | `/projects/:id`                                      | Projects           |
| GET          | `/database-config/many`                              | Projects           |
| POST         | `/database-config`                                   | Projects           |
| PUT          | `/database-config/:id`                               | Projects           |
| GET          | `/database-inspector/:databaseConfigId/tables`       | Dashboard          |
| POST         | `/database-inspector/:databaseConfigId/rescan`       | Dashboard          |
| GET / POST   | `/backup-job/many`, `/backup-job`                    | Jobs               |
| PUT / DELETE | `/backup-job/:id`                                    | Jobs               |
| GET / POST   | `/sync-job/many`, `/sync-job`                        | Jobs               |
| PUT / DELETE | `/sync-job/many/ids`                                 | Jobs               |
| GET          | `/backup-history/many`                               | History, Dashboard |
| GET          | `/backup-history/:id/download`                       | History            |
| GET          | `/storage/current`                                   | Dashboard          |
| GET          | `/storage/history`                                   | Dashboard          |
| GET          | `/user/many`                                         | Permissions        |
| GET / POST   | `/user-permission/many`, `/user-permission`          | Permissions        |
| PUT / DELETE | `/user-permission/:id`                               | Permissions        |

Lưu ý:

- Dashboard stats (số job, success rate...) được **tính phía client** từ các endpoint trên.
- Hook `unwrapMany` trong `src/api/hooks.ts` tự xử lý cả 2 dạng response: mảng trực tiếp hoặc bọc `{ items }` / `{ data }`.
- Shape dữ liệu chi tiết xem tại `src/types/api.ts`.

### Xác thực (Keycloak SSO)

Đăng nhập qua **Keycloak** theo chuẩn Authorization Code Flow + PKCE:

1. Bấm "Đăng nhập qua Keycloak" → redirect sang trang SSO
2. Keycloak trả về `/callback?code=...` → FE đổi code lấy token (access/refresh/id)
3. Thông tin user decode từ claims của access token (`sub`, `preferred_username`, `name`, `email`, `realm_access.roles`)
4. Mọi request API gắn header `Authorization: Bearer <token>`; gặp 401 → tự refresh rồi gọi lại

Trên Keycloak client cần:

- **Client authentication: OFF** (public client)
- **Standard flow: ON**
- **Valid Redirect URI**: `http://localhost:5173/callback` (dev) + `https://<your-vercel-app>.vercel.app/callback` (production)
- **Web Origin**: `http://localhost:5173` + `https://<your-vercel-app>.vercel.app`

Code liên quan: `src/lib/keycloak.ts`, `src/pages/AuthCallback.tsx`, `src/lib/api-client.ts`.

## Deploy lên Vercel

### Cấu hình

| Field            | Value           |
| ---------------- | --------------- |
| Framework        | Vite            |
| Build Command    | `npm run build` |
| Output Directory | `dist`          |

### Env Variables

| Variable                  | Value                                    | Ghi chú                    |
| ------------------------- | ---------------------------------------- | -------------------------- |
| `VITE_KEYCLOAK_URL`       | `https://<keycloak-domain>`              | URL Keycloak production    |
| `VITE_KEYCLOAK_REALM`     | `backup-system`                          | Realm name                 |
| `VITE_KEYCLOAK_CLIENT_ID` | `backup-client`                          | Public client ID           |
| `BACKEND_URL`             | `https://backup-management.onrender.com` | Backend NestJS trên Render |

Lưu ý: `VITE_*` env vars được bake vào build nên sau khi thay đổi phải **Redeploy**.

### Edge Middleware (Proxy)

Trong production, Vite proxy không hoạt động. FE dùng **Vercel Edge Middleware** (`middleware.ts`) để:

1. Nhận request `/api/*` từ browser
2. Forward tới backend Render (server-side)
3. **Strip header `WWW-Authenticate`** khỏi response (ngăn browser hiện HTTP Basic Auth dialog)
4. Trả response về browser

Flow:

```
Browser → /api/storage/history
       → Edge Middleware
       → fetch https://backup-management.onrender.com/storage/history
       → Strip www-authenticate header
       → Response về browser
```

## Scripts

| Lệnh              | Chức năng                    |
| ----------------- | ---------------------------- |
| `npm run dev`     | Dev server (port 5173)       |
| `npm run build`   | Build production vào `dist/` |
| `npm run preview` | Xem thử bản build            |
| `npm run check`   | Typecheck (`tsc -b`)         |
| `npm run lint`    | ESLint                       |
| `npm run format`  | Prettier                     |

## Cấu trúc thư mục

```
├── middleware.ts              # Vercel Edge Middleware — proxy /api/* tới backend
├── vercel.json                # SPA rewrite (loại trừ /api/)
├── api/                       # (đã xóa — dùng middleware thay thế)
├── src/
│   ├── api/
│   │   ├── endpoints.ts       # Toàn bộ path API
│   │   └── hooks.ts           # React Query hooks + response normalization
│   ├── components/
│   │   ├── ui/                # shadcn/ui components (53 files)
│   │   ├── AuthLayout.tsx     # Layout có sidebar + guard đăng nhập
│   │   └── common.tsx         # Panel, StatusBadge, PageHeader, EmptyState
│   ├── hooks/
│   │   ├── useAuth.ts         # Trạng thái đăng nhập từ JWT claims
│   │   └── use-mobile.ts      # Mobile breakpoint detection
│   ├── lib/
│   │   ├── api-client.ts      # Fetch wrapper + JWT Bearer + auto-refresh 401
│   │   ├── keycloak.ts        # Keycloak PKCE: login/callback/refresh/logout
│   │   ├── cron-presets.ts    # Cron expression presets cho UI
│   │   ├── format.ts          # formatBytes, formatDuration, formatDateTime
│   │   ├── permissions.ts     # Permission definitions
│   │   └── utils.ts           # cn()
│   ├── pages/
│   │   ├── Dashboard.tsx      # Thống kê, R2 chart, DB inspector
│   │   ├── Jobs.tsx           # Quản lý backup/sync job
│   │   ├── History.tsx        # Lịch sử chạy + log + tải file (tab trong Jobs)
│   │   ├── Projects.tsx       # Quản lý project & database config
│   │   ├── Permissions.tsx    # Quản lý quyền người dùng (admin)
│   │   ├── Login.tsx          # Đăng nhập Keycloak SSO
│   │   ├── AuthCallback.tsx   # Xử lý callback từ Keycloak
│   │   └── NotFound.tsx       # 404
│   ├── providers/
│   │   └── query-provider.tsx
│   ├── types/
│   │   ├── api.ts             # Types domain khớp response BE
│   │   └── theme.ts           # Theme definitions
│   ├── App.tsx                # Routes definition
│   └── main.tsx               # Entry point
```
