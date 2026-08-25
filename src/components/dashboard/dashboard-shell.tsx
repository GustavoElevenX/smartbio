"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CreditCard,
  FolderKanban,
  Globe2,
  HelpCircle,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Settings,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Brand } from "@/components/ui/brand";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { features } from "@/lib/constants";
import { SupportModeBanner } from "@/components/platform-admin/support-mode-banner";
import { PlanStatusBanner } from "@/components/entitlements/plan-status-banner";
import { projectRepository } from "@/lib/repositories/project-repository";
import { forgetAISetupSession } from "@/features/ai-setup/ai-setup-state";

interface WorkspaceSummary {
  id: string;
  name: string;
  plan: string;
  role: "owner" | "member";
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState({ name: "Você", email: "" });
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [switchingWorkspace, setSwitchingWorkspace] = useState<string>();
  const projectId = pathname.match(/^\/app\/projects\/([^/]+)/)?.[1];
  const [projectName, setProjectName] = useState("");
  const [hasProjects, setHasProjects] = useState(false);
  const workspaceItems = [
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
  const projectItems = projectId
      ? [
          {
            href: `/app/projects/${projectId}`,
            label: "Visão geral",
            icon: LayoutDashboard,
            exact: true,
          },
          ...(features.presence
            ? [
                {
                  href: `/app/projects/${projectId}/site`,
                  label: "Minha página",
                  icon: Globe2,
                },
              ]
            : []),
          {
            href: `/app/projects/${projectId}/opportunities`,
            label: "Leads",
            icon: BriefcaseBusiness,
          },
          {
            href: `/app/projects/${projectId}/analytics`,
            label: "Resultados",
            icon: BarChart3,
          },
          ...(features.activations
            ? [
                {
                  href: `/app/projects/${projectId}/activations`,
                  label: "Campanhas",
                  icon: Zap,
                },
              ]
            : []),
          {
            href: `/app/projects/${projectId}/settings`,
            label: "Configurações do negócio",
            icon: Settings,
          },
        ]
      : [];
  useEffect(() => {
    void fetch("/api/account/profile")
      .then((response) => response.json())
      .then((payload: { data?: { full_name?: string; email?: string } }) => {
        if (payload.data)
          setUser({
            name: payload.data.full_name || payload.data.email || "Você",
            email: payload.data.email || "",
          });
      });
    void fetch("/api/workspaces").then(async (response) => {
      if (!response.ok) return;
      const payload = (await response.json()) as {
        data?: { activeWorkspaceId: string; workspaces: WorkspaceSummary[] };
      };
      setActiveWorkspaceId(payload.data?.activeWorkspaceId || "");
      setWorkspaces(payload.data?.workspaces || []);
    });
    void projectRepository.getProjects().then((projects) => setHasProjects(projects.length > 0)).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!projectId) { setProjectName(""); return; }
    void projectRepository.getProject(projectId).then((project) => setProjectName(project?.name || "Negócio")).catch(() => setProjectName("Negócio"));
  }, [projectId]);
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ||
    workspaces[0];
  async function switchWorkspace(workspaceId: string) {
    if (workspaceId === activeWorkspaceId) return;
    setSwitchingWorkspace(workspaceId);
    try {
      const response = await fetch("/api/workspaces/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!response.ok)
        throw new Error("Não foi possível trocar de workspace.");
      forgetAISetupSession();
      setActiveWorkspaceId(workspaceId);
      setOpen(false);
      router.push("/app");
      router.refresh();
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
  const sidebar = (
    <>
      <div className="flex h-[73px] items-center justify-between border-b border-[#e8e7ee] px-5">
        <Brand />
        <button
          onClick={() => setOpen(false)}
          className="focus-ring rounded-lg p-2 lg:hidden"
          aria-label="Fechar menu"
        >
          <X size={20} />
        </button>
      </div>
      <div className="p-3">
        <Popover>
          <PopoverTrigger asChild>
            <button className="focus-ring flex w-full items-center gap-3 rounded-xl border border-[#dfe6ee] bg-white p-3 text-left shadow-sm">
              <span className="grid size-8 place-items-center rounded-lg bg-[#e9fffc] text-xs font-extrabold text-[#0054fc]">
                {activeWorkspace?.name.slice(0, 2).toUpperCase() || "SB"}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm">
                  {activeWorkspace?.name || "Meu workspace"}
                </strong>
                <small className="block text-[#85858e]">
                  {activeWorkspace?.plan === "trial" ? "Teste grátis" : "SOBE Pro"} ·{" "}
                  {activeWorkspace?.role === "owner" ? "Owner" : "Membro"}
                </small>
              </span>
              <ChevronDown size={15} className="text-[#888892]" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[226px] p-2">
            <p className="px-2 py-1 text-xs font-bold text-muted-foreground">
              Trocar workspace
            </p>
            <div className="flex flex-col gap-1">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  disabled={Boolean(switchingWorkspace)}
                  onClick={() => void switchWorkspace(workspace.id)}
                  className="focus-ring flex min-h-11 items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-muted"
                >
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate">{workspace.name}</strong>
                    <small className="text-muted-foreground">
                      {workspace.role === "owner" ? "Owner" : "Membro"} ·{" "}
                      {workspace.plan}
                    </small>
                  </span>
                  {switchingWorkspace === workspace.id ? (
                    <Loader2 className="animate-spin" />
                  ) : workspace.id === activeWorkspaceId ? (
                    <Check />
                  ) : null}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {workspaceItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "focus-ring flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition",
                active
                  ? "bg-[#eaf3ff] text-[#0054fc]"
                  : "text-[#536178] hover:bg-[#eef4fa] hover:text-[#07172f]",
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
        {projectId ? <><div className="my-3 h-px bg-[#dfe6ee]" /><div className="px-3 pb-2 pt-1"><span className="text-xs font-extrabold uppercase tracking-[.12em] text-[#8796a6]">Negócio</span><strong className="mt-1 block truncate text-sm text-[#07172f]">{projectName || "Carregando…"}</strong></div>{projectItems.map((item) => { const active = item.exact ? pathname === item.href : pathname.startsWith(item.href); const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={cn("focus-ring flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition", active ? "bg-[#eaf3ff] text-[#0054fc]" : "text-[#536178] hover:bg-[#eef4fa] hover:text-[#07172f]")}><Icon size={18} />{item.label}</Link>; })}</> : null}
        <div className="my-3 h-px bg-[#e7e6ed]" />
        <Link
          href="/app/settings/profile"
          className={cn(
            "focus-ring flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold",
            pathname.startsWith("/app/settings")
              ? "bg-[#eaf3ff] text-[#0054fc]"
              : "text-[#536178] hover:bg-[#eef4fa]",
          )}
        >
          <Settings size={18} />
          Configurações
        </Link>
        <Link
          href="/app/settings/billing"
          className="focus-ring flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#536178] hover:bg-[#eef4fa]"
        >
          <CreditCard size={18} />
          Plano e cobrança
        </Link>
      </nav>
      <div className="p-3">
        <div className="relative overflow-hidden rounded-[18px] bg-[#07172f] p-4 text-white">
          <div className="sobe-gradient-rule absolute inset-x-0 top-0" />
          <HelpCircle size={19} className="text-[#02e5cd]" />
          <strong className="mt-5 block text-sm">Precisa de ajuda?</strong>
          <p className="mt-1 text-xs leading-5 text-white/55">
            Consulte o guia de configuração.
          </p>
          <Link
            href="/app/onboarding"
            className="mt-3 inline-flex text-xs font-bold text-[#01d2df]"
          >
            Abrir guia →
          </Link>
        </div>
        <button
          onClick={logout}
          className="focus-ring mt-2 flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm text-[#536178] hover:bg-[#eef4fa]"
        >
          <span className="grid size-8 place-items-center rounded-full bg-[#eaf3ff] text-xs font-extrabold text-[#0054fc]">
            {user.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-xs text-[#34343a]">
              {user.name}
            </strong>
            {user.email ? (
              <small className="block truncate">{user.email}</small>
            ) : null}
          </span>
          <LogOut size={16} />
        </button>
      </div>
    </>
  );
  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[250px] flex-col border-r border-[#dfe6ee] bg-[#f7f8fa] lg:flex">
        {sidebar}
      </aside>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/25 lg:hidden"
          onClick={() => setOpen(false)}
        >
          <aside
            className="flex h-full w-[280px] flex-col bg-[#f7f8fa]"
            onClick={(event) => event.stopPropagation()}
          >
            {sidebar}
          </aside>
        </div>
      )}
      <header className="fixed inset-x-0 top-0 z-40 flex h-[73px] items-center justify-between border-b border-[#dfe6ee] bg-white/90 px-4 backdrop-blur-xl lg:left-[250px] lg:px-7">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="focus-ring rounded-xl p-2 hover:bg-[#efeff3] lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu size={21} />
          </button>
          <div>
            <Brand size="sm" />
            <span className="hidden text-xs text-[#85858e] sm:block">
              Da atenção à conversão
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Link
            href={hasProjects ? "/app/projects/new" : "/app/onboarding"}
            className="focus-ring inline-flex min-h-10 items-center rounded-xl bg-[#0054fc] px-4 text-sm font-bold text-white shadow-[0_8px_22px_rgba(0,84,252,.2)] transition hover:bg-[#0048d9]"
          >
            {hasProjects ? "Novo negócio" : "Criar minha Sobe"}
          </Link>
        </div>
      </header>
      <main className="min-h-screen pt-[73px] lg:pl-[250px]">
        <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
          <SupportModeBanner />
          <PlanStatusBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
