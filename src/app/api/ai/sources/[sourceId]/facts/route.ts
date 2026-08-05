import { sourceRepository } from "@/server/business-sources/source-repository";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
export const GET = withAuthenticatedActor(async (_request, context: RouteContext<"/api/ai/sources/[sourceId]/facts">, actor) => { const { sourceId } = await context.params; return Response.json({ data: await sourceRepository.listFacts(actor, sourceId) }); });
