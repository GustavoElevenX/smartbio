import type { Project } from "@/types";
import { RoutingFlow } from "./routing-flow";
export function RoutingOverview({ project }: { project: Project }) { return <section className="rounded-[22px] border border-[#e2e0e8] bg-white p-5"><h2 className="font-extrabold">Roteamento</h2><p className="mt-1 text-xs text-[#77747f]">Regras determinísticas conectam contexto ao destino.</p><div className="mt-5"><RoutingFlow project={project} /></div></section>; }
