import { z } from "zod";

import { apiError } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { prepareProjectPublication, publishProject } from "@/server/publishing/publish-project";
import type { Project } from "@/types";
import { getRequestId, logError, requestPathname } from "@/server/observability/log";

const schema = z.object({
  projectSnapshot: z.custom<Project>((value) => Boolean(value && typeof value === "object")).optional(),
  publication: z.object({
    homeMode: z.enum(["site", "journey", "goal", "step"]),
    conversionGoalId: z.string().min(1).optional(),
    initialStepId: z.string().min(1).optional(),
  }).optional(),
  confirm: z.boolean().default(false),
}).superRefine((value, context) => {
  if (value.publication?.homeMode === "goal" && !value.publication.conversionGoalId) {
    context.addIssue({ code: "custom", path: ["publication", "conversionGoalId"], message: "Escolha a meta inicial." });
  }
  if (value.publication?.homeMode === "step" && !value.publication.initialStepId) {
    context.addIssue({ code: "custom", path: ["publication", "initialStepId"], message: "Escolha a página inicial." });
  }
});

export const POST = withAuthenticatedActor(
  async (
    request,
    context: RouteContext<"/api/projects/[projectId]/publish">,
    actor,
  ) => {
    const { projectId } = await context.params;
    const logContext = {
      requestId: getRequestId(request),
      route: requestPathname(request),
    };
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return apiError("Solicitação de publicação inválida.", 400, "validation_error");
    try {
      const result = parsed.data.confirm
        ? await publishProject(actor, projectId, parsed.data.projectSnapshot, parsed.data.publication, logContext)
        : await prepareProjectPublication(actor, projectId, parsed.data.projectSnapshot, parsed.data.publication, logContext);
      return Response.json({ ok: result.published || result.readiness.publishable, data: result }, {
        status: result.readiness.publishable ? 200 : 422,
      });
    } catch (error) {
      logError("project_publish_failed", {
        ...logContext,
        workspaceId: actor.workspaceId,
        userId: actor.userId,
      });
      return apiError(
        error instanceof Error ? error.message : "Não foi possível publicar o projeto.",
        400,
        "publish_failed",
      );
    }
  },
);
