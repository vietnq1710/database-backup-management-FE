import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOGIN_PATH } from "@/const";
import { useMyPermissionsView, useCompletionNotifications } from "@/api/hooks";
import {
  DatabaseBackup,
  History,
  LayoutDashboard,
  LogOut,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import { type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { AuthLayoutSkeleton } from "./AuthLayoutSkeleton";
import { Button } from "./ui/button";
import { NotificationProvider } from "./NotificationProvider";
import { useNotifications } from "./NotificationProvider";
import { NotificationBell } from "./NotificationBell";

type MenuItem = {
  icon: typeof ShieldCheck;
  label: string;
  path: string;
  requiresPermissionManager?: boolean;
};

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: ServerCog, label: "Servers & Configs", path: "/servers" },
  { icon: DatabaseBackup, label: "Quản lý Job", path: "/jobs" },
  { icon: History, label: "Backup History", path: "/history" },
  {
    icon: ShieldCheck,
    label: "Phân quyền",
    path: "/permissions",
    requiresPermissionManager: true,
  },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { isLoading, user } = useAuth();

  if (isLoading) return <AuthLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex w-full max-w-md flex-col items-center gap-8 p-8">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-center text-2xl font-black uppercase tracking-tight">
              Đăng nhập để tiếp tục
            </h1>
            <p className="max-w-sm text-center text-sm text-[var(--text-muted)]">
              Khu vực quản trị hệ thống backup yêu cầu xác thực tài khoản.
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = LOGIN_PATH; }}
            size="lg"
            className="w-full shadow-lg transition-all hover:shadow-xl"
          >
            Đăng nhập
          </Button>
        </div>
      </div>
    );
  }

  return (
    <NotificationProvider>
      <AuthLayoutInner>{children}</AuthLayoutInner>
    </NotificationProvider>
  );
}

function AuthLayoutInner({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { canManage: canManagePermissions, resolving } = useMyPermissionsView();
  const { addNotification } = useNotifications();
  useCompletionNotifications(addNotification);

  const visibleItems = menuItems.filter(
    (item) => !item.requiresPermissionManager || (!resolving && canManagePermissions),
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Top Navbar ── */}
      <header className="sticky top-0 z-50 flex h-14 items-center border-b border-[var(--panel-mid)] bg-[var(--panel-dark)]/95 px-5 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
        {/* Brand */}
        <span className="mr-8 text-[11px] font-black uppercase tracking-[0.25em] text-[var(--panel-light)]">
          Backup Manager
        </span>

        {/* Navigation links */}
        <nav className="flex items-center gap-1">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors ${
                  isActive
                    ? "bg-white text-[var(--panel-dark)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--panel-mid)]/50 hover:text-white"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Spacer + Notification + User */}
        <div className="ml-auto flex items-center gap-1">
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-[var(--panel-mid)]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-7 w-7 border border-[var(--panel-mid)]">
                  <AvatarFallback className="text-[10px] font-medium">
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-xs text-[var(--panel-light)] md:inline">
                  {user?.name}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Page Content ── */}
      <main className="flex-1 p-5 lg:p-8">
        <div className="mx-auto w-full max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
