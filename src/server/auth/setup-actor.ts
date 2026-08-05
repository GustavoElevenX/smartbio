import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

export interface AISetupActor {
  workspaceId: string;
  userId: string;
  persistence: "database" | "memory";
}

const localActor: AISetupActor = {
  workspaceId: "local-workspace",
  userId: "local-user",
  persistence: "memory",
};

export async function getAISetupActor(): Promise<AISetupActor> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || !createServiceClient()) return localActor;

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // A leitura de sessão continua válida em contextos que não permitem gravar cookies.
        }
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return localActor;
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!data?.workspace_id) return localActor;
  return { workspaceId: data.workspace_id, userId: user.id, persistence: "database" };
}
