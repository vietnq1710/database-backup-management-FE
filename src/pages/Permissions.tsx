import { useState, type FormEvent } from "react";
import AuthLayout from "@/components/AuthLayout";
import { PageHeader, Panel, TableStateRow } from "@/components/common";
import {
  useCreateUserPermission,
  useDatabaseConfigs,
  useDeleteUserPermission,
  useEnsureUserPermission,
  useMyPermissionsView,
  useServers,
  useUpdateUserPermission,
  useUserPermissions,
  useUsers,
} from "@/api/hooks";
import { formatDateTime, shortId } from "@/lib/format";
import {
  ALL_PERMISSIONS,
  DATABASE_CONFIG_ACTIONS,
  RESOURCE_TYPES,
  hiddenActionsForResource,
  permissionLabel,
} from "@/lib/permissions";
import type {
  ManagedUser,
  PermissionResourceType,
  UserPermission,
} from "@/types/api";
import { Loader2, Pencil, Plus, ShieldOff, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "@/components/NotificationProvider";

const inputCls =
  "w-full border border-[var(--panel-mid)] bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-blue)] placeholder:text-[var(--text-muted)]";
const selectCls = inputCls + " appearance-none";
const submitBtnCls =
  "flex w-full items-center justify-center gap-2 border border-white bg-white py-2.5 text-[11px] font-black uppercase tracking-[0.25em] text-[var(--panel-dark)] transition-all hover:bg-transparent hover:text-white disabled:opacity-50";
const thCls =
  "panel-label px-5 py-3 text-left font-extrabold whitespace-nowrap";
const tdCls = "px-5 py-3 align-middle";

function DialogHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h2 className="text-sm font-black uppercase tracking-[0.2em]">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        className="text-[var(--text-muted)] hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mb-4 border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
      {message}
    </p>
  );
}

function userLabel(u?: ManagedUser): string {
  if (!u) return "";
  return u.fullname ?? u.username ?? u.email ?? shortId(u.id);
}

// Lưới checkbox chọn permission — hiện TOÀN BỘ quyền nhóm theo nhóm,
// vì BE cho phép gắn bất kỳ action nào lên entry bất kỳ resourceType
// (vd entry global chứa database-server:manage + permission:manage).
function PermissionChecks({
  selected,
  onToggle,
  onlyActions,
  hideActions,
}: {
  selected: string[];
  onToggle: (action: string) => void;
  onlyActions?: string[];
  hideActions?: string[];
}) {
  const options = onlyActions
    ? ALL_PERMISSIONS.filter((o) => onlyActions.includes(o.action))
    : hideActions
      ? ALL_PERMISSIONS.filter((o) => !hideActions.includes(o.action))
      : ALL_PERMISSIONS;
  const groups = Array.from(new Set(options.map((o) => o.group)));
  return (
    <div className="mb-4 space-y-3">
      {groups.map((group) => (
        <div key={group}>
          {!onlyActions && (
            <p className="panel-label mb-1 text-[9px] text-[var(--text-muted)]">
              {group}
            </p>
          )}
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {options
              .filter((o) => o.group === group)
              .map((o) => (
                <label
                  key={o.action}
                  title={o.action}
                  className="flex cursor-pointer items-center gap-2 border border-[var(--panel-mid)] px-3 py-2 text-xs transition-colors hover:border-[var(--accent-blue)]/60"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(o.action)}
                    onChange={() => onToggle(o.action)}
                    className="accent-[var(--accent-green)]"
                  />
                  <span>{o.label}</span>
                </label>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// POST /user-permission: userId + resourceType + resourceId? + permissions[]
function CreatePermissionDialog({ onClose }: { onClose: () => void }) {
  const users = useUsers();
  const servers = useServers();
  const configs = useDatabaseConfigs();
  const [userId, setUserId] = useState("");
  const [resourceType, setResourceType] =
    useState<PermissionResourceType>("global");
  const [resourceId, setResourceId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateUserPermission();
  const { addNotification } = useNotifications();

  const toggle = (action: string) =>
    setSelected((prev) =>
      prev.includes(action)
        ? prev.filter((a) => a !== action)
        : [...prev, action],
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!userId) return setError("Chọn user");
    if (selected.length === 0)
      return setError("Chọn ít nhất một permission");
    create.mutate(
      {
        userId,
        resourceType,
        ...(resourceType !== "global" && resourceId
          ? { resourceId }
          : {}),
        permissions: selected,
      },
      {
        onSuccess: () => {
          toast.success("Đã gán quyền cho user");
          addNotification("Đã gán quyền mới cho user");
          onClose();
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="panel w-full max-w-md p-6">
        <DialogHeader title="Gán quyền cho User" onClose={onClose} />

        <label className="panel-label mb-1.5 block">User</label>
        <select
          className={selectCls + " mb-4"}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
        >
          <option value="" disabled>
            — chọn user —
          </option>
          {(users.data ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {userLabel(u)}
              {u.email ? ` (${u.email})` : ""}
            </option>
          ))}
        </select>

        <label className="panel-label mb-1.5 block">Loại tài nguyên</label>
        <select
          className={selectCls + " mb-4"}
          value={resourceType}
          onChange={(e) => {
            setResourceType(e.target.value as PermissionResourceType);
            setResourceId("");
            setSelected([]);
          }}
        >
          {RESOURCE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {resourceType === "database-server" && (
          <>
            <label className="panel-label mb-1.5 block">Server</label>
            {(servers.data ?? []).length > 0 ? (
              <select
                className={selectCls + " mb-4"}
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                required
              >
                <option value="" disabled>
                  — chọn server áp dụng —
                </option>
                {(servers.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.type})
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={inputCls + " mono-nums mb-4 text-xs"}
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                placeholder="serverId (bỏ trống = tất cả)"
              />
            )}
          </>
        )}

        {resourceType === "database-config" && (
          <>
            <label className="panel-label mb-1.5 block">Database config</label>
            {(configs.data ?? []).length > 0 ? (
              <select
                className={selectCls + " mb-4"}
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                required
              >
                <option value="" disabled>
                  — chọn config áp dụng —
                </option>
                {(configs.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.configCode ?? shortId(c.id)} — {c.databaseName ?? "?"}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={inputCls + " mono-nums mb-4 text-xs"}
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                placeholder="configId (bỏ trống = tất cả)"
              />
            )}
          </>
        )}

        <label className="panel-label mb-1.5 block">Permissions</label>
        <PermissionChecks
          selected={selected}
          onToggle={toggle}
          hideActions={hiddenActionsForResource(resourceType)}
        />

        <ErrorBox message={error} />

        <button type="submit" disabled={create.isPending} className={submitBtnCls}>
          {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Gán quyền
        </button>
      </form>
    </div>
  );
}

// PUT /user-permission/:id — chỉ được đổi permissions.
// Kèm phần "quyền liên quan": sửa entry server A → cấp thêm quyền
// database-config trên các config con của A; sửa entry config B → cấp thêm
// cho các config anh em cùng server cha. Entry trùng sẽ được gộp, không tạo mới.
function EditPermissionDialog({
  perm,
  userName,
  onClose,
}: {
  perm: UserPermission;
  userName: string;
  onClose: () => void;
}) {
  const configs = useDatabaseConfigs();
  const update = useUpdateUserPermission(perm.id);
  const ensureEntry = useEnsureUserPermission();

  const [selected, setSelected] = useState<string[]>(perm.permissions);
  const [error, setError] = useState<string | null>(null);
  const { addNotification } = useNotifications();

  // --- quyền liên quan trên cùng tài nguyên ---
  const relatedConfigs =
    perm.resourceType === "database-server" && perm.resourceId
      ? (configs.data ?? []).filter(
          (c) => c.databaseServerId === perm.resourceId,
        )
      : [];
  const siblingConfigs =
    perm.resourceType === "database-config" && perm.resourceId
      ? (configs.data ?? []).filter(
          (c) =>
            c.databaseServerId &&
            c.databaseServerId ===
              configs.data?.find((x) => x.id === perm.resourceId)
                ?.databaseServerId &&
            c.id !== perm.resourceId,
        )
      : [];
  const relTargets =
    perm.resourceType === "database-server"
      ? relatedConfigs
      : perm.resourceType === "database-config"
        ? siblingConfigs
        : [];

  const [relIds, setRelIds] = useState<string[]>([]);
  const [relPerms, setRelPerms] = useState<string[]>([
    "database-config:manage",
    "database-config:view",
  ]);

  const toggle = (action: string) =>
    setSelected((prev) =>
      prev.includes(action)
        ? prev.filter((a) => a !== action)
        : [...prev, action],
    );
  const toggleRelId = (id: string) =>
    setRelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const toggleRelPerm = (action: string) =>
    setRelPerms((prev) =>
      prev.includes(action)
        ? prev.filter((a) => a !== action)
        : [...prev, action],
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selected.length === 0)
      return setError("Phải giữ ít nhất một permission");
    if (relIds.length > 0 && relPerms.length === 0)
      return setError("Chọn ít nhất một permission cho các tài nguyên đã tích");
    const mainChanged = !(
      selected.length === perm.permissions.length &&
      selected.every((a) => perm.permissions.includes(a))
    );
    if (!mainChanged && relIds.length === 0)
      return setError("Không có thay đổi nào");
    try {
      if (mainChanged) await update.mutateAsync({ permissions: selected });
      for (const id of relIds) {
        await ensureEntry.mutateAsync({
          userId: perm.userId,
          resourceType: "database-config",
          resourceId: id,
          permissions: relPerms,
        });
      }
      toast.success("Đã cập nhật quyền");
      addNotification(`Đã cập nhật quyền cho user`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="panel w-full max-w-md p-6">
        <DialogHeader title="Sửa Quyền" onClose={onClose} />
        <p className="mb-1 text-xs">
          User: <span className="font-semibold">{userName || shortId(perm.userId)}</span>
        </p>
        <p className="mono-nums mb-4 text-[10px] leading-relaxed text-[var(--text-muted)]">
          {perm.resourceType}
          {perm.resourceId ? ` · ${shortId(perm.resourceId)}` : " · toàn cục"} —
          theo DTO chỉ đổi được danh sách permissions
        </p>

        <label className="panel-label mb-1.5 block">Permissions</label>
        <PermissionChecks
          selected={selected}
          onToggle={toggle}
          hideActions={hiddenActionsForResource(perm.resourceType)}
        />

        {relTargets.length > 0 && (
          <div className="mb-4 border border-[var(--panel-mid)] p-3">
            <label className="panel-label mb-2 block">
              {perm.resourceType === "database-server"
                ? "Thêm quyền Database Config trên cùng server"
                : "Áp dụng thêm cho config khác cùng server"}
            </label>
            <div className="mb-3 grid max-h-40 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
              {relTargets.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 border border-[var(--panel-mid)] px-2 py-1.5 text-xs transition-colors hover:border-[var(--accent-blue)]/60"
                >
                  <input
                    type="checkbox"
                    checked={relIds.includes(c.id)}
                    onChange={() => toggleRelId(c.id)}
                    className="accent-[var(--accent-green)]"
                  />
                  <span className="truncate">
                    {c.configCode ?? shortId(c.id)} — {c.databaseName ?? "?"}
                  </span>
                </label>
              ))}
            </div>
            <PermissionChecks
              selected={relPerms}
              onToggle={toggleRelPerm}
              onlyActions={DATABASE_CONFIG_ACTIONS}
            />
            <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
              Các tài nguyên được tích sẽ nhận đúng các quyền đã chọn ở trên khi
              bấm Lưu (entry đã tồn tại thì gộp thêm, không ghi đè).
            </p>
          </div>
        )}

        <ErrorBox message={error} />

        <button
          type="submit"
          disabled={update.isPending || ensureEntry.isPending}
          className={submitBtnCls}
        >
          {(update.isPending || ensureEntry.isPending) && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          Lưu thay đổi
        </button>
      </form>
    </div>
  );
}

// Chế độ quản lý: admin hoặc user có permission "permission:manage"
function AdminPermissions() {
  const perms = useUserPermissions();
  const users = useUsers();
  const servers = useServers();
  const configs = useDatabaseConfigs();
  const remove = useDeleteUserPermission();
  const { addNotification } = useNotifications();

  const [dialog, setDialog] = useState<
    | { kind: "create" }
    | { kind: "edit"; perm: UserPermission; userName: string }
    | null
  >(null);

  const userById = new Map((users.data ?? []).map((u) => [u.id, u]));
  const serverById = new Map((servers.data ?? []).map((s) => [s.id, s]));
  const configById = new Map((configs.data ?? []).map((c) => [c.id, c]));

  const resourceLabel = (p: UserPermission): string => {
    if (p.resourceType === "global") return "Toàn cục";
    if (!p.resourceId) return "Tất cả";
    const named =
      p.resourceType === "database-server"
        ? serverById.get(p.resourceId)?.name
        : (configById.get(p.resourceId)?.configCode ??
          configById.get(p.resourceId)?.databaseName);
    return named ?? shortId(p.resourceId);
  };

  const onDelete = (p: UserPermission) => {
    const u = userById.get(p.userId);
    if (!confirm(`Xóa quyền "${userLabel(u) || shortId(p.userId)}"?`)) return;
    remove.mutate(p.id, {
      onSuccess: () => {
        toast.success("Đã xóa quyền");
        addNotification(`Đã xóa quyền của user "${userLabel(u) || shortId(p.userId)}"`);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const busy = remove.isPending;

  return (
    <>
      <Panel
        title="Danh sách gán quyền"
        right={
          <button
            onClick={() => setDialog({ kind: "create" })}
            className="flex items-center gap-2 border border-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] transition-colors hover:bg-white hover:text-[var(--panel-dark)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Gán quyền
          </button>
        }
      >
        {perms.data && perms.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--panel-mid)]">
                  <th className={thCls}>User</th>
                  <th className={thCls}>Tài nguyên</th>
                  <th className={thCls}>Permissions</th>
                  <th className={thCls}>Cập nhật</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody>
                {perms.data.map((p) => {
                  const u = userById.get(p.userId);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-[var(--panel-mid)]/50 last:border-0 hover:bg-[var(--panel-mid)]/20"
                    >
                      <td className={tdCls}>
                        <div className="text-xs font-semibold">
                          {userLabel(u) || shortId(p.userId)}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          {u?.email ?? ""}
                        </div>
                      </td>
                      <td className={tdCls}>
                        <div className="text-xs">
                          {RESOURCE_TYPES.find((t) => t.value === p.resourceType)
                            ?.label ?? p.resourceType}
                        </div>
                        <div
                          className="mono-nums text-[10px] text-[var(--text-muted)]"
                          title={p.resourceId ?? undefined}
                        >
                          {resourceLabel(p)}
                        </div>
                      </td>
                      <td className={tdCls}>
                        <div className="flex max-w-md flex-wrap gap-1">
                          {p.permissions.map((a) => (
                            <span
                              key={a}
                              title={a}
                              className="mono-nums border border-[var(--accent-blue)]/40 px-1.5 py-0.5 text-[9px] text-[var(--accent-blue)]"
                            >
                              {permissionLabel(a)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={tdCls + " mono-nums text-xs"}>
                        {formatDateTime(p.updatedAt)}
                      </td>
                      <td className={tdCls}>
                        <div className="flex gap-1.5">
                          <button
                            title="Sửa"
                            disabled={busy}
                            className="flex h-8 w-8 items-center justify-center border border-[var(--panel-mid)] text-[var(--panel-light)] transition-colors hover:border-[var(--accent-blue)] hover:text-white disabled:opacity-40"
                            onClick={() =>
                              setDialog({
                                kind: "edit",
                                perm: p,
                                userName: userLabel(u),
                              })
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            title="Xóa"
                            disabled={busy}
                            className="flex h-8 w-8 items-center justify-center border border-[var(--panel-mid)] text-[var(--accent-red)] transition-colors hover:border-[var(--accent-red)] disabled:opacity-40"
                            onClick={() => onDelete(p)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <TableStateRow
            colSpan={5}
            loading={perms.isLoading}
            empty={'Chưa có gán quyền nào — bấm "+ Gán quyền" để tạo'}
          />
        )}
      </Panel>

      {dialog?.kind === "create" && (
        <CreatePermissionDialog onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "edit" && (
        <EditPermissionDialog
          perm={dialog.perm}
          userName={dialog.userName}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

// Trang chỉ dành cho admin / user có permission "permission:manage" —
// user không đủ quyền vào trực tiếp URL sẽ thấy màn chặn
function PermissionsContent() {
  const view = useMyPermissionsView();

  if (view.resolving) {
    return (
      <Panel title="Phân quyền">
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
        </div>
      </Panel>
    );
  }

  if (!view.canManage) {
    return (
      <Panel title="Phân quyền">
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <ShieldOff className="h-6 w-6 text-[var(--text-muted)]" />
          <p className="text-sm font-semibold">
            Không có quyền truy cập trang này
          </p>
          <p className="max-w-md text-[10px] leading-relaxed text-[var(--text-muted)]">
            Chỉ tài khoản admin hoặc user được gán quyền "Quản lý phân quyền"
            mới xem và chỉnh sửa danh sách phân quyền.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <>
      <PageHeader
        title="Phân quyền"
        sub="Danh sách quyền hạn của user trong hệ thống"
      />
      <AdminPermissions />
    </>
  );
}

export default function Permissions() {
  return (
    <AuthLayout>
      <PermissionsContent />
    </AuthLayout>
  );
}
