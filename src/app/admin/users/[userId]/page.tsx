import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";

export default async function Page({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const database = createServiceClient()!;
  const [{ data: profile }, auth, { data: memberships }, { data: support }] =
    await Promise.all([
      database
        .from("profiles")
        .select(
          "id,full_name,email,avatar_url,created_at,last_seen_at,last_sign_in_at,account_status",
        )
        .eq("id", userId)
        .maybeSingle(),
      database.auth.admin.getUserById(userId),
      database
        .from("workspace_members")
        .select(
          "role,created_at,workspaces(id,name,slug,workspace_plan_assignments(plan_key,status))",
        )
        .eq("user_id", userId),
      database
        .from("platform_support_sessions")
        .select("id,workspace_id,reason,status,started_at,ended_at")
        .eq("admin_user_id", userId)
        .order("started_at", { ascending: false })
        .limit(20),
    ]);
  if (!profile) notFound();
  return (
    <div>
      <Link href="/admin/users" className="text-sm font-bold">
        ← Usuários
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold">
        {profile.full_name || profile.email || userId}
      </h1>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="font-extrabold">Conta</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-gray-500">ID</dt>
              <dd>{profile.id}</dd>
            </div>
            <div>
              <dt className="text-gray-500">E-mail</dt>
              <dd>{profile.email}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Confirmação</dt>
              <dd>{auth.data.user?.email_confirmed_at || "Pendente"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Último acesso</dt>
              <dd>{profile.last_seen_at || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd>{profile.account_status}</dd>
            </div>
          </dl>
        </section>
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="font-extrabold">Workspaces e plano principal</h2>
          <div className="mt-4 space-y-3 text-sm">
            {(memberships || []).map((membership, index) => {
              const workspace = Array.isArray(membership.workspaces)
                ? membership.workspaces[0]
                : membership.workspaces;
              const assignments = workspace?.workspace_plan_assignments;
              const assignment = Array.isArray(assignments)
                ? assignments[0]
                : assignments;
              return (
                <div key={index} className="rounded-xl bg-gray-50 p-3">
                  <Link
                    className="font-bold"
                    href={`/admin/workspaces/${workspace?.id}`}
                  >
                    {workspace?.name}
                  </Link>
                  <p>
                    {membership.role} · {assignment?.plan_key || "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-6 lg:col-span-2">
          <h2 className="font-extrabold">Histórico de suporte</h2>
          <div className="mt-4 space-y-2 text-sm">
            {(support || []).map((item) => (
              <div key={item.id}>
                {item.started_at} · {item.status} · {item.reason}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
