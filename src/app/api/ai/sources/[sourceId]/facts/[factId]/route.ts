import { z } from "zod";
import { sourceRepository } from "@/server/business-sources/source-repository";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
const schema = z.object({ value: z.unknown().optional(), status: z.enum(["verified", "needs_confirmation", "rejected", "invalid"]) });
export const PATCH = withAuthenticatedActor(async (request, context: RouteContext<"/api/ai/sources/[sourceId]/facts/[factId]">, actor) => { const { sourceId, factId } = await context.params; return Response.json({ data: await sourceRepository.updateFact(actor, sourceId, factId, schema.parse(await request.json())) }); });
