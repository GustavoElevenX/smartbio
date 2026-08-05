import { generateCopySuggestions } from "@/server/ai-editing/ai-editing-service";
import { apiError } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
export const POST = withAuthenticatedActor(async (request, _context, actor) => { const rate = await consumeRateLimit("ai-copy", actor.userId, rateLimitRules.aiCopy, { failClosed: true }); if (!rate.allowed) return applyRateLimitHeaders(apiError("Limite de melhorias de texto atingido.", 429, "rate_limited"), rate); try { return applyRateLimitHeaders(Response.json(await generateCopySuggestions(actor, await request.json())), rate); } catch (error) { return applyRateLimitHeaders(apiError(error instanceof Error ? error.message : "Não foi possível gerar sugestões.", 400, "copy_failed"), rate); } });
