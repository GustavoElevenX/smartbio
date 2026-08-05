import { applyExtractedFacts } from "@/server/business-sources/apply-extracted-facts";
import { apiError } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
export const POST = withAuthenticatedActor(async (request, _context, actor) => { try { return Response.json({ data: await applyExtractedFacts(actor, await request.json()) }); } catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível aplicar os fatos.", 400, "facts_apply_failed"); } });
