"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  ["/admin", "Visão geral"],
  ["/admin/acquisition", "Aquisição"],
  ["/admin/product", "Produto"],
  ["/admin/users", "Usuários"],
  ["/admin/workspaces", "Espaços de trabalho"],
  ["/admin/pages", "Páginas"],
  ["/admin/projects", "Negócios"],
  ["/admin/plans", "Planos e cobrança"],
  ["/admin/support", "Suporte"],
  ["/admin/audit", "Auditoria"],
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1" aria-label="Administração da plataforma">
      {links.map(([href, label]) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("focus-ring block rounded-xl px-4 py-3 text-sm font-bold transition", active ? "bg-[#eaf3ff] text-[#0054fc]" : "text-[#536178] hover:bg-[#eef4fa] hover:text-[#07172f]")}>{label}</Link>
        );
      })}
    </nav>
  );
}
