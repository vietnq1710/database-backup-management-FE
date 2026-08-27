import { useState, type FormEvent } from "react";
import AuthLayout from "@/components/AuthLayout";
import { PageHeader, Panel } from "@/components/common";
import {
  useCreateDatabaseServer,
  useDeleteDatabaseServer,
  useCreateDatabaseConfig,
  useDatabaseConfigs,
  useDeleteDatabaseConfig,
  useDatabases,
  useServers,
  useUpdateDatabaseConfig,
  useUpdateDatabaseServer,
} from "@/api/hooks";
import { shortId } from "@/lib/format";
import type {
  DatabaseEngine,
  EnvironmentType,
  Server,
} from "@/types/api";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "@/components/NotificationProvider";

const inputCls =
  "w-full border border-[var(--panel-mid)] bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-blue)] placeholder:text-[var(--text-muted)]";
const selectCls = inputCls + " appearance-none";
const submitBtnCls =
  "flex w-full items-center justify-center gap-2 border border-white bg-white py-2.5 text-[11px] font-black uppercase tracking-[0.25em] text-[var(--panel-dark)] transition-all hover:bg-transparent hover:text-white disabled:opacity-50";
const thCls =
  "px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)] whitespace-nowrap";
const tdCls = "px-4 py-3 align-middle";

const ENVIRONMENTS: EnvironmentType[] = [
  "DEVELOPMENT",
  "UAT",
  "STAGING",
  "PRODUCTION",
];
const ENGINES: DatabaseEngine[] = ["postgres", "mongo"];

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

function EnvBadge({ env }: { env: string | null }) {
  if (!env) return <span className="text-xs">—</span>;
  const color =
    env === "PRODUCTION"
      ? "var(--accent-red)"
      : env === "STAGING"
        ? "var(--accent-yellow)"
        : env === "UAT"
          ? "var(--accent-blue)"
          : "var(--accent-green)";
  return (
    <span
      className="border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ borderColor: color, color }}
    >
      {env}
    </span>
  );
}

// POST /database-server — đủ 8 trường theo CreateDatabaseServerDto
function CreateServerDialog({ onClose }: { onClose: () => void }) {
  const [serverName, setServerName] = useState("");
  const [environment, setEnvironment] = useState<EnvironmentType>("DEVELOPMENT");
  const [type, setType] = useState<DatabaseEngine>("postgres");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(5432);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [connectionOptions, setConnectionOptions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateDatabaseServer();
  const { addNotification } = useNotifications();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate(
      {
        serverName: serverName.trim(),
        environment,
        type,
        host: host.trim(),
        port,
        username: username.trim(),
        password,
        ...(connectionOptions.trim()
          ? { connectionOptions: connectionOptions.trim() }
          : {}),
      },
      {
        onSuccess: () => {
          toast.success("Đã tạo database server");
          addNotification(`Đã tạo server "${serverName.trim()}"`);
          onClose();
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="panel w-full max-w-md p-6">
        <DialogHeader title="Tạo Database Server" onClose={onClose} />

        <label className="panel-label mb-1.5 block">Tên server</label>
        <input
          className={inputCls + " mb-4"}
          value={serverName}
          onChange={(e) => setServerName(e.target.value)}
          required
          placeholder="pg-prod-main"
        />

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="panel-label mb-1.5 block">Môi trường</label>
            <select
              className={selectCls}
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as EnvironmentType)}
            >
              {ENVIRONMENTS.map((env) => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="panel-label mb-1.5 block">Loại DB</label>
            <select
              className={selectCls}
              value={type}
              onChange={(e) => setType(e.target.value as DatabaseEngine)}
            >
              {ENGINES.map((eng) => (
                <option key={eng} value={eng}>
                  {eng === "postgres" ? "PostgreSQL" : "MongoDB"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-[1fr_110px] gap-3">
          <div>
            <label className="panel-label mb-1.5 block">Host</label>
            <input
              className={inputCls}
              value={host}
              onChange={(e) => setHost(e.target.value)}
              required
              placeholder="10.0.0.5"
            />
          </div>
          <div>
            <label className="panel-label mb-1.5 block">Port</label>
            <input
              type="number"
              min={1}
              max={65535}
              className={inputCls}
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              required
            />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="panel-label mb-1.5 block">Username</label>
            <input
              className={inputCls}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div>
            <label className="panel-label mb-1.5 block">Password</label>
            <input
              type="password"
              autoComplete="new-password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <label className="panel-label mb-1.5 block">
          Connection options (tùy chọn)
        </label>
        <input
          className={inputCls + " mb-4"}
          value={connectionOptions}
          onChange={(e) => setConnectionOptions(e.target.value)}
          placeholder="?sslmode=require"
        />

        <ErrorBox message={error} />

        <button type="submit" disabled={create.isPending} className={submitBtnCls}>
          {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Tạo server
        </button>
      </form>
    </div>
  );
}

// PUT /database-server/:id — PartialType(entity), chỉ gửi trường người dùng đổi
function EditServerDialog({
  server,
  onClose,
}: {
  server: Server;
  onClose: () => void;
}) {
  const [serverName, setServerName] = useState(server.name);
  const [environment, setEnvironment] = useState<EnvironmentType>(
    (ENVIRONMENTS.includes(server.environment as EnvironmentType)
      ? server.environment
      : "DEVELOPMENT") as EnvironmentType,
  );
  const [type, setType] = useState<DatabaseEngine>(
    server.type === "mongo" ? "mongo" : "postgres",
  );
  const [host, setHost] = useState(server.host ?? "");
  const [port, setPort] = useState(server.port ?? 5432);
  const [username, setUsername] = useState(server.username ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateDatabaseServer();
  const { addNotification } = useNotifications();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: Record<string, unknown> = {};
    if (serverName.trim() && serverName.trim() !== server.name)
      payload.serverName = serverName.trim();
    if (environment !== server.environment) payload.environment = environment;
    if (type !== server.type) payload.type = type;
    if (host.trim() && host.trim() !== server.host) payload.host = host.trim();
    if (port !== server.port) payload.port = port;
    if (username.trim() && username.trim() !== server.username)
      payload.username = username.trim();
    if (password) payload.password = password;
    if (Object.keys(payload).length === 0)
      return setError("Không có thay đổi nào");
    update.mutate(
      { id: server.id, payload },
      {
        onSuccess: () => {
          toast.success("Đã cập nhật server");
          addNotification(`Đã cập nhật server "${serverName.trim()}"`);
          onClose();
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="panel w-full max-w-md p-6">
        <DialogHeader title="Sửa Database Server" onClose={onClose} />
        <p className="mono-nums mb-4 text-[10px] text-[var(--text-muted)]">
          id: {server.id}
        </p>

        <label className="panel-label mb-1.5 block">Tên server</label>
        <input
          className={inputCls + " mb-4"}
          value={serverName}
          onChange={(e) => setServerName(e.target.value)}
        />

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="panel-label mb-1.5 block">Môi trường</label>
            <select
              className={selectCls}
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as EnvironmentType)}
            >
              {ENVIRONMENTS.map((env) => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="panel-label mb-1.5 block">Loại DB</label>
            <select
              className={selectCls}
              value={type}
              onChange={(e) => setType(e.target.value as DatabaseEngine)}
            >
              {ENGINES.map((eng) => (
                <option key={eng} value={eng}>
                  {eng === "postgres" ? "PostgreSQL" : "MongoDB"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-[1fr_110px] gap-3">
          <div>
            <label className="panel-label mb-1.5 block">Host</label>
            <input
              className={inputCls}
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
          </div>
          <div>
            <label className="panel-label mb-1.5 block">Port</label>
            <input
              type="number"
              min={1}
              max={65535}
              className={inputCls}
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="panel-label mb-1.5 block">Username</label>
            <input
              className={inputCls}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="panel-label mb-1.5 block">
              Password (đặt lại)
            </label>
            <input
              type="password"
              autoComplete="new-password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="bỏ trống nếu không đổi"
            />
          </div>
        </div>

        <ErrorBox message={error} />

        <button type="submit" disabled={update.isPending} className={submitBtnCls}>
          {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Lưu thay đổi
        </button>
      </form>
    </div>
  );
}

// POST /database-config: configCode + databaseServerId + databaseName
function CreateConfigDialog({ onClose }: { onClose: () => void }) {
  const servers = useServers();
  const [configCode, setConfigCode] = useState("");
  const [serverId, setServerId] = useState("");
  const [databaseName, setDatabaseName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateDatabaseConfig();
  const { addNotification } = useNotifications();
  // danh sách database trên server đã chọn — chọn thay vì nhập tay
  const databases = useDatabases(serverId || null);
  const dbOptions = databases.data?.items ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!configCode.trim()) return setError("Nhập config code");
    if (!serverId) return setError("Chọn database server");
    if (!databaseName.trim()) return setError("Nhập tên database");
    create.mutate(
      {
        configCode: configCode.trim(),
        databaseServerId: serverId,
        databaseName: databaseName.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Đã tạo database config");
          addNotification(`Đã tạo config "${configCode.trim()}"`);
          onClose();
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="panel w-full max-w-md p-6">
        <DialogHeader title="Tạo Database Config" onClose={onClose} />

        <label className="panel-label mb-1.5 block">Config code</label>
        <input
          className={inputCls + " mb-4"}
          value={configCode}
          onChange={(e) => setConfigCode(e.target.value)}
          required
          placeholder="orders-prod"
        />

        <label className="panel-label mb-1.5 block">Database server</label>
        <select
          className={selectCls + " mb-4"}
          value={serverId}
          onChange={(e) => {
            setServerId(e.target.value);
            setDatabaseName("");
          }}
          required
        >
          <option value="" disabled>
            — chọn server —
          </option>
          {(servers.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.type})
            </option>
          ))}
        </select>

        <label className="panel-label mb-1.5 block">Database name</label>
        {serverId && dbOptions.length > 0 ? (
          <>
            <select
              className={selectCls + " mb-1"}
              value={databaseName}
              onChange={(e) => setDatabaseName(e.target.value)}
              required
            >
              <option value="" disabled>
                — chọn database —
              </option>
              {dbOptions.map((d) => (
                <option key={d.databaseName} value={d.databaseName}>
                  {d.databaseName}
                </option>
              ))}
            </select>
            {databases.isFetching ? (
              <p className="mono-nums mb-4 text-[10px] text-[var(--text-muted)]">
                Đang tải danh sách database...
              </p>
            ) : (
              databases.data?.errorMessage && (
                <p className="mb-4 text-[10px] text-[var(--accent-red)]">
                  {databases.data.errorMessage}
                </p>
              )
            )}
            {!databases.isFetching && !databases.data?.errorMessage && (
              <p className="mb-4 text-[10px] text-[var(--text-muted)]">
                Danh sách từ lần quét gần nhất của server.
              </p>
            )}
          </>
        ) : (
          <>
            <input
              className={inputCls + " mb-1"}
              value={databaseName}
              onChange={(e) => setDatabaseName(e.target.value)}
              required
              placeholder="orders"
            />
            <p className="mb-4 text-[10px] text-[var(--text-muted)]">
              {serverId
                ? "Server chưa có dữ liệu quét — nhập tên database thủ công."
                : "Chọn server để lấy danh sách database (nếu đã quét)."}
            </p>
          </>
        )}

        <p className="mb-4 text-[10px] leading-relaxed text-[var(--text-muted)]">
          Username/password bổ sung qua nút Sửa sau khi tạo (theo DTO update).
        </p>

        <ErrorBox message={error} />

        <button type="submit" disabled={create.isPending} className={submitBtnCls}>
          {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Tạo config
        </button>
      </form>
    </div>
  );
}

// PUT /database-config/:id: configCode / username / password — tất cả optional
function EditConfigDialog({
  id,
  initialCode,
  initialUsername,
  onClose,
}: {
  id: string;
  initialCode: string;
  initialUsername: string;
  onClose: () => void;
}) {
  const [configCode, setConfigCode] = useState(initialCode);
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateDatabaseConfig(id);
  const { addNotification } = useNotifications();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    // chỉ gửi các trường người dùng có ý định đổi
    const payload: Record<string, string> = {};
    if (configCode.trim() && configCode.trim() !== initialCode)
      payload.configCode = configCode.trim();
    if (username.trim() && username.trim() !== initialUsername)
      payload.username = username.trim();
    if (password) payload.password = password;
    if (Object.keys(payload).length === 0)
      return setError("Không có thay đổi nào");
    update.mutate(payload, {
      onSuccess: () => {
        toast.success("Đã cập nhật config");
        addNotification(`Đã cập nhật config "${configCode.trim()}"`);
        onClose();
      },
      onError: (err) => setError(err.message),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="panel w-full max-w-md p-6">
        <DialogHeader title="Sửa Database Config" onClose={onClose} />
        <p className="mono-nums mb-4 text-[10px] text-[var(--text-muted)]">
          id: {id}
        </p>

        <label className="panel-label mb-1.5 block">Config code</label>
        <input
          className={inputCls + " mb-4"}
          value={configCode}
          onChange={(e) => setConfigCode(e.target.value)}
          placeholder={initialCode || "orders-prod"}
        />

        <label className="panel-label mb-1.5 block">Username</label>
        <input
          className={inputCls + " mb-4"}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="backup_user"
        />

        <label className="panel-label mb-1.5 block">
          Password {initialUsername ? "(đặt lại)" : ""}
        </label>
        <input
          type="password"
          autoComplete="new-password"
          className={inputCls + " mb-4"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="bỏ trống nếu không đổi"
        />

        <ErrorBox message={error} />

        <button type="submit" disabled={update.isPending} className={submitBtnCls}>
          {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Lưu thay đổi
        </button>
      </form>
    </div>
  );
}

function ServersContent() {
  const servers = useServers();
  const configs = useDatabaseConfigs();
  const remove = useDeleteDatabaseServer();
  const removeConfig = useDeleteDatabaseConfig();
  const { addNotification } = useNotifications();
  const [dialog, setDialog] = useState<
    { kind: "create" } | { kind: "edit"; server: Server } | null
  >(null);
  const [configDialog, setConfigDialog] = useState<
    | { kind: "create" }
    | { kind: "edit"; id: string; code: string; username: string }
    | null
  >(null);
  // join databaseServerId -> server để hiện tên trong bảng config
  const serverById = new Map((servers.data ?? []).map((s) => [s.id, s]));

  const onRemove = (s: Server) => {
    if (!confirm(`Xóa server "${s.name}"?`)) return;
    remove.mutate(s.id, {
      onSuccess: () => {
        toast.success(`Đã xóa server ${s.name}`);
        addNotification(`Đã xóa server "${s.name}"`);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const onRemoveConfig = (id: string, code: string) => {
    if (!confirm(`Xóa config "${code}"?`)) return;
    removeConfig.mutate(id, {
      onSuccess: () => {
        toast.success(`Đã xóa config ${code}`);
        addNotification(`Đã xóa config "${code}"`);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <>
      <PageHeader
        title="Servers & Database Configs"
        sub="Máy chủ database nguồn và cấu hình database dùng cho backup & sync job"
      />

      <Panel
        title="Servers"
        right={
          <button
            onClick={() => setDialog({ kind: "create" })}
            className="flex items-center gap-2 border border-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] transition-colors hover:bg-white hover:text-[var(--panel-dark)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm Server
          </button>
        }
      >
        {servers.data && servers.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--panel-mid)]">
                  <th className={thCls}>Server</th>
                  <th className={thCls}>Môi trường</th>
                  <th className={thCls}>Loại DB</th>
                  <th className={thCls}>Host</th>
                  <th className={thCls}>User</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody>
                {servers.data.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-[var(--panel-mid)]/50 last:border-0 hover:bg-[var(--panel-mid)]/20"
                    title={`id: ${s.id}`}
                  >
                    <td className={tdCls + " mono-nums text-xs"} title={s.id}>
                      {s.name}
                      <span className="ml-2 text-[10px] text-[var(--text-muted)]">
                        {shortId(s.id)}
                      </span>
                    </td>
                    <td className={tdCls}>
                      <EnvBadge env={s.environment} />
                    </td>
                    <td className={tdCls + " text-xs uppercase"}>
                      {s.type === "mongo" ? "MongoDB" : s.type}
                    </td>
                    <td className={tdCls + " mono-nums text-xs"}>
                      {s.host ?? "—"}
                      {s.port ? `:${s.port}` : ""}
                    </td>
                    <td className={tdCls + " mono-nums text-xs"}>
                      {s.username ?? "—"}
                    </td>
                    <td className={tdCls}>
                      <div className="flex gap-1.5">
                        <button
                          title="Sửa"
                          className="border border-[var(--panel-mid)] p-1.5 text-[var(--text-muted)] transition-colors hover:border-[var(--accent-blue)] hover:text-white"
                          onClick={() => setDialog({ kind: "edit", server: s })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Xóa"
                          className="border border-[var(--panel-mid)] p-1.5 text-[var(--text-muted)] transition-colors hover:border-[var(--accent-red)] hover:text-white"
                          onClick={() => onRemove(s)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-xs text-[var(--text-muted)]">
            {servers.isLoading
              ? "Đang tải..."
              : 'Chưa có server nào — bấm "+ Thêm Server" để tạo (hoặc bạn chưa được cấp quyền xem server nào)'}
          </div>
        )}
      </Panel>

      <Panel
        title="Database Configs"
        className="mt-6"
        right={
          <button
            onClick={() => setConfigDialog({ kind: "create" })}
            className="flex items-center gap-2 border border-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] transition-colors hover:bg-white hover:text-[var(--panel-dark)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm Config
          </button>
        }
      >
        {configs.data && configs.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--panel-mid)]">
                  <th className={thCls}>Config</th>
                  <th className={thCls}>Database</th>
                  <th className={thCls}>Server</th>
                  <th className={thCls}>Host</th>
                  <th className={thCls}>Loại DB</th>
                  <th className={thCls}>Môi trường</th>
                  <th className={thCls}>User</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody>
                {configs.data.map((c) => {
                  const srv = c.databaseServerId
                    ? serverById.get(c.databaseServerId)
                    : undefined;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-[var(--panel-mid)]/50 last:border-0 hover:bg-[var(--panel-mid)]/20"
                      title={
                        srv
                          ? `${srv.name} (${srv.environment ?? "?"})`
                          : `databaseServerId: ${c.databaseServerId ?? "?"}`
                      }
                    >
                      <td className={tdCls + " mono-nums text-xs"} title={c.id}>
                        {c.configCode ?? shortId(c.id)}
                      </td>
                      <td className={tdCls + " text-xs"}>{c.databaseName ?? "—"}</td>
                      <td className={tdCls + " text-xs"}>
                        {srv ? (
                          <>
                            {srv.name}
                            <span className="mono-nums ml-2 text-[10px] text-[var(--text-muted)]">
                              {shortId(srv.id)}
                            </span>
                          </>
                        ) : (
                          <span className="mono-nums">
                            {c.databaseServerId
                              ? shortId(c.databaseServerId)
                              : "—"}
                          </span>
                        )}
                      </td>
                      <td className={tdCls + " mono-nums text-xs"}>
                        {(srv?.host ?? c.host) ?? "—"}
                        {c.port ? `:${c.port}` : ""}
                      </td>
                      <td className={tdCls + " text-xs"}>{c.databaseType ?? "—"}</td>
                      <td className={tdCls}>
                        <EnvBadge env={c.environment ?? srv?.environment ?? null} />
                      </td>
                      <td className={tdCls + " mono-nums text-xs"}>
                        {c.username ?? "—"}
                      </td>
                      <td className={tdCls}>
                        <div className="flex gap-1.5">
                          <button
                            title="Sửa"
                            className="border border-[var(--panel-mid)] p-1.5 text-[var(--text-muted)] transition-colors hover:border-[var(--accent-blue)] hover:text-white"
                            onClick={() =>
                              setConfigDialog({
                                kind: "edit",
                                id: c.id,
                                code: c.configCode ?? "",
                                username: c.username ?? "",
                              })
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            title="Xóa"
                            className="border border-[var(--panel-mid)] p-1.5 text-[var(--text-muted)] transition-colors hover:border-[var(--accent-red)] hover:text-white"
                            onClick={() => onRemoveConfig(c.id, c.configCode ?? shortId(c.id))}
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
          <div className="px-5 py-8 text-center text-xs text-[var(--text-muted)]">
            {configs.isLoading
              ? "Đang tải..."
              : 'Chưa có database config nào — bấm "+ Thêm Config" để tạo (hoặc bạn chưa được cấp quyền xem config nào)'}
          </div>
        )}
      </Panel>

      {dialog?.kind === "create" && (
        <CreateServerDialog onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "edit" && (
        <EditServerDialog server={dialog.server} onClose={() => setDialog(null)} />
      )}

      {configDialog?.kind === "create" && (
        <CreateConfigDialog onClose={() => setConfigDialog(null)} />
      )}
      {configDialog?.kind === "edit" && (
        <EditConfigDialog
          id={configDialog.id}
          initialCode={configDialog.code}
          initialUsername={configDialog.username}
          onClose={() => setConfigDialog(null)}
        />
      )}
    </>
  );
}

export default function Servers() {
  return (
    <AuthLayout>
      <ServersContent />
    </AuthLayout>
  );
}
