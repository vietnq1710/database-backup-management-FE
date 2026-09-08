# Ghi chú tiến độ dự án — Backup Manager FE

> File này lưu tóm tắt trạng thái làm việc. Cập nhật lần cuối: 06/09/2026.

## Bối cảnh

- Dự án `G:\PROJECTS\app` ban đầu là fullstack tRPC/Hono/Drizzle → đã chuyển thành **FE thuần React 19 + Vite + TS + Tailwind v3 + react-router v7 + TanStack Query**, gọi REST tới **BE NestJS có sẵn** tại `G:\BACKEND\BACKUP\aisoft-backend`.
- BE chạy port 3000, KHÔNG có global prefix `/api` → Vite dev proxy strip `/api`.
- Đăng nhập qua **Keycloak SSO** (Docker trên chính máy, port 8080), realm `backup-system`, client `backup-service` (public + Standard flow + PKCE). Không dùng `/auth/login` của BE.
- Thông tin user decode trực tiếp từ access token claims (`sub`, `preferred_username`, `realm_access.roles`).
- BE trả response bọc `{ success, data }`; id là **Mongo ObjectId string** (`_id`) → hooks chuẩn hóa `_id`→`id`, bọc `job = item` nếu BE trả phẳng.
- Người dùng **không cho phép sửa code backend** — bug BE chỉ chỉ ra chỗ để họ tự sửa.

## Cấu hình quan trọng

- `.env`: `VITE_API_URL=http://localhost:3000`, `VITE_KEYCLOAK_URL=http://localhost:8080`, `VITE_KEYCLOAK_REALM=backup-system`, `VITE_KEYCLOAK_CLIENT_ID=backup-service`
- Keycloak client: Valid Redirect URI `http://localhost:5173/callback`; Web Origins `http://localhost:5173`
- Đã từng dính lỗi hostname do **Realm frontendUrl** bị đặt `http://172.16.11.78:5173/` → sửa thành `http://localhost:8080` qua kcadm:
  `docker exec keycloak /opt/keycloak/bin/kcadm.sh update realms/backup-system -s "attributes.frontendUrl=http://localhost:8080"`
- Lưu ý: đăng nhập app bằng user tạo trong realm `backup-system` (không phải admin của master).
- `src/components/ui/sidebar.tsx` là bản shadcn/ui cho **Tailwind v4** trong khi project dùng Tailwind v3.4 → cú pháp `w-(--sidebar-width)`, `has-data-[...]`, `outline-hidden`, `p-0!`... không compile nên div gap của sidebar có width=0, sidebar đè lên nội dung (22/08/2026). Đã convert toàn bộ sang cú pháp v3 (`w-[var(--sidebar-width)]`, `has-[[data-variant=inset]]`, `outline-none`, `!group-data-...`). Nếu thay file này bằng bản mới của shadcn phải convert lại.

## File chính của FE

| File | Vai trò |
|---|---|
| `src/lib/keycloak.ts` | PKCE login/callback/refresh/logout, decode user từ token |
| `src/lib/api-client.ts` | fetch wrapper, Bearer header, tự refresh khi 401 |
| `src/api/endpoints.ts` | map path BE (auth đã bỏ, dùng Keycloak) |
| `src/api/hooks.ts` | query/mutation; `unwrapMany`, `withIds`, `withNestedJob`, `mapProject`; dashboard tổng hợp phía client |
| `src/types/api.ts` | types theo shape thật của BE |
| `src/pages/AuthCallback.tsx` | trang `/callback` đổi code lấy token |
| `src/components/common.tsx` | Panel, StatusBadge, EmptyState, TableStateRow |

## Mapping endpoint hiện tại

- `POST /auth/login` — KHÔNG dùng nữa (Keycloak thay thế)
- `GET /projects/many`, `POST /projects`, `PUT/DELETE /projects/:id` — **database-server đã thay bằng projects (06/09/2026)**: entity project chỉ có `_id` + `name` (unique). Trang `/servers` → `/projects`, label sidebar "Project & Configs".
- `GET/POST /database-config`, `PUT/DELETE /database-config/:id` — **06/09/2026**: config mang đủ field kết nối thay vì tham chiếu server: `{ configCode, projectId (FK → projects), databaseType (postgres|mongo), host, port, username, password, databaseName, environment (DEVELOPMENT|UAT|STAGING|PRODUCTION) }`. DTO create đầy đủ; update = PartialType (mọi trường optional). FE dialog create/edit viết theo DTO này.
- `GET /database-inspector/:databaseConfigId/tables` — **06/09/2026**: inspector chuyển sang theo **database-config** (không còn theo server). Endpoint nhận `databaseConfigId`, trả MỘT snapshot của config `{ success, data: { scope, status, databaseName, errorMessage, scannedAt, data: [tables] } }`; `data = null` khi chưa quét. Trang Dashboard nhóm theo **project → config → tables(snapshot)**, bỏ bước liệt kê databases (vì mỗi config = 1 database cố định qua `databaseName`).
- `POST /database-inspector/:databaseConfigId/rescan` — quét lại snapshot của config. **BẤT ĐỒNG BỘ** (BullMQ, jobId `rescan config <id>`) — POST trả ngay, worker quét xong upsert snapshot kèm `scannedAt` mới. FE poll GET snapshot mỗi 2.5s tối đa 12 lần chờ `scannedAt` đổi, hiện toast kết quả.
- `GET/POST /backup-job/many`, `PUT/DELETE /backup-job/:id` — **shape thật đã confirm (22/08/2026)**: item `{ _id, databaseConfigId, cronExpression, retentionDays, isActive, createdAt, updatedAt }` — KHÔNG có name/serverId/databaseName/destination/status/lastRunAt. **POST /backup-job DTO thật**: `{ databaseConfigId, isActive, retentionDays, cronExpressionPreset? | cronExpressionCustom? }` (RequireOneOf 2 trường cron; preset = key enum CronExpression của @nestjs/schedule). Dialog BackupJobDialog đã viết theo DTO này (CRON_PRESETS ở src/lib/cron-presets.ts); dropdown chọn config dùng dữ liệu từ `/database-config/many`. Status enum BE = SUCCESS/FAILED.
- `GET/POST /sync-job/many`, `PUT/DELETE /sync-job/many/ids` — **shape thật đã confirm (22/08/2026)**: `{ _id, sourceDatabaseConfigId, targetDatabaseConfigId, triggeredBy, status, dumpFilePath, errorMessage, createdAt, updatedAt, sourceDatabaseConfig: {...}, targetDatabaseConfig: {...} }` — KHÔNG có cronExpression/isActive (sync job = bản ghi đồng bộ, chạy ngay khi tạo). **SyncStatus enum BE**: PENDING | RUNNING | SUCCESS | FAILED (StatusBadge đã có đủ 4 màu). **POST /sync-job DTO thật**: chỉ `{ sourceDatabaseConfigId, targetDatabaseConfigId }`. UI sync tab: chỉ còn nút Xóa; PUT `/sync-job/many/ids` chưa rõ mục đích/body — cần DTO.
- `GET /backup-history/many`, `GET /backup-history/:id/download`
- `GET /storage/history` — trả `{date, payloadSize, metadataSize, objectCount, uploadCount, source}` (KHÔNG có quota)

## Bug BE đã phát hiện (người dùng tự sửa)

1. `backup-history.service.ts` ~dòng 213 (`getCumulativeSizeByDay`): raw SQL dùng `"created_at"` → phải là `"createdAt"` (đã từng sửa sai thành `"createdAT"`).

## Việc còn treo / cần verify

- [ ] Chưa thấy response thật của `GET /backup-job/many` và `GET /backup-history/many` → tên field (schedule, retentionDays, lastRunAt, jobName, startedAt, sizeBytes...) có thể lệch, cột sẽ hiện "—". Cần đối chiếu rồi chỉnh types/hooks nếu khác.
- [ ] Body của `PUT /sync-job/many/ids` và `DELETE .../many/ids` đang đoán — cần verify với DTO của BE.
- [ ] Snapshot inspector (`GET /database-inspector/:configId/tables`) — cần đối chiếu shape `data` thật của BE (mảng tables hay rows) trước khi chốt `mapDbObject`.
- [ ] AdminPermissions dùng `configById` để hiện tên — cần xác nhận config legacy còn `databaseServerId` không (hook map có fallback).
- [x] ~~Giá trị status job~~ — ĐÃ RÕ (22/08/2026): job không có field status, chỉ có boolean `isActive` → badge active/paused.
- [ ] `info.md` trong repo vẫn mô tả template cũ (CHRONOS) — chưa xóa/sửa.
- [ ] Lỗi lint còn lại là lỗi có sẵn của shadcn/ui + `Date.now` trong RecentRuns Dashboard (không do refactor này).
- [ ] Module "user upsert" của BE chưa có màn hình FE tương ứng.

## Phân trang server (08/09/2026)

- Đã thêm phân trang server cho 4 danh sách: **Projects, Database Configs, Backup Jobs, Sync Jobs**.
- Endpoint mới: `GET /<resource>/page?page=&limit=&skip=&sort={json}` (route `page` trong BaseControllerFactory) — response bọc `{ success, data: { total, skip, limit, page, result: [...] } }`; `limit` max 200, `page` bắt đầu từ 1. Không đổi `/many` (vẫn dùng cho cross-reference).
- Hook mới trong `src/api/hooks.ts`: `useProjectsPage`, `useDatabaseConfigsPage`, `useBackupJobsPage`, `useSyncJobsPage` (queryKey chứa page+limit, `keepPreviousData`, parse `result`). `PageResult<T>` trong `src/types/api.ts`; endpoint branch `page` trong `src/api/endpoints.ts`.
- UI điều hướng dùng chung: `src/components/Pagination.tsx` (Trước/Sau, số trang, tổng bản ghi, chọn 10/20/50/100); `totalPagesOf()` đặt trong `src/lib/format.ts` (tránh react-refresh/only-export-components).
- **Việc còn treo / tối ưu sau**:
  - [ ] Cột "Số config" ở bảng Projects đã tạm ẩn theo yêu cầu — cần 1 endpoint count/config theo project (BE chưa có) để hiện lại.
  - [ ] Group header Database Configs lấy tên project từ `useProjects()` full-list; nếu project không có trong full-list sẽ hiện "Khác" — tối ưu sau bằng cách map qua page hiện tại + fallback shortId.
  - [ ] `sort` để BE tự mặc định (`_id` desc) — có thể truyền `sort` JSON sau.
  - [ ] `useSyncJobsPage` chưa có poll như bản full-list (status auto-update khi chạy sync) — cân nhắc thêm refetchInterval tương tự sau.
  - [ ] Dashboard/Permissions/JobHistoryDialog vẫn dùng hook full-list (chấp nhận được vì dữ liệu ít) — tối ưu sau.

## Lệnh hay dùng

```powershell
npm run dev      # FE tại http://localhost:5173
npm run check    # tsc -b
npm run lint
npm run build
```
