import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { adminValueLabel } from "@/lib/admin-labels";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const db = createServiceClient()!;
  const [
    { data: project },
    { count: pages },
    { count: goals },
    { count: entries },
    { count: activations },
    { count: opportunities },
  ] = await Promise.all([
    db
      .from("projects")
      .select(
        "id,name,slug,description,status,workspace_id,published_at,created_at,updated_at,workspaces(name)",
      )
      .eq("id", projectId)
      .maybeSingle(),
    db
      .from("presence_pages")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    db
      .from("conversion_goals")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    db
      .from("entry_points")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    db
      .from("conversion_activations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    db
      .from("commercial_opportunities")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);
  if (!project) notFound();
  const workspace = Array.isArray(project.workspaces)
    ? project.workspaces[0]
    : project.workspaces;
  return (
    <div>
      <Link href="/admin/projects" className="text-sm font-bold">
        ← Negócios
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold">{project.name}</h1>
      <p className="mt-2 text-gray-600">
        {workspace?.name} · {adminValueLabel(project.status)} · atualizado em{" "}
        {new Date(project.updated_at).toLocaleString("pt-BR")}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Páginas", pages],
          ["Objetivos", goals],
          ["Entradas", entries],
          ["Ativações", activations],
          ["Oportunidades", opportunities],
          ["Publicado", project.published_at ? "Sim" : "Não"],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border bg-white p-5">
            <span className="text-sm text-gray-500">{label}</span>
            <strong className="mt-2 block text-2xl">{value || 0}</strong>
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-3">
        <Link
          href={`/${project.slug}`}
          target="_blank"
          className="rounded-xl bg-black px-4 py-3 text-sm font-bold text-white"
        >
          Abrir publicado
        </Link>
        <Link
          href={`/admin/workspaces/${project.workspace_id}`}
          className="rounded-xl border bg-white px-4 py-3 text-sm font-bold"
        >
          Ver espaço de trabalho
        </Link>
      </div>
    </div>
  );
}
