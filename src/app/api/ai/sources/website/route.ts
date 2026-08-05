import { z } from "zod";
import { importWebsiteSource } from "@/server/business-sources/source-service";
import { apiError } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
const schema = z.object({ setupSessionId: z.uuid().optional(), projectId: z.uuid().optional(), url: z.url() });
export const POST = withAuthenticatedActor(async (request, _context, actor) => { const rate = await consumeRateLimit("source-process", actor.workspaceId, rateLimitRules.sourceProcess, { failClosed: true }); if (!rate.allowed) return applyRateLimitHeaders(apiError("Limite de importações atingido.", 429, "rate_limited"), rate); try { const result = await importWebsiteSource(actor, schema.parse(await request.json())); return applyRateLimitHeaders(Response.json({ data: { id: result.source.id, name: result.source.name, type: result.source.type, status: result.source.status }, facts: result.facts }, { status: 201 }), rate); } catch (error) { return applyRateLimitHeaders(apiError(error instanceof Error ? error.message : "Não foi possível importar o site.", 400, "website_import_failed"), rate); } });
