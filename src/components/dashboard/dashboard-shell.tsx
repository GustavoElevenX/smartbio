"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CreditCard,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PlanStatusBanner } from "@/components/entitlements/plan-status-banner";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { SupportModeBanner } from "@/components/platform-admin/support-mode-banner";
import { Brand } from "@/components/ui/brand";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { forgetAISetupSession } from "@/features/ai-setup/ai-setup-state";
import { features } from "@/lib/constants";
import { projectRepository } from "@/lib/repositories/project-repository";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface WorkspaceSummary {
  id: string;
  name: string;
  plan: string;
  role: "owner" | "member";
}

interface NavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  disabled?: boolean;
}

const workspaceItems: NavigationItem[] = [
  { href: "/app", label: "Início", icon: LayoutDashboard, exact: true },
  {
    href: "/app/projects",
    label: "Negócios",
    icon: FolderKanban,
    exact: true,
  },
  {
    href: "/app/notifications",
    label: "Notificações",
    icon: Bell,
    exact: true,
  },
];

function roleLabel(role: WorkspaceSummary["role"]) {
  return role === "owner" ? "Proprietário" : "Membro";
}

function planLabel(plan: string) {
  if (plan === "trial") return "Teste grátis";
  if (plan === "free") return "Grátis";
  if (plan === "pro") return "SOBE Pro";
  return plan;
}

function isNavigationItemActive(pathname: string, item: NavigationItem) {
  return pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
}

function SidebarLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavigationItem;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  if (item.disabled) return <span aria-disabled="true" title={`${item.label} indisponível neste plano`} className={cn("flex min-h-11 items-center rounded-xl text-sm font-semibold text-[#8796a6]", collapsed ? "justify-center px-2" : "gap-3 px-3")}><Icon size={18} aria-hidden="true" /><span className={cn(collapsed && "sr-only")}>{item.label}</span></span>;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "focus-ring relative flex min-h-11 items-center rounded-xl text-sm font-semibold transition-colors",
        collapsed ? "justify-center px-2" : "gap-3 px-3",
        active
          ? "bg-[#eaf3ff] text-[#0054fc]"
          : "text-[#536178] hover:bg-[#eef4fa] hover:text-[#07172f]",
      )}
    >
      <Icon size={18} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
      <span className={cn(collapsed && "sr-only")}>{item.label}</span>
      {active ? (
        <span
          className={cn(
            "absolute rounded-full bg-[#0054fc]",
            collapsed
              ? "bottom-1.5 left-1/2 size-1 -translate-x-1/2"
              : "inset-y-2 left-0 w-0.5",
          )}
          aria-hidden="true"
        />
      ) : null}
    </Link>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [user, setUser] = useState({ name: "Você", email: "" });
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [switchingWorkspace, setSwitchingWorkspace] = useState<string>();
  const routeProjectId = pathname.match(/^\/app\/projects\/([^/]+)/)?.[1];
  const projectId = routeProjectId === "new" ? undefined : routeProjectId;
  const [projectName, setProjectName] = useState("");
  const [hasProjects, setHasProjects] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const mobileSidebarRef = useRef<HTMLElement>(null);

  const projectItems: NavigationItem[] = projectId
    ? [
        {
          href: `/app/projects/${projectId}`,
          label: "Início",
          icon: LayoutDashboard,
          exact: true,
        },
        {
          href: `/app/projects/${projectId}/opportunities`,
          label: "Oportunidades",
          icon: BriefcaseBusiness,
        },
        {
          href: `/app/projects/${projectId}/activations`,
          label: "Campanhas",
          icon: Zap,
          disabled: !features.activations,
        },
        {
          href: `/app/projects/${projectId}/minha-sobe`,
          label: "Minha SOBE",
          icon: FolderKanban,
        },
        {
          href: `/app/projects/${projectId}/settings`,
          label: "Configurações",
          icon: Settings,
        },
      ]
    : [];

  useEffect(() => {
    setDesktopCollapsed(
      window.localStorage.getItem("sobe:sidebar-collapsed") === "true",
    );
    void fetch("/api/account/profile")
      .then((response) => response.json())
      .then((payload: { data?: { full_name?: string; email?: string } }) => {
        if (payload.data) {
          setUser({
            name: payload.data.full_name || payload.data.email || "Você",
            email: payload.data.email || "",
          });
        }
      });
    void fetch("/api/workspaces")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Não foi possível carregar seus espaços de trabalho.");
        }
        const payload = (await response.json()) as {
          data?: { activeWorkspaceId: string; workspaces: WorkspaceSummary[] };
        };
        setActiveWorkspaceId(payload.data?.activeWorkspaceId || "");
        setWorkspaces(payload.data?.workspaces || []);
      })
      .catch(() =>
        setWorkspaceError("Não foi possível carregar seus espaços de trabalho."),
      )
      .finally(() => setWorkspacesLoading(false));
    void projectRepository
      .getProjects()
      .then((projects) => setHasProjects(projects.length > 0))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!projectId) {
      setProjectName("");
      return;
    }
    void projectRepository
      .getProject(projectId)
      .then((project) => setProjectName(project?.name || "Negócio"))
      .catch(() => setProjectName("Negócio"));
  }, [projectId]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileCloseButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
        return;
      }
      if (event.key === "Tab") {
        const focusable = mobileSidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  useEffect(() => {
    const desktopMedia = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktopMedia.matches) setMobileOpen(false);
    };
    desktopMedia.addEventListener("change", closeOnDesktop);
    return () => desktopMedia.removeEventListener("change", closeOnDesktop);
  }, []);

  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ||
    workspaces[0];
  const activeItem = [...projectItems, ...workspaceItems].find((item) =>
    isNavigationItemActive(pathname, item),
  );
  const legacyPageLabel = pathname.endsWith("/analytics") ? "Resultados" : pathname.endsWith("/content") ? "Conteúdo" : pathname.endsWith("/visuals") ? "Artes com IA" : pathname.endsWith("/editor") ? "Editor avançado" : undefined;
  const settingsActive =
    pathname.startsWith("/app/settings") &&
    !pathname.startsWith("/app/settings/billing");
  const billingActive = pathname.startsWith("/app/settings/billing");
  const currentPageLabel =
    pathname === "/app/projects/new"
      ? "Novo negócio"
      : pathname.startsWith("/app/onboarding")
        ? "Criar minha Sobe"
        : legacyPageLabel || activeItem?.label ||
          (billingActive
            ? "Plano e cobrança"
            : settingsActive
              ? "Configurações"
              : "Visão geral");

  function closeMobileMenu() {
    window.setTimeout(() => setMobileOpen(false), 0);
  }

  function toggleDesktopSidebar() {
    setDesktopCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("sobe:sidebar-collapsed", String(next));
      return next;
    });
  }

  async function switchWorkspace(workspaceId: string) {
    if (workspaceId === activeWorkspaceId) return;
    setWorkspaceError("");
    setSwitchingWorkspace(workspaceId);
    try {
      const response = await fetch("/api/workspaces/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!response.ok) {
        throw new Error("Não foi possível trocar de espaço de trabalho.");
      }
      forgetAISetupSession();
      setActiveWorkspaceId(workspaceId);
      closeMobileMenu();
      router.push("/app");
      router.refresh();
    } catch {
      setWorkspaceError(
        "Não foi possível trocar agora. Tente novamente em alguns instantes.",
      );
    } finally {
      setSwitchingWorkspace(undefined);
    }
  }

  async function logout() {
    forgetAISetupSession();
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/");
  }

  function renderSidebar({
    collapsed,
    mobile,
  }: {
    collapsed: boolean;
    mobile: boolean;
  }) {
    return (
      <>
        <div
          className={cn(
            "flex h-[73px] shrink-0 items-center border-b border-[#e5eaf0]",
            collapsed ? "justify-between px-1" : "justify-between px-4",
          )}
        >
          <Link
            href="/app"
            className="focus-ring inline-flex rounded-lg"
            aria-label="SOBE, ir para o início"
            onClick={closeMobileMenu}
          >
            <Brand compact={collapsed} asLink={false} size={collapsed ? "sm" : "md"} />
          </Link>
          {mobile ? (
            <button
              ref={mobileCloseButtonRef}
              type="button"
              onClick={() => {
                closeMobileMenu();
                window.requestAnimationFrame(() =>
                  mobileMenuButtonRef.current?.focus(),
                );
              }}
              className="focus-ring grid size-11 place-items-center rounded-xl text-[#536178] hover:bg-[#eef4fa] hover:text-[#07172f]"
              aria-label="Fechar menu"
            >
              <X size={20} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleDesktopSidebar}
              className="focus-ring grid size-11 shrink-0 place-items-center rounded-xl text-[#667487] hover:bg-[#eef4fa] hover:text-[#07172f]"
              aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? (
                <PanelLeftOpen size={18} aria-hidden="true" />
              ) : (
                <PanelLeftClose size={18} aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        <div className={cn("shrink-0", collapsed ? "px-3 py-4" : "p-3")}>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "focus-ring flex w-full items-center border border-[#dfe6ee] bg-white text-left shadow-[0_5px_18px_rgba(7,23,47,.05)] transition-colors hover:border-[#bfd0e1] hover:bg-[#fbfdff]",
                  collapsed
                    ? "justify-center rounded-xl p-2"
                    : "gap-3 rounded-[14px] p-3",
                )}
                aria-label={
                  collapsed
                    ? `Trocar espaço de trabalho. Atual: ${activeWorkspace?.name || "Meu espaço"}`
                    : undefined
                }
                title={collapsed ? activeWorkspace?.name || "Meu espaço" : undefined}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e9fffc] text-xs font-extrabold text-[#0054fc]">
                  {activeWorkspace?.name.slice(0, 2).toUpperCase() || "SB"}
                </span>
                {!collapsed ? (
                  <>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-[#07172f]">
                        {activeWorkspace?.name || "Meu espaço"}
                      </strong>
                      <small className="mt-0.5 block truncate text-[#667487]">
                        {planLabel(activeWorkspace?.plan || "trial")} ·{" "}
                        {roleLabel(activeWorkspace?.role || "owner")}
                      </small>
                    </span>
                    <ChevronDown size={15} className="shrink-0 text-[#78889a]" aria-hidden="true" />
                  </>
                ) : null}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side={collapsed ? "right" : "bottom"}
              sideOffset={collapsed ? 12 : 6}
              className="w-[280px] rounded-[14px] border-[#dfe6ee] p-2 shadow-[0_18px_45px_rgba(7,23,47,.16)]"
            >
              <div className="px-2 pb-2 pt-1">
                <p className="text-sm font-extrabold text-[#07172f]">Seus espaços de trabalho</p>
                <p className="mt-0.5 text-xs text-[#667487]">Escolha onde deseja trabalhar.</p>
              </div>
              <div className="flex flex-col gap-1">
                {workspacesLoading ? (
                  <div className="flex min-h-14 items-center gap-2 px-2.5 text-xs font-semibold text-[#667487]">
                    <Loader2 className="size-4 animate-spin text-[#0054fc]" aria-hidden="true" />
                    Carregando espaços…
                  </div>
                ) : null}
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    type="button"
                    disabled={Boolean(switchingWorkspace)}
                    onClick={() => void switchWorkspace(workspace.id)}
                    className={cn(
                      "focus-ring flex min-h-12 items-center gap-3 rounded-xl px-2.5 text-left text-sm transition-colors hover:bg-[#eef4fa]",
                      workspace.id === activeWorkspaceId && "bg-[#f4f8ff]",
                    )}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#eaf3ff] text-[11px] font-extrabold text-[#0054fc]">
                      {workspace.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[#07172f]">{workspace.name}</strong>
                      <small className="text-[#667487]">
                        {roleLabel(workspace.role)} · {planLabel(workspace.plan)}
                      </small>
                    </span>
                    {switchingWorkspace === workspace.id ? (
                      <Loader2 className="size-4 animate-spin text-[#0054fc]" aria-label="Trocando espaço de trabalho" />
                    ) : workspace.id === activeWorkspaceId ? (
                      <Check className="size-4 text-[#0054fc]" aria-label="Espaço de trabalho atual" />
                    ) : null}
                  </button>
                ))}
              </div>
              {workspaceError ? (
                <p role="alert" className="mx-2 mt-2 text-xs font-semibold leading-5 text-[#b42318]">
                  {workspaceError}
                </p>
              ) : null}
              <Link
                href="/app/settings/workspace"
                onClick={closeMobileMenu}
                className="focus-ring mt-2 flex min-h-11 items-center rounded-xl border-t border-[#e5eaf0] px-2.5 pt-2 text-xs font-bold text-[#0054fc] hover:text-[#0048d9]"
              >
                Gerenciar espaços de trabalho
              </Link>
            </PopoverContent>
          </Popover>
        </div>

        <nav
          aria-label="Navegação principal"
          className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-3"
        >
          {!collapsed ? (
            <p className="px-3 pb-2 pt-1 text-[11px] font-extrabold uppercase tracking-[.12em] text-[#8796a6]">
              Geral
            </p>
          ) : null}
          <div className="space-y-1">
            {workspaceItems.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                active={isNavigationItemActive(pathname, item)}
                collapsed={collapsed}
                onNavigate={closeMobileMenu}
              />
            ))}
          </div>

          {projectId ? (
            <div className="mt-4 border-t border-[#e5eaf0] pt-4">
              {!collapsed ? (
                <div className="px-3 pb-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#8796a6]">
                    Negócio
                  </span>
                  <strong className="mt-1 block truncate text-sm text-[#07172f]">
                    {projectName || "Carregando…"}
                  </strong>
                </div>
              ) : null}
              <div className="space-y-1">
                {projectItems.map((item) => (
                  <SidebarLink
                    key={item.href}
                    item={item}
                    active={isNavigationItemActive(pathname, item)}
                    collapsed={collapsed}
                    onNavigate={closeMobileMenu}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-1 border-t border-[#e5eaf0] pt-4">
            <SidebarLink
              item={{ href: "/app/settings/profile", label: "Configurações", icon: Settings }}
              active={settingsActive}
              collapsed={collapsed}
              onNavigate={closeMobileMenu}
            />
            <SidebarLink
              item={{ href: "/app/settings/billing", label: "Plano e cobrança", icon: CreditCard }}
              active={billingActive}
              collapsed={collapsed}
              onNavigate={closeMobileMenu}
            />
          </div>
        </nav>

        <div className="shrink-0 border-t border-[#e5eaf0] p-3">
          <Link
            href="/app/onboarding"
            onClick={closeMobileMenu}
            aria-label={collapsed ? "Central de ajuda" : undefined}
            title={collapsed ? "Central de ajuda" : undefined}
            className={cn(
              "focus-ring flex min-h-11 items-center rounded-xl text-[#536178] transition-colors hover:bg-[#eef4fa] hover:text-[#07172f]",
              collapsed ? "justify-center px-2" : "gap-3 px-3",
            )}
          >
            <HelpCircle size={18} className="shrink-0 text-[#0054fc]" aria-hidden="true" />
            {!collapsed ? (
              <span>
                <strong className="block text-sm">Central de ajuda</strong>
                <small className="block text-[#78889a]">Consulte o guia da SOBE</small>
              </span>
            ) : null}
          </Link>

          <div
            className={cn(
              "mt-2 flex items-center rounded-xl bg-white",
              collapsed ? "flex-col gap-1 p-1.5" : "gap-2 border border-[#e5eaf0] p-2",
            )}
          >
            <Link
              href="/app/settings/profile"
              onClick={closeMobileMenu}
              className={cn(
                "focus-ring flex min-h-11 min-w-0 items-center rounded-lg",
                collapsed ? "justify-center" : "flex-1 gap-2",
              )}
              aria-label={collapsed ? `Perfil de ${user.name}` : undefined}
              title={collapsed ? user.name : undefined}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eaf3ff] text-xs font-extrabold text-[#0054fc]">
                {user.name.slice(0, 2).toUpperCase()}
              </span>
              {!collapsed ? (
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-xs text-[#34343a]">{user.name}</strong>
                  {user.email ? (
                    <small className="block truncate text-[#78889a]">{user.email}</small>
                  ) : (
                    <small className="block text-[#78889a]">Ver perfil</small>
                  )}
                </span>
              ) : null}
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="focus-ring grid size-11 shrink-0 place-items-center rounded-lg text-[#78889a] hover:bg-[#fff0f0] hover:text-[#b42318]"
              aria-label="Sair da conta"
              title="Sair da conta"
            >
              <LogOut size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-[#dfe6ee] bg-[#fbfcfd] transition-[width] duration-200 lg:flex",
          desktopCollapsed ? "w-[84px]" : "w-[272px]",
        )}
        aria-label="Menu lateral"
      >
        {renderSidebar({ collapsed: desktopCollapsed, mobile: false })}
      </aside>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-50 bg-[#07172f]/35 lg:hidden"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              closeMobileMenu();
              window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
            }
          }}
        >
          <aside
            ref={mobileSidebarRef}
            id="dashboard-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
            className="dashboard-sidebar-enter flex h-full w-[min(320px,calc(100vw-32px))] flex-col bg-[#fbfcfd] shadow-[18px_0_50px_rgba(7,23,47,.18)]"
          >
            {renderSidebar({ collapsed: false, mobile: true })}
          </aside>
        </div>
      ) : null}

      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 flex h-[73px] items-center justify-between border-b border-[#dfe6ee] bg-white/95 px-4 backdrop-blur-xl transition-[left] duration-200 lg:px-7",
          desktopCollapsed ? "lg:left-[84px]" : "lg:left-[272px]",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            ref={mobileMenuButtonRef}
            type="button"
            onClick={() => setMobileOpen(true)}
            className="focus-ring grid size-11 shrink-0 place-items-center rounded-xl text-[#536178] hover:bg-[#eef4fa] hover:text-[#07172f] lg:hidden"
            aria-label="Abrir menu"
            aria-expanded={mobileOpen}
            aria-controls="dashboard-mobile-menu"
          >
            <Menu size={21} aria-hidden="true" />
          </button>
          <div className="lg:hidden">
            <Brand size="sm" />
          </div>
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-xs font-semibold text-[#78889a]">
              {projectId ? projectName || "Negócio" : activeWorkspace?.name || "Meu espaço"}
            </p>
            <p className="truncate text-sm font-extrabold text-[#07172f]">
              {currentPageLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Link
            href={hasProjects ? "/app/projects/new" : "/app/onboarding"}
            aria-label={hasProjects ? "Novo negócio" : "Criar minha Sobe"}
            className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-[#0054fc] px-3 text-sm font-bold text-white shadow-[0_8px_22px_rgba(0,84,252,.2)] transition-colors hover:bg-[#0048d9] sm:px-4"
          >
            <span className="sm:hidden">Criar</span>
            <span className="hidden sm:inline">{hasProjects ? "Novo negócio" : "Criar minha Sobe"}</span>
          </Link>
        </div>
      </header>

      <main
        className={cn(
          "min-h-screen pt-[73px] transition-[padding-left] duration-200",
          desktopCollapsed ? "lg:pl-[84px]" : "lg:pl-[272px]",
        )}
      >
        <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
          <SupportModeBanner />
          <PlanStatusBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
