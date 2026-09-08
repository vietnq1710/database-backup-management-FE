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
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { AuthLayoutSkeleton } from "./AuthLayoutSkeleton";
import { NotificationProvider } from "./NotificationProvider";
import { useNotifications } from "./NotificationProvider";
import { NotificationBell } from "./NotificationBell";
import { ModeToggle } from "./ModeToggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  useSidebar,
} from "./ui/sidebar";

type MenuItem = {
  icon: typeof ShieldCheck;
  label: string;
  path: string;
  requiresPermissionManager?: boolean;
};

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Trang chủ", path: "/" },
  { icon: DatabaseBackup, label: "Quản lý", path: "/jobs" },
  { icon: ServerCog, label: "Cấu hình", path: "/projects" },
  {
    icon: ShieldCheck,
    label: "Phân quyền",
    path: "/permissions",
    requiresPermissionManager: true,
  },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { isLoading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate(LOGIN_PATH, { replace: true });
  }, [user, navigate]);

  if (isLoading || !user) return <AuthLayoutSkeleton />;

  return (
    <NotificationProvider>
      <SidebarProvider>
        <AuthLayoutInner>{children}</AuthLayoutInner>
      </SidebarProvider>
    </NotificationProvider>
  );
}

function SidebarToggleButon() {
  const { state, toggleSidebar } = useSidebar();

  return (
    <SidebarMenuButton
      onClick={toggleSidebar}
      tooltip={state === "collapsed" ? "Mở rộng" : "Thu gọn"}
      className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--sidebar-foreground)]"
    >
      <PanelLeftClose className="h-4 w-4" />
      <span className="group-data-[collapsible=icon]:hidden">
        {state === "collapsed" ? "Menu" : "Thu gọn"}
      </span>
    </SidebarMenuButton>
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
    <div className="flex min-h-svh w-full flex-col">
      {/* ── Full-width Top Navbar ── */}
      <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center border-b border-[var(--panel-mid)] bg-[var(--panel-dark)]/95 px-5 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
        {/* Brand */}
        <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[var(--panel-light)]">
          Backup Manager
        </span>

        {/* Spacer + Notification + User */}
        <div className="ml-auto flex items-center gap-1">
          <ModeToggle />
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

      {/* ── Body: Sidebar + Content ── */}
      <div className="flex min-h-0 flex-1 w-full overflow-hidden">
        <Sidebar collapsible="icon" className="top-14 h-[calc(100vh-3.5rem)]">
          <SidebarContent className="pt-6">
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      onClick={() => navigate(item.path)}
                      className={`text-[12px] font-bold uppercase tracking-[0.12em] ${
                        isActive ? "text-[var(--sidebar-accent-foreground)]" : ""
                      }`}
                    >
                      <button>
                        <item.icon className="h-4 w-4" />
                        <span className="group-data-[collapsible=icon]:hidden">
                          {item.label}
                        </span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarToggleButon />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          {/* ── Page Content ── */}
          <main className="flex-1 p-5 lg:p-8">
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </main>
        </SidebarInset>
      </div>
    </div>
  );
}
