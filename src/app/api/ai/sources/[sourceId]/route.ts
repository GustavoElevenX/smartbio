import { sourceRepository } from "@/server/business-sources/source-repository";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

export const GET = withAuthenticatedActor(
  async (
    _request,
    context: { params: Promise<{ sourceId: string }> },
    actor,
  ) => {
    const { sourceId } = await context.params;
    const source = await sourceRepository.get(actor, sourceId);
    if (!source) return apiError("Fonte não encontrada.", 404, "source_not_found");
    return apiSuccess({
      id: source.id,
      name: source.name,
      type: source.type,
      status: source.status,
      processingError: source.processingError,
    });
  },
);
