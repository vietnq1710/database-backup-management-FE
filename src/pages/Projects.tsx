import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import AuthLayout from "@/components/AuthLayout";
import { PageHeader, ViewToggle } from "@/components/common";
import { Pagination } from "@/components/Pagination";
import {
  useDatabaseConfigsPage,
  useProjectsPage,
  useCreateProject,
  useDeleteProject,
  useUpdateProject,
} from "@/api/hooks";
import { shortId, totalPagesOf } from "@/lib/format";
import type { Project } from "@/types/api";
import {
  Database,
  Loader2,
  Pencil,
  Search,
  ServerCog,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "@/components/NotificationProvider";
import DatabaseConfigsContent, {
  type ConfigDialogState,
} from "./DatabaseConfigs";

const inputCls =
  "w-full border border-[var(--panel-mid)] bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-blue)] placeholder:text-[var(--text-muted)]";
const submitBtnCls =
  "flex w-full items-center justify-center gap-2 border border-[var(--foreground)] bg-[var(--foreground)] py-2.5 text-[11px] font-black uppercase tracking-[0.25em] text-[var(--background)] transition-all hover:bg-transparent hover:text-[var(--foreground)] disabled:opacity-50";
const thCls =
  "px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)] whitespace-nowrap";
const tdCls = "px-4 py-2.5 align-middle";
const actionBtnCls =
  "p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--panel-mid-40)] hover:text-[var(--foreground)]";

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
    <p className="mb-4 border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
      {message}
    </p>
  );
}

// POST /projects — entity chỉ có _id + name (unique)
function CreateProjectDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateProject();
  const { addNotification } = useNotifications();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          toast.success("Đã tạo project");
          addNotification(`Đã tạo project "${name.trim()}"`);
          onClose();
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="panel w-full max-w-md p-6">
        <DialogHeader title="Tạo Project" onClose={onClose} />

        <label className="panel-label mb-1.5 block">Tên project</label>
        <input
          className={inputCls + " mb-4"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="banking-core"
        />

        <ErrorBox message={error} />

        <button type="submit" disabled={create.isPending} className={submitBtnCls}>
          {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Tạo project
        </button>
      </form>
    </div>
  );
}

// PUT /projects/:id — PartialType(entity), chỉ gửi trường đổi (name)
function EditProjectDialog({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateProject();
  const { addNotification } = useNotifications();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim() === project.name) return setError("Không có thay đổi nào");
    update.mutate(
      { id: project.id, payload: { name: name.trim() } },
      {
        onSuccess: () => {
          toast.success("Đã cập nhật project");
          addNotification(`Đã cập nhật project "${name.trim()}"`);
          onClose();
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="panel w-full max-w-md p-6">
        <DialogHeader title="Sửa Project" onClose={onClose} />
        <p className="mono-nums mb-4 text-[10px] text-[var(--text-muted)]">
          id: {project.id}
        </p>

        <label className="panel-label mb-1.5 block">Tên project</label>
        <input
          className={inputCls + " mb-4"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
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

function ProjectsContent() {
  const remove = useDeleteProject();
  const { addNotification } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "configs" ? "configs" : "projects";
  const setTab = (t: "projects" | "configs") => setSearchParams({ tab: t });
  const [projectDialog, setProjectDialog] = useState<
    | { kind: "create" }
    | { kind: "edit"; project: Project }
    | null
  >(null);
  const [projectView, setProjectView] = useState<"table" | "grid">("grid");
  const [configDialog, setConfigDialog] = useState<ConfigDialogState>(null);
  const [projSearch, setProjSearch] = useState("");

  const [projPage, setProjPage] = useState(1);
  const [projLimit, setProjLimit] = useState(20);
  const projectsPage = useProjectsPage({ page: projPage, limit: projLimit });
  const configsPage = useDatabaseConfigsPage({ page: 1, limit: 20 });

  const filteredProjects = (projectsPage.data?.result ?? []).filter((p) =>
    p.name.toLowerCase().includes(projSearch.trim().toLowerCase()),
  );

  const onRemoveProject = (p: Project) => {
    if (!confirm(`Xóa project "${p.name}"?`)) return;
    remove.mutate(p.id, {
      onSuccess: () => {
        toast.success(`Đã xóa project ${p.name}`);
        addNotification(`Đã xóa project "${p.name}"`);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <>
      <PageHeader title="Cấu hình" />

      <div className="flex border-b border-[var(--panel-mid)]">
        {(
          [
            {
              key: "projects",
              label: "Projects",
              icon: ServerCog,
              count: projectsPage.data?.total ?? 0,
            },
            {
              key: "configs",
              label: "Database Configs",
              icon: Database,
              count: configsPage.data?.total ?? 0,
            },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "flex items-center gap-2 px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-colors " +
              (tab === t.key
                ? "border-b-2 border-[var(--accent-blue)] text-[var(--foreground)]"
                : "border-b-2 border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]")
            }
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            <span className="mono-nums border border-[var(--panel-mid)] px-1.5 text-[10px]">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === "projects" ? (
        <>
          <div className="flex items-center justify-between gap-2 px-5 py-3">
            <div className="ml-auto flex items-center gap-2">
              <ViewToggle value={projectView} onChange={setProjectView} />
              <button
                onClick={() => setProjectDialog({ kind: "create" })}
                className="flex items-center gap-2 border border-[var(--accent-blue)] bg-[var(--accent-blue)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-colors hover:brightness-110"
              >
                Thêm Project
              </button>
            </div>
          </div>

          <div className="flex justify-end px-5 pb-4">
            <div className="relative w-[13.25rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={projSearch}
                onChange={(e) => setProjSearch(e.target.value)}
                placeholder="Tìm kiếm project..."
                className="w-full border border-[var(--panel-mid)] bg-black/5 py-1.5 pl-8 pr-3 text-xs outline-none transition-colors focus:border-[var(--accent-blue)] placeholder:text-[var(--text-muted)]"
              />
            </div>
          </div>

          {projectsPage.data && projectsPage.data.result.length > 0 ? (
            projectView === "grid" ? (
              <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredProjects.map((p) => (
                  <div
                    key={p.id}
                    className="flex min-h-40 flex-col justify-between gap-3 border border-[var(--panel-mid)] bg-[var(--panel-dark)] p-5 transition-all duration-200 hover:border-[var(--accent-blue)]"
                  >
                    <div>
                      <div className="truncate text-sm font-bold" title={p.id}>
                        {p.name}
                      </div>
                      <div className="mono-nums mt-1 text-[10px] text-[var(--text-muted)]">
                        {shortId(p.id)}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        title="Sửa"
                        className={actionBtnCls}
                        onClick={() => setProjectDialog({ kind: "edit", project: p })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="Xóa"
                        className={actionBtnCls + " hover:text-[var(--accent-red)]"}
                        onClick={() => onRemoveProject(p)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--panel-mid)]">
                      <th className={thCls}>Project</th>
                      <th className={thCls}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-transparent last:border-0 transition-colors hover:border-[var(--panel-mid-40)] hover:bg-[var(--panel-mid-20)]"
                        title={`id: ${p.id}`}
                      >
                        <td className={tdCls}>
                        <div className="text-xs font-bold">{p.name}</div>
                        <div className="mono-nums text-[10px] text-[var(--text-muted)]">
                          {shortId(p.id)}
                        </div>
                      </td>
                        <td className={tdCls}>
                          <div className="flex gap-1.5">
                            <button
                              title="Sửa"
                              className={actionBtnCls}
                              onClick={() => setProjectDialog({ kind: "edit", project: p })}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              title="Xóa"
                              className={actionBtnCls + " hover:text-[var(--accent-red)]"}
                              onClick={() => onRemoveProject(p)}
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
            )
          ) : (
            <div className="px-5 py-8 text-center text-xs text-[var(--text-muted)]">
              {projectsPage.isLoading
                ? "Đang tải..."
                : 'Chưa có project nào — bấm "Thêm Project" để tạo (hoặc bạn chưa được cấp quyền xem project nào)'}
            </div>
          )}
          <Pagination
            page={projPage}
            totalPages={totalPagesOf(projectsPage.data?.total ?? 0, projLimit)}
            total={projectsPage.data?.total ?? 0}
            limit={projLimit}
            onPageChange={setProjPage}
            onLimitChange={(l) => {
              setProjLimit(l);
              setProjPage(1);
            }}
          />
        </>
      ) : (
        <DatabaseConfigsContent
          configDialog={configDialog}
          setConfigDialog={setConfigDialog}
          onAddConfig={() => setConfigDialog({ kind: "create" })}
        />
      )}

      {projectDialog?.kind === "create" && (
        <CreateProjectDialog onClose={() => setProjectDialog(null)} />
      )}
      {projectDialog?.kind === "edit" && (
        <EditProjectDialog
          project={projectDialog.project}
          onClose={() => setProjectDialog(null)}
        />
      )}
    </>
  );
}

export default function Projects() {
  return (
    <AuthLayout>
      <ProjectsContent />
    </AuthLayout>
  );
}