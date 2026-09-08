import { Fragment, useState, type FormEvent, type ReactNode } from "react";
import { Pagination } from "@/components/Pagination";
import { ViewToggle } from "@/components/common";
import {
  useProjects,
  useCreateDatabaseConfig,
  useDatabaseConfigsPage,
  useDeleteDatabaseConfig,
  useUpdateDatabaseConfig,
} from "@/api/hooks";
import { formatDateTime, shortId, totalPagesOf } from "@/lib/format";
import type {
  CreateDatabaseConfigPayload,
  DatabaseConfig,
  DatabaseEngine,
  EnvironmentType,
  UpdateDatabaseConfigPayload,
} from "@/types/api";
import { Loader2, Pencil, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "@/components/NotificationProvider";

const inputCls =
  "w-full border border-[var(--panel-mid)] bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-blue)] placeholder:text-[var(--text-muted)]";
const submitBtnCls =
  "flex w-full items-center justify-center gap-2 border border-[var(--foreground)] bg-[var(--foreground)] py-2.5 text-[11px] font-black uppercase tracking-[0.25em] text-[var(--background)] transition-all hover:bg-transparent hover:text-[var(--foreground)] disabled:opacity-50";
const thCls =
  "px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)] whitespace-nowrap";
const tdCls = "px-4 py-2.5 align-middle";
const actionBtnCls =
  "p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--panel-mid-40)] hover:text-[var(--foreground)]";

const ENVIRONMENTS: EnvironmentType[] = [
  "DEVELOPMENT",
  "UAT",
  "STAGING",
  "PRODUCTION",
];
const ENGINES: { key: DatabaseEngine; label: string }[] = [
  { key: "postgres", label: "PostgreSQL" },
  { key: "mongo", label: "MongoDB" },
];

function PostgresLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 432.071 445.383" className={className} aria-label="PostgreSQL">
      <g
        fill="#336791"
        stroke="#FFFFFF"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit={4}
      >
        <path
          strokeWidth={18}
          strokeLinecap="butt"
          strokeLinejoin="miter"
          d="M323.205,324.227c2.833-23.601,1.984-27.062,19.563-23.239l4.463,0.392c13.517,0.615,31.199-2.174,41.587-7c22.362-10.376,35.622-27.7,13.572-23.148c-50.297,10.376-53.755-6.655-53.755-6.655c53.111-78.803,75.313-178.836,56.149-203.322    C352.514-5.534,262.036,26.049,260.522,26.869l-0.482,0.089c-9.938-2.062-21.06-3.294-33.554-3.496c-22.761-0.374-40.032,5.967-53.133,15.904c0,0-161.408-66.498-153.899,83.628c1.597,31.936,45.777,241.655,98.47,178.31    c19.259-23.163,37.871-42.748,37.871-42.748c9.242,6.14,20.307,9.272,31.912,8.147l0.897-0.765c-0.281,2.876-0.157,5.689,0.359,9.019c-13.572,15.167-9.584,17.83-36.723,23.416c-27.457,5.659-11.326,15.734-0.797,18.367c12.768,3.193,42.305,7.716,62.268-20.224    l-0.795,3.188c5.325,4.26,4.965,30.619,5.72,49.452c0.756,18.834,2.017,36.409,5.856,46.771c3.839,10.36,8.369,37.05,44.036,29.406c29.809-6.388,52.6-15.582,54.677-101.107"
        />
        <path
          stroke="none"
          d="M402.395,271.23c-50.302,10.376-53.76-6.655-53.76-6.655c53.111-78.808,75.313-178.843,56.153-203.326c-52.27-66.785-142.752-35.2-144.262-34.38l-0.486,0.087c-9.938-2.063-21.06-3.292-33.56-3.496c-22.761-0.373-40.026,5.967-53.127,15.902    c0,0-161.411-66.495-153.904,83.63c1.597,31.938,45.776,241.657,98.471,178.312c19.26-23.163,37.869-42.748,37.869-42.748c9.243,6.14,20.308,9.272,31.908,8.147l0.901-0.765c-0.28,2.876-0.152,5.689,0.361,9.019c-13.575,15.167-9.586,17.83-36.723,23.416    c-27.459,5.659-11.328,15.734-0.796,18.367c12.768,3.193,42.307,7.716,62.266-20.224l-0.796,3.188c5.319,4.26,9.054,27.711,8.428,48.969c-0.626,21.259-1.044,35.854,3.147,47.254c4.191,11.4,8.368,37.05,44.042,29.406c29.809-6.388,45.256-22.942,47.405-50.555    c1.525-19.631,4.976-16.729,5.194-34.28l2.768-8.309c3.192-26.611,0.507-35.196,18.872-31.203l4.463,0.392c13.517,0.615,31.208-2.174,41.591-7c22.358-10.376,35.618-27.7,13.573-23.148z"
        />
        <path d="M215.866,286.484c-1.385,49.516,0.348,99.377,5.193,111.495c4.848,12.118,15.223,35.688,50.9,28.045c29.806-6.39,40.651-18.756,45.357-46.051c3.466-20.082,10.148-75.854,11.005-87.281" />
        <path d="M173.104,38.256c0,0-161.521-66.016-154.012,84.109c1.597,31.938,45.779,241.664,98.473,178.316c19.256-23.166,36.671-41.335,36.671-41.335" />
        <path d="M260.349,26.207c-5.591,1.753,89.848-34.889,144.087,34.417c19.159,24.484-3.043,124.519-56.153,203.329" />
        <path
          strokeLinejoin="bevel"
          d="M348.282,263.953c0,0,3.461,17.036,53.764,6.653c22.04-4.552,8.776,12.774-13.577,23.155c-18.345,8.514-59.474,10.696-60.146-1.069c-1.729-30.355,21.647-21.133,19.96-28.739c-1.525-6.85-11.979-13.573-18.894-30.338    c-6.037-14.633-82.796-126.849,21.287-110.183c3.813-0.789-27.146-99.002-124.553-100.599c-97.385-1.597-94.19,119.762-94.19,119.762"
        />
        <path d="M188.604,274.334c-13.577,15.166-9.584,17.829-36.723,23.417c-27.459,5.66-11.326,15.733-0.797,18.365c12.768,3.195,42.307,7.718,62.266-20.229c6.078-8.509-0.036-22.086-8.385-25.547c-4.034-1.671-9.428-3.765-16.361,3.994z" />
        <path d="M187.715,274.069c-1.368-8.917,2.93-19.528,7.536-31.942c6.922-18.626,22.893-37.255,10.117-96.339c-9.523-44.029-73.396-9.163-73.436-3.193c-0.039,5.968,2.889,30.26-1.067,58.548c-5.162,36.913,23.488,68.132,56.479,64.938" />
        <path
          fill="#FFFFFF"
          strokeWidth={2}
          strokeLinecap="butt"
          strokeLinejoin="miter"
          d="M172.517,141.7c-0.288,2.039,3.733,7.48,8.976,8.207c5.234,0.73,9.714-3.522,9.998-5.559c0.284-2.039-3.732-4.285-8.977-5.015c-5.237-0.731-9.719,0.333-9.996,2.367z"
        />
        <path
          fill="#FFFFFF"
          strokeWidth={1}
          strokeLinecap="butt"
          strokeLinejoin="miter"
          d="M331.941,137.543c0.284,2.039-3.732,7.48-8.976,8.207c-5.238,0.73-9.718-3.522-10.005-5.559c-0.277-2.039,3.74-4.285,8.979-5.015c5.239-0.73,9.718,0.333,10.002,2.368z"
        />
        <path d="M350.676,123.432c0.863,15.994-3.445,26.888-3.988,43.914c-0.804,24.748,11.799,53.074-7.191,81.435" />
      </g>
    </svg>
  );
}

function MongoLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 265" className={className} aria-label="MongoDB">
      <path
        fill="#10aa50"
        d="M134.44,120.34C119.13,52.8,87.22,34.82,79.08,22.11a144.57,144.57,0,0,1-8.9-17.42c-.43,6-1.22,9.78-6.32,14.33C53.62,28.15,10.13,63.59,6.47,140.33c-3.41,71.55,52.6,115.67,60,120.23,5.69,2.8,12.62.06,16-2.51,27-18.53,63.89-67.93,52-137.71"
      />
      <path
        fill="#12924f"
        d="M82.7,257.92h0c-7.64-3.53-9.85-20.06-10.19-35.46a725.83,725.83,0,0,0,1.65-76.35c-.4-13.36.19-123.74-3.29-139.9A134.29,134.29,0,0,0,79.08,22.1c8.14,12.72,40.06,30.7,55.36,98.24C146.36,190,109.67,239.27,82.7,257.92Z"
      />
    </svg>
  );
}

function EngineLogo({ engine, className }: { engine: string | null; className?: string }) {
  return engine === "mongo" ? (
    <MongoLogo className={className} />
  ) : (
    <PostgresLogo className={className} />
  );
}

function EnvBadge({ env }: { env: string | null | undefined }) {
  if (!env) return <span className="text-[10px] text-[var(--text-muted)]">—</span>;
  const color =
    env === "PRODUCTION"
      ? "border-[var(--accent-red)] text-[var(--accent-red)]"
      : env === "STAGING"
        ? "border-amber-400 text-amber-400"
        : env === "UAT"
          ? "border-purple-400 text-purple-400"
          : "border-[var(--accent-blue)] text-[var(--accent-blue)]";
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] " +
        color
      }
    >
      {env === "PRODUCTION" && (
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-red)]" />
      )}
      {env === "STAGING" && (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      )}
      {env === "UAT" && (
        <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
      )}
      {env === "DEVELOPMENT" && (
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-blue)]" />
      )}
      {env}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="panel-label mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

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
        className="text-[var(--text-muted)] hover:text-[var(--foreground)]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mb-0 border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
      {message}
    </p>
  );
}

function projectName(id: string | null, projects: { id: string; name: string }[]): string {
  if (!id) return "—";
  const p = projects.find((x) => x.id === id);
  return p ? p.name : shortId(id);
}

function CreateConfigDialog({ onClose }: { onClose: () => void }) {
  const { data: projects } = useProjects();
  const create = useCreateDatabaseConfig();
  const { addNotification } = useNotifications();
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<CreateDatabaseConfigPayload>({
    configCode: "",
    projectId: "",
    databaseType: "postgres",
    host: "",
    port: 5432,
    username: "",
    password: "",
    databaseName: "",
    environment: "DEVELOPMENT",
  });

  const set = <K extends keyof CreateDatabaseConfigPayload>(
    key: K,
    value: CreateDatabaseConfigPayload[K],
  ) => setPayload((p) => ({ ...p, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!payload.configCode.trim()) return setError("Thiếu mã config (configCode)");
    if (!payload.projectId) return setError("Thiếu project");
    if (!payload.host.trim()) return setError("Thiếu host");
    if (!payload.databaseName.trim()) return setError("Thiếu database name");
    create.mutate(
      { ...payload, port: Number(payload.port) || 0 },
      {
        onSuccess: () => {
          toast.success(`Đã tạo config ${payload.configCode}`);
          addNotification(`Đã tạo database config "${payload.configCode}"`);
          onClose();
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-[var(--panel-mid)] bg-[var(--panel-dark)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader title="Tạo Database Config" onClose={onClose} />
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Mã config (configCode)">
              <input
                className={inputCls}
                value={payload.configCode}
                onChange={(e) => set("configCode", e.target.value)}
                placeholder="banking-postgres-dev"
                required
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Project">
              <select
                className={inputCls}
                value={payload.projectId}
                onChange={(e) => set("projectId", e.target.value)}
                required
              >
                <option value="">Chọn project…</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Loại database">
            <select
              className={inputCls}
              value={payload.databaseType}
              onChange={(e) => set("databaseType", e.target.value as DatabaseEngine)}
            >
              {ENGINES.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Môi trường">
            <select
              className={inputCls}
              value={payload.environment}
              onChange={(e) => set("environment", e.target.value as EnvironmentType)}
            >
              {ENVIRONMENTS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Host">
            <input
              className={inputCls}
              value={payload.host}
              onChange={(e) => set("host", e.target.value)}
              placeholder="localhost"
              required
            />
          </Field>
          <Field label="Port">
            <input
              className={inputCls}
              type="number"
              value={payload.port}
              onChange={(e) => set("port", Number(e.target.value))}
            />
          </Field>
          <Field label="Database name">
            <input
              className={inputCls}
              value={payload.databaseName}
              onChange={(e) => set("databaseName", e.target.value)}
              placeholder="banking_core"
              required
            />
          </Field>
          <Field label="Username">
            <input
              className={inputCls}
              value={payload.username}
              onChange={(e) => set("username", e.target.value)}
              placeholder="postgres"
            />
          </Field>
          <div className="col-span-2">
            <Field label="Password">
              <input
                className={inputCls}
                type="password"
                value={payload.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="••••••••"
              />
            </Field>
          </div>
          {error && <ErrorBox message={error} />}
          <button
            type="submit"
            disabled={create.isPending}
            className={submitBtnCls + " col-span-2"}
          >
            {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Tạo config
          </button>
        </form>
      </div>
    </div>
  );
}

function EditConfigDialog({
  config,
  onClose,
}: {
  config: DatabaseConfig;
  onClose: () => void;
}) {
  const { data: projects } = useProjects();
  const update = useUpdateDatabaseConfig(config.id);
  const { addNotification } = useNotifications();
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<UpdateDatabaseConfigPayload>({
    configCode: config.configCode ?? "",
    projectId: config.projectId ?? undefined,
    databaseType: (config.databaseType as DatabaseEngine) ?? undefined,
    host: config.host ?? "",
    port: config.port ?? undefined,
    databaseName: config.databaseName ?? "",
    username: config.username ?? "",
    environment: (config.environment as EnvironmentType) ?? undefined,
  });

  const original = {
    configCode: config.configCode ?? "",
    projectId: config.projectId ?? undefined,
    host: config.host ?? "",
    port: config.port ?? undefined,
    databaseName: config.databaseName ?? "",
    username: config.username ?? "",
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (
      payload.configCode === original.configCode &&
      payload.projectId === original.projectId &&
      payload.host === original.host &&
      payload.port === original.port &&
      payload.databaseName === original.databaseName &&
      payload.username === original.username &&
      (payload.databaseType ?? null) === (config.databaseType as DatabaseEngine | null) &&
      (payload.environment ?? null) === (config.environment as EnvironmentType | null)
    ) {
      return setError("Không có thay đổi nào");
    }
    update.mutate(
      {
        ...payload,
        port: payload.port ? Number(payload.port) : undefined,
        password: undefined,
      },
      {
        onSuccess: () => {
          toast.success("Đã cập nhật config");
          addNotification(`Đã cập nhật database config "${config.configCode ?? shortId(config.id)}"`);
          onClose();
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-[var(--panel-mid)] bg-[var(--panel-dark)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader title="Sửa Database Config" onClose={onClose} />
        <p className="mono-nums mb-4 text-[10px] text-[var(--text-muted)]">
          {shortId(config.id)}
        </p>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Mã config (configCode)">
              <input
                className={inputCls}
                value={payload.configCode ?? ""}
                onChange={(e) => setPayload((p) => ({ ...p, configCode: e.target.value }))}
                required
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Project">
              <select
                className={inputCls}
                value={payload.projectId ?? ""}
                onChange={(e) => setPayload((p) => ({ ...p, projectId: e.target.value }))}
              >
                <option value="">Chọn project…</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Loại database">
            <select
              className={inputCls}
              value={payload.databaseType ?? "postgres"}
              onChange={(e) =>
                setPayload((p) => ({ ...p, databaseType: e.target.value as DatabaseEngine }))
              }
            >
              {ENGINES.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Môi trường">
            <select
              className={inputCls}
              value={payload.environment ?? "DEVELOPMENT"}
              onChange={(e) =>
                setPayload((p) => ({ ...p, environment: e.target.value as EnvironmentType }))
              }
            >
              {ENVIRONMENTS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Host">
            <input
              className={inputCls}
              value={payload.host ?? ""}
              onChange={(e) => setPayload((p) => ({ ...p, host: e.target.value }))}
              required
            />
          </Field>
          <Field label="Port">
            <input
              className={inputCls}
              type="number"
              value={payload.port ?? ""}
              onChange={(e) =>
                setPayload((p) => ({ ...p, port: e.target.value === "" ? undefined : Number(e.target.value) }))
              }
            />
          </Field>
          <Field label="Database name">
            <input
              className={inputCls}
              value={payload.databaseName ?? ""}
              onChange={(e) => setPayload((p) => ({ ...p, databaseName: e.target.value }))}
              required
            />
          </Field>
          <Field label="Username">
            <input
              className={inputCls}
              value={payload.username ?? ""}
              onChange={(e) => setPayload((p) => ({ ...p, username: e.target.value }))}
            />
          </Field>
          {error && <ErrorBox message={error} />}
          <button
            type="submit"
            disabled={update.isPending}
            className={submitBtnCls + " col-span-2"}
          >
            {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Lưu thay đổi
          </button>
        </form>
      </div>
    </div>
  );
}

function ConfigDetailDialog({
  config,
  projName,
  onClose,
}: {
  config: DatabaseConfig;
  projName: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md border border-[var(--panel-mid)] bg-[var(--panel-dark)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader title="Chi tiết Config" onClose={onClose} />
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <EngineLogo
              engine={config.databaseType}
              className="h-10 w-10 rounded-lg"
            />
            <div>
              <div className="truncate text-lg font-bold">
                {config.configCode ?? "—"}
              </div>
              <div className="mono-nums text-[10px] text-[var(--text-muted)]">
                {config.id}
              </div>
            </div>
          </div>
          <EnvBadge env={config.environment} />
        </div>

        <dl className="divide-y divide-[var(--panel-mid)]/50 border-t border-[var(--panel-mid)] text-sm">
          {[
            ["Project", projName],
            ["Loại database", config.databaseType ?? "—"],
            ["Host", config.host ?? "—"],
            ["Port", config.port ? String(config.port) : "—"],
            ["Database name", config.databaseName ?? "—"],
            ["Username", config.username ?? "—"],
            ["Created", config.createdAt ? formatDateTime(config.createdAt) : "—"],
            ["Updated", config.updatedAt ? formatDateTime(config.updatedAt) : "—"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-2.5">
              <dt className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {k}
              </dt>
              <dd className="mono-nums truncate text-xs">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function groupOf(c: DatabaseConfig): { key: string; name: string } {
  return c.projectId
    ? { key: c.projectId, name: c.projectId }
    : { key: "other", name: "Khác" };
}

export type ConfigDialogState =
  | { kind: "create" }
  | { kind: "edit"; config: DatabaseConfig }
  | null;

function DatabaseConfigsContent({
  configDialog,
  setConfigDialog,
  onAddConfig,
}: {
  configDialog: ConfigDialogState;
  setConfigDialog: (d: ConfigDialogState) => void;
  onAddConfig: () => void;
}) {
  const { data: projects } = useProjects();
  const remove = useDeleteDatabaseConfig();
  const { addNotification } = useNotifications();
  const [configView, setConfigView] = useState<"table" | "grid">("grid");
  const [cfgPage, setCfgPage] = useState(1);
  const [cfgLimit, setCfgLimit] = useState(20);
  const [configDetail, setConfigDetail] = useState<DatabaseConfig | null>(null);
  const [configSearch, setConfigSearch] = useState("");
  const configsPage = useDatabaseConfigsPage({ page: cfgPage, limit: cfgLimit });

  const configGroups = Array.from((projects ?? []).map((p) => ({ id: p.id, name: p.name })));

  const list = configsPage.data?.result ?? [];

  const filteredList = list.filter((c) => {
    const q = configSearch.trim().toLowerCase();
    if (!q) return true;
    return [c.configCode, c.databaseName, c.host, c.environment, c.id].some((v) =>
      v?.toLowerCase().includes(q),
    );
  });

  const onRemoveConfig = (c: DatabaseConfig) => {
    const label = c.configCode ?? shortId(c.id);
    if (!confirm(`Xóa database config "${label}"?`)) return;
    remove.mutate(c.id, {
      onSuccess: () => {
        toast.success(`Đã xóa config ${label}`);
        addNotification(`Đã xóa database config "${label}"`);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-5 py-3">
        <div className="ml-auto flex items-center gap-2">
          <ViewToggle value={configView} onChange={setConfigView} />
          <button
            onClick={onAddConfig}
            className="flex items-center gap-2 border border-[var(--accent-blue)] bg-[var(--accent-blue)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-colors hover:brightness-110"
          >
            Thêm Config
          </button>
        </div>
      </div>

      <div className="flex justify-end px-5 pb-4">
        <div className="relative w-[12.75rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={configSearch}
            onChange={(e) => setConfigSearch(e.target.value)}
            placeholder="Tìm kiếm config..."
            className="w-full border border-[var(--panel-mid)] bg-black/5 py-1.5 pl-8 pr-3 text-xs outline-none transition-colors focus:border-[var(--accent-blue)] placeholder:text-[var(--text-muted)]"
          />
        </div>
      </div>

      {configsPage.data && filteredList.length > 0 ? (
        configView === "grid" ? (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {configGroups.map((g) => {
              const items = filteredList.filter((c) => groupOf(c).key === g.id);
              if (items.length === 0) return null;
              return (
                <Fragment key={g.id}>
                  <div className="col-span-full border-b border-[var(--panel-mid)]/50 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--panel-light)]">
                    <span>{g.name}</span>
                  </div>
                  {items.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setConfigDetail(c)}
                      className="flex min-h-40 cursor-pointer flex-col justify-between gap-3 border border-[var(--panel-mid)] bg-[var(--panel-dark)] p-5 transition-all duration-200 hover:z-10 hover:scale-[1.2] hover:border-[var(--accent-blue)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <EngineLogo engine={c.databaseType} className="h-8 w-8 rounded" />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold">
                              {c.configCode ?? "—"}
                            </div>
                            <div className="mono-nums text-[10px] text-[var(--text-muted)]">
                              {shortId(c.id)}
                            </div>
                          </div>
                        </div>
                        <EnvBadge env={c.environment} />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="mono-nums truncate text-xs text-[var(--text-muted)]">
                          {c.host ?? "—"}
                          {c.port ? `:${c.port}` : ""}
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            title="Sửa"
                            className={actionBtnCls}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfigDialog({ kind: "edit", config: c });
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            title="Xóa"
                            className={actionBtnCls + " hover:text-[var(--accent-red)]"}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveConfig(c);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </Fragment>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--panel-mid)]">
                  <th className={thCls}>Config</th>
                  <th className={thCls}>Engine</th>
                  <th className={thCls}>Host</th>
                  <th className={thCls}>Môi trường</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody>
                {configGroups.map((g) => {
                  const items = filteredList.filter((c) => groupOf(c).key === g.id);
                  if (items.length === 0) return null;
                  return (
                    <Fragment key={g.id}>
                      <tr className="border-b border-[var(--panel-mid)]/50 bg-[var(--panel-mid)]/10">
                        <td
                          colSpan={5}
                          className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--panel-light)]"
                        >
                          {g.name}
                        </td>
                      </tr>
                      {items.map((c) => (
                        <tr
                        key={c.id}
                        className="border-b border-transparent last:border-0 transition-colors hover:border-[var(--panel-mid-40)] hover:bg-[var(--panel-mid-20)]"
                        onClick={() => setConfigDetail(c)}
                        title="Xem chi tiết"
                      >
                          <td className={tdCls + " cursor-pointer"}>
                            <div className="flex items-center gap-2">
                              <EngineLogo engine={c.databaseType} className="h-6 w-6 rounded" />
                              <div>
                                <div className="text-xs">{c.configCode ?? "—"}</div>
                                <div className="mono-nums text-[10px] text-[var(--text-muted)]">
                                  {shortId(c.id)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className={tdCls + " text-xs"}>
                            {c.databaseType === "mongo" ? "MongoDB" : "PostgreSQL"}
                          </td>
                          <td className={tdCls + " mono-nums text-xs"} title={c.host ?? ""}>
                            {c.host ?? "—"}
                            {c.port ? `:${c.port}` : ""}
                          </td>
                          <td className={tdCls}>
                            <EnvBadge env={c.environment} />
                          </td>
                          <td className={tdCls}>
                            <div
                              className="flex gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                title="Sửa"
                                className={actionBtnCls}
                                onClick={() => setConfigDialog({ kind: "edit", config: c })}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                title="Xóa"
                                className={actionBtnCls + " hover:text-[var(--accent-red)]"}
                                onClick={() => onRemoveConfig(c)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="px-5 py-8 text-center text-xs text-[var(--text-muted)]">
          {configsPage.isLoading
            ? "Đang tải..."
            : filteredList.length === 0 && list.length > 0
              ? "Không tìm thấy config nào khớp với từ khóa"
              : 'Chưa có database config nào — bấm "Thêm Config" để tạo (hoặc bạn chưa được cấp quyền xem config nào)'}
        </div>
      )}

      <Pagination
        page={cfgPage}
        totalPages={totalPagesOf(configsPage.data?.total ?? 0, cfgLimit)}
        total={configsPage.data?.total ?? 0}
        limit={cfgLimit}
        onPageChange={setCfgPage}
        onLimitChange={(l) => {
          setCfgLimit(l);
          setCfgPage(1);
        }}
      />

      {configDialog?.kind === "create" && (
        <CreateConfigDialog onClose={() => setConfigDialog(null)} />
      )}
      {configDialog?.kind === "edit" && (
        <EditConfigDialog
          config={configDialog.config}
          onClose={() => setConfigDialog(null)}
        />
      )}
      {configDetail && (
        <ConfigDetailDialog
          config={configDetail}
          projName={projectName(configDetail.projectId, projects ?? [])}
          onClose={() => setConfigDetail(null)}
        />
      )}
    </>
  );
}

export default DatabaseConfigsContent;