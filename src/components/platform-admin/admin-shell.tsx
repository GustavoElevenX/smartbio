import type { ReactNode } from "react";
import { Brand } from "@/components/ui/brand";
import { AdminNav } from "@/components/platform-admin/admin-nav";
export function AdminShell({ children, adminEmail }: Readonly<{ children: ReactNode; adminEmail: string }>) {
  return (
    <div className="min-h-screen bg-[#f7f8fa] text-[#07172f]">
      <header className="relative border-b bg-[#07172f] px-6 py-4 text-white">
        <div className="sobe-gradient-rule absolute inset-x-0 bottom-0" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Brand className="text-white" />
            <span className="text-sm font-semibold text-white/70">Administração da plataforma</span>
          </div>
          <p className="text-xs font-semibold text-white/70">Acesso restrito · {adminEmail}</p>
        </div>
      </header>
      <div className="mx-auto grid min-h-[calc(100vh-73px)] max-w-[1600px] lg:grid-cols-[240px_1fr]">
        <aside className="border-r border-[#dfe6ee] bg-white p-4">
          <AdminNav />
        </aside>
        <main className="min-w-0 p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
