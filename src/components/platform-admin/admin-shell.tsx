import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/ui/brand";
const links = [
  ["/admin", "Visão geral"],
  ["/admin/users", "Usuários"],
  ["/admin/workspaces", "Workspaces"],
  ["/admin/projects", "Negócios"],
  ["/admin/plans", "Planos"],
  ["/admin/support", "Suporte"],
  ["/admin/audit", "Auditoria"],
];
export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-[#f7f8fa] text-[#07172f]">
      <header className="relative border-b bg-[#07172f] px-6 py-4 text-white">
        <div className="sobe-gradient-rule absolute inset-x-0 bottom-0" />
        <div className="flex items-center gap-3">
          <Brand className="text-white" />
          <span className="text-sm font-semibold text-white/55">Platform Admin</span>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[220px_1fr]">
        <aside className="border-r bg-white p-4">
          <nav className="space-y-1">
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="block rounded-xl px-4 py-3 text-sm font-bold transition hover:bg-[#eaf3ff] hover:text-[#0054fc]"
              >
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
