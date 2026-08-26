# Ghi chú tiến độ dự án — Backup Manager FE

> File này lưu tóm tắt trạng thái làm việc. Cập nhật lần cuối: 21/08/2026.

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
| `src/api/hooks.ts` | query/mutation; `unwrapMany`, `withIds`, `withNestedJob`, `mapServer`; dashboard tổng hợp phía client |
| `src/types/api.ts` | types theo shape thật của BE |
| `src/pages/AuthCallback.tsx` | trang `/callback` đổi code lấy token |
| `src/components/common.tsx` | Panel, StatusBadge, EmptyState, TableStateRow |

## Mapping endpoint hiện tại

- `POST /auth/login` — KHÔNG dùng nữa (Keycloak thay thế)
- `GET /database-server/many` — servers (`serverName`, `type: postgres|mongo`, `environment`)
- `GET /database-inspector/:id/databases`, `.../:db/tables` — trả MỘT object kết quả quét `{ success, data: { scope, status, scannedAt, data: [items] } }` → hooks dùng `unwrapInspection`. Item DB thật: `{ name, sizeBytes }` (không phải databaseName/totalBytes) → `mapDatabase`/`mapDbObject` đã chuẩn hóa (22/08/2026).
- `POST /database-inspector/:id/rescan` (quét lại databases) và `POST /database-inspector/:id/databases/:db/rescan` (quét lại tables) — nút refresh trên Dashboard (22/08/2026). **LƯU Ý: rescan là BẤT ĐỒNG BỘ** — POST chỉ đẩy job BullMQ (`jobId: rescan-server-...` / `rescan-database-...`, dedup theo jobId) và trả ngay; worker quét xong mới upsert snapshot (kèm `scannedAt` mới, `status` SUCCESS/FAILED + `errorMessage`). FE poll GET mỗi 2.5s tối đa 12 lần chờ `scannedAt` đổi, hiện toast kết quả; snapshot chưa tồn tại thì BE trả `data: null` → FE hiện "chưa có bản quét".
- `GET/POST /backup-job/many`, `PUT/DELETE /backup-job/:id` — **shape thật đã confirm (22/08/2026)**: item `{ _id, databaseConfigId, cronExpression, retentionDays, isActive, createdAt, updatedAt }` — KHÔNG có name/serverId/databaseName/destination/status/lastRunAt. **POST /backup-job DTO thật**: `{ databaseConfigId, isActive, retentionDays, cronExpressionPreset? | cronExpressionCustom? }` (RequireOneOf 2 trường cron; preset = key enum CronExpression của @nestjs/schedule). Dialog BackupJobDialog đã viết theo DTO này (CRON_PRESETS ở src/lib/cron-presets.ts); chưa có dropdown chọn config vì BE chưa có endpoint list database-config. Status enum BE = SUCCESS/FAILED.
- `GET/POST /database-server`, `PUT/DELETE /database-server/:id` — **confirm (22/08/2026)**: create DTO `{ serverName, environment (DEVELOPMENT|UAT|STAGING|PRODUCTION), type (postgres|mongo), host, port, username, password, connectionOptions? }`; update = PartialType(entity) từ base controller (mọi trường optional); delete DELETE /:id. DatabaseType enum BE chỉ có postgres/mongo. Đã làm: types + hooks useCreateDatabaseServer/useUpdateDatabaseServer/useDeleteDatabaseServer, trang mới **/servers** (bảng + badge môi trường + dialog tạo đầy đủ 8 trường + dialog sửa chỉ gửi trường đổi + xóa có confirm).
- `GET/POST /database-config`, `PUT /database-config/:id` — **DTO thật đã confirm (22/08/2026)**: create `{ configCode, databaseServerId, databaseName }`; update (tất cả optional) `{ configCode?, username?, password? }`. Route list ĐOÁN là `GET /database-config/many` theo convention của BE — nếu 404 thì cần controller database-config để đối chiếu. Đã làm: type DatabaseConfig, hooks useDatabaseConfigs/useCreateDatabaseConfig/useUpdateDatabaseConfig, trang mới **/configs** (bảng + dialog tạo + dialog sửa configCode/username/password), dropdown chọn config đã thay ô paste ID tay ở cả 2 dialog tạo Backup/Sync Job.
- `GET/POST /sync-job/many`, `PUT/DELETE /sync-job/many/ids` — **shape thật đã confirm (22/08/2026)**: `{ _id, sourceDatabaseConfigId, targetDatabaseConfigId, triggeredBy, status, dumpFilePath, errorMessage, createdAt, updatedAt, sourceDatabaseConfig: {...}, targetDatabaseConfig: {...} }` — KHÔNG có cronExpression/isActive (sync job = bản ghi đồng bộ, chạy ngay khi tạo). **SyncStatus enum BE**: PENDING | RUNNING | SUCCESS | FAILED (StatusBadge đã có đủ 4 màu). **POST /sync-job DTO thật**: chỉ `{ sourceDatabaseConfigId, targetDatabaseConfigId }` — dialog SyncJobDialog đã viết theo DTO này (2 ô nhập ID, chưa có dropdown vì BE chưa có endpoint list database-config). UI sync tab: chỉ còn nút Xóa; PUT `/sync-job/many/ids` chưa rõ mục đích/body — cần DTO.
- `GET /backup-history/many`, `GET /backup-history/:id/download`
- `GET /storage/history` — trả `{date, payloadSize, metadataSize, objectCount, uploadCount, source}` (KHÔNG có quota)

## Bug BE đã phát hiện (người dùng tự sửa)

1. `backup-history.service.ts` ~dòng 213 (`getCumulativeSizeByDay`): raw SQL dùng `"created_at"` → phải là `"createdAt"` (đã từng sửa sai thành `"createdAT"`).

## Việc còn treo / cần verify

- [ ] Chưa thấy response thật của `GET /backup-job/many` và `GET /backup-history/many` → tên field (schedule, retentionDays, lastRunAt, jobName, startedAt, sizeBytes...) có thể lệch, cột sẽ hiện "—". Cần đối chiếu rồi chỉnh types/hooks nếu khác.
- [ ] Body của `PUT /sync-job/many/ids` và `DELETE .../many/ids` đang đoán — cần verify với DTO của BE.
- [x] ~~Giá trị status job~~ — ĐÃ RÕ (22/08/2026): job không có field status, chỉ có boolean `isActive` → badge active/paused.
- [ ] `info.md` trong repo vẫn mô tả template cũ (CHRONOS) — chưa xóa/sửa.
- [ ] 9 lỗi lint còn lại là lỗi có sẵn của shadcn/ui + AuthLayout (không do refactor này).
- [ ] Module "database config", "user permission", "user upsert" của BE chưa có màn hình FE tương ứng.

## Lệnh hay dùng

```powershell
npm run dev      # FE tại http://localhost:5173
npm run check    # tsc -b
npm run lint
npm run build
```
