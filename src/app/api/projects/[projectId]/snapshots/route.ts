import { z } from "zod";
import { createProjectSnapshot } from "@/server/ai-editing/project-snapshots";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import type { Project } from "@/types";
const schema = z.object({ snapshot: z.custom<Project>((value) => Boolean(value && typeof value === "object")), operation: z.string().min(1).max(100), afterState: z.unknown().optional() });
export const POST = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/snapshots">, actor) => { const { projectId } = await context.params; const input = schema.parse(await request.json()); if (input.snapshot.id !== projectId) return Response.json({ error: "Snapshot não pertence ao projeto." }, { status: 422 }); return Response.json({ data: await createProjectSnapshot(actor, projectId, input.snapshot, input.operation, input.afterState) }, { status: 201 }); });
