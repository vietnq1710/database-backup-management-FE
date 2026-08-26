# Backup Manager — Frontend

Frontend React SPA cho hệ thống quản lý backup database, kết nối tới backend NestJS qua REST API (JWT Bearer).

Giao diện tiếng Việt gồm: Dashboard tổng quan (thống kê, biểu đồ dung lượng R2, Database Inspector), trang Quản lý Job (backup/sync), Backup History (log + tải file) và trang Đăng nhập/Đăng ký.

## Tech Stack

- React 19 + TypeScript + Vite 7
- Tailwind CSS v3 + shadcn/ui
- TanStack React Query 5
- React Router v7
- Recharts, Lucide Icons, Sonner

## Yêu cầu

- Node.js 20+
- Backend NestJS đang chạy (mặc định trỏ tới `http://localhost:3000`)

## Cài đặt & Chạy

```bash
npm install
```

Tạo file `.env` (xem `.env.example`):

```bash
VITE_API_URL=http://localhost:3000   # URL backend NestJS của bạn
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

BE NestJS không có global prefix, nên Vite proxy mọi request `/api/*` → `VITE_API_URL` và **tự strip `/api`** khi forward:

```ts
// vite.config.ts
proxy: {
  "/api": { target: apiTarget, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") },
}
```

### Danh sách endpoint

Toàn bộ path nằm tập trung trong **`src/api/endpoints.ts`**, map theo controller của BE:

| Method      | Path BE                                          | Dùng ở                        |
| ----------- | ------------------------------------------------ | ----------------------------- |
| POST        | `/auth/login`                                    | Login                         |
| POST        | `/auth/logout`                                   | Sidebar                       |
| GET         | `/user/me`                                       | useAuth                       |
| GET         | `/database-server/many`                          | Dashboard, Jobs               |
| GET         | `/database-inspector/:serverId/databases`        | Dashboard                     |
| GET         | `/database-inspector/:serverId/databases/:db/tables` | Dashboard                 |
| GET / POST  | `/backup-job/many`, `/backup-job`                | Jobs                          |
| PUT / DELETE| `/backup-job/:id`                                | Jobs (toggle, xóa)            |
| GET / POST  | `/sync-job/many`, `/sync-job`                    | Jobs                          |
| PUT / DELETE| `/sync-job/many/ids`                             | Jobs (toggle, xóa — BE không có route `:id`) |
| GET         | `/backup-history/many?kind=&status=`             | History, Dashboard            |
| GET         | `/backup-history/:id/download`                   | History                       |
| GET         | `/storage/history`                               | Dashboard                     |

Lưu ý:

- **Chưa có nút "Chạy ngay"** vì BE chưa có endpoint run-now — thêm lại khi BE hỗ trợ.
- **Không có trang Đăng ký** vì BE không có route register công khai (tạo user qua `/user/upsert` phía admin).
- Dashboard stats (số job, success rate...) được **tính phía client** từ các endpoint trên.
- Hook `unwrapMany` trong `src/api/hooks.ts` tự xử lý cả 2 dạng response: mảng trực tiếp hoặc bọc `{ items }` / `{ data }`.

Shape dữ liệu chi tiết xem tại `src/types/api.ts`. Nếu field của BE khác tên, chỉ cần sửa types và mapping trong `src/api/hooks.ts`.

### Xác thực (Keycloak SSO)

Đăng nhập qua **Keycloak** theo chuẩn Authorization Code Flow + PKCE — không dùng form username/password của BE:

1. Bấm "Đăng nhập qua Keycloak" → redirect sang trang SSO
2. Keycloak trả về `/callback?code=...` → FE đổi code lấy token (access/refresh/id)
3. Thông tin user decode trực tiếp từ claims của access token (`sub`, `preferred_username`, `name`, `email`, `realm_access.roles`)
4. Mọi request API gắn header `Authorization: Bearer <token>`; gặp 401 → tự refresh rồi gọi lại

Cấu hình trong `.env`:

```env
VITE_KEYCLOAK_URL=http://localhost:8080   # địa chỉ Keycloak server
VITE_KEYCLOAK_REALM=backup-system         # realm (khớp SSO_JWKS_URI của BE)
VITE_KEYCLOAK_CLIENT_ID=backup-service    # client dạng public, bật Standard Flow + PKCE
```

Trên Keycloak client `backup-service` cần:
- **Client authentication: OFF** (public client) — nếu bật secret thì FE không đổi được code lấy token
- **Standard flow: ON**
- Valid Redirect URI: `http://localhost:5173/callback`
- Web Origin: `http://localhost:5173`

Code liên quan: `src/lib/keycloak.ts` (login/callback/refresh/logout), `src/pages/AuthCallback.tsx`, `src/lib/api-client.ts` (tự refresh khi 401).

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
src/
├── api/
│   ├── endpoints.ts      # Toàn bộ path API (điểm cần map với BE)
│   └── hooks.ts          # React Query hooks cho từng resource
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── AuthLayout.tsx    # Layout có sidebar + guard đăng nhập
│   └── common.tsx        # Panel, StatusBadge, PageHeader
├── hooks/
│   └── useAuth.ts        # Trạng thái đăng nhập + logout
├── lib/
│   ├── api-client.ts     # Fetch wrapper + JWT Bearer + xử lý 401
│   ├── format.ts         # formatBytes, formatDateTime, cronLabel...
│   └── utils.ts          # cn()
├── pages/
│   ├── Dashboard.tsx     # Thống kê, R2 storage chart, DB inspector
│   ├── Jobs.tsx          # Quản lý backup/sync job
│   ├── History.tsx       # Lịch sử chạy + log + tải file
│   ├── Login.tsx         # Đăng nhập / Đăng ký
│   └── NotFound.tsx
├── providers/
│   └── query-provider.tsx
├── types/
│   └── api.ts            # Types domain khớp response BE
├── App.tsx               # Routes: / /login /jobs /history
└── main.tsx
```
