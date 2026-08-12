import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { assertProjectAccess } from "@/server/auth/project-access";
import { requireAuthenticatedActor } from "@/server/auth/setup-actor";
import { ActivationService } from "@/server/activations/activation-service";
import { activationCreateSchema } from "@/features/activations/activation.schema";
export async function GET(_:Request,{params}:RouteContext<"/api/projects/[projectId]/activations">){const{projectId}=await params;const actor=await requireAuthenticatedActor();await assertProjectAccess(actor,projectId,"read");return apiSuccess({activations:await new ActivationService(createServiceClient()).list(projectId)});}
export async function POST(request:Request,{params}:RouteContext<"/api/projects/[projectId]/activations">){const{projectId}=await params;const actor=await requireAuthenticatedActor();await assertProjectAccess(actor,projectId,"write");const raw=await request.json().catch(()=>null);const parsed=activationCreateSchema.safeParse(raw);if(!parsed.success)return validationError(parsed.error);try{return apiSuccess({activation:await new ActivationService(createServiceClient()).create({workspaceId:actor.workspaceId,projectId,actorId:actor.userId,data:parsed.data})},201);}catch(error){return apiError(error instanceof Error?error.message:"Não foi possível criar a ativação.",400,"activation_create_failed");}}
