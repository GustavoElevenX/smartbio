import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  validationError,
} from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

const schema = z.object({
  fullName: z.string().trim().max(160).nullable().optional(),
  avatarUrl: z.url().max(1000).nullable().optional(),
});

export const GET = withAuthenticatedActor(async (_request, _context, actor) => {
  if (actor.persistence === "memory") {
    return apiSuccess({
      id: actor.userId,
      full_name: "Usuário local",
      avatar_url: null,
      email: actor.email,
      last_seen_at: null,
      last_sign_in_at: null,
      account_status: "active",
    });
  }
  const database = createServiceClient();
  if (!database)
    return apiError("Banco indisponível.", 503, "database_required");
  const { data, error } = await database
    .from("profiles")
    .select(
      "id,full_name,avatar_url,email,last_seen_at,last_sign_in_at,account_status",
    )
    .eq("id", actor.userId)
    .single();
  if (error?.code === "42703") {
    const legacy = await database
      .from("profiles")
      .select("id,full_name,avatar_url")
      .eq("id", actor.userId)
      .single();
    if (legacy.error)
      return apiError(
        "Não foi possível carregar o perfil.",
        500,
        "profile_failed",
      );
    return apiSuccess({
      ...legacy.data,
      email: actor.email,
      last_seen_at: null,
      last_sign_in_at: null,
      account_status: "active",
    });
  }
  if (error)
    return apiError(
      "Não foi possível carregar o perfil.",
      500,
      "profile_failed",
    );
  return apiSuccess(data);
});

export const PATCH = withAuthenticatedActor(
  async (request, _context, actor) => {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    if (actor.persistence === "memory") {
      return apiSuccess({
        id: actor.userId,
        full_name: parsed.data.fullName ?? "Usuário local",
        avatar_url: parsed.data.avatarUrl ?? null,
        email: actor.email,
      });
    }
    const database = createServiceClient();
    if (!database)
      return apiError("Banco indisponível.", 503, "database_required");
    const { data, error } = await database
      .from("profiles")
      .update({
        full_name: parsed.data.fullName,
        avatar_url: parsed.data.avatarUrl,
      })
      .eq("id", actor.userId)
      .select("id,full_name,avatar_url")
      .single();
    if (error)
      return apiError(
        "Não foi possível atualizar o perfil.",
        500,
        "profile_update_failed",
      );
    return apiSuccess({ ...data, email: actor.email });
  },
);
