import { z } from "zod";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { createServerCompositionOrchestrator } from "@/server/composition/create-server-composition-orchestrator";

const schema = z.object({
  businessName: z.string().trim().min(2).max(160), businessDescription: z.string().trim().min(15).max(5000),
  primaryGoal: z.string().trim().min(2).max(300), primaryDestination: z.string().trim().min(2).max(200), slug: z.string().trim().min(1).max(80),
  category: z.string().max(160).optional(), audience: z.string().max(500).optional(), phone: z.string().max(40).optional(),
  brandPersonality: z.array(z.string().max(80)).max(20).optional(), visualDirection: z.string().max(160).optional(),
  preferredDensity: z.enum(["compact", "balanced", "immersive"]).optional(), preferredTheme: z.enum(["light", "dark", "auto"]).optional(), websiteUrl: z.url().optional(),
  offerKinds: z.array(z.enum(["physical_product", "digital_product", "service", "professional_service", "hospitality", "rental", "event", "content", "membership", "mixed"])).optional(),
  primaryIntents: z.array(z.enum(["buy", "order", "request_quote", "schedule", "reserve", "check_availability", "request_proposal", "contact", "visit", "register", "pay_deposit", "continue_external"])).optional(),
  secondaryIntents: z.array(z.enum(["buy", "order", "request_quote", "schedule", "reserve", "check_availability", "request_proposal", "contact", "visit", "register", "pay_deposit", "continue_external"])).optional(),
  confirmationMode: z.enum(["instant", "manual_approval", "external_system"]).optional(), capacityKinds: z.array(z.enum(["none", "time_slot", "professional", "location", "room", "table", "asset", "inventory", "daily_capacity"])).optional(),
  hasMultipleLocations: z.boolean().optional(), requiresQualification: z.boolean().optional(), requiresMediaUpload: z.boolean().optional(), requiresPayment: z.boolean().optional(), allowsCancellationRequest: z.boolean().optional(), allowsRescheduleRequest: z.boolean().optional(),
  completionChannel: z.enum(["native", "whatsapp", "external_url", "email", "phone"]).optional(), requiredVisitorData: z.array(z.string().max(80)).max(20).optional(),
  businessRules: z.array(z.object({ key: z.string().max(80), description: z.string().max(300), value: z.union([z.string(),z.number(),z.boolean()]).optional() })).max(30).optional(),
});

export const POST = withAuthenticatedActor(async (request, _context, actor) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  try {
    const project = await createServerCompositionOrchestrator({ workspaceId: actor.workspaceId, userId: actor.userId }).compose(parsed.data);
    return apiSuccess({ ...project, workspaceId: actor.workspaceId, status: "draft" });
  } catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível compor o projeto.", 400, "composition_failed"); }
});
