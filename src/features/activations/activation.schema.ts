import { z } from "zod";
import { activationEligibilitySchema } from "./activation-eligibility.schema";

export const activationLimitsSchema = z.object({
  maxClaims: z.number().int().positive().optional(), maxRedemptions: z.number().int().positive().optional(),
  maxClaimsPerCustomer: z.number().int().positive().optional(), maxRedemptionsPerCustomer: z.number().int().positive().optional(),
}).default({});

const activationBaseSchema = z.object({
  id: z.string().uuid(), workspaceId: z.string().uuid(), projectId: z.string().uuid(), activationKey: z.string().trim().min(1).max(120).regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().trim().min(1).max(160), description: z.string().trim().max(1000).optional(),
  activationType: z.enum(["promotion","launch","fill_calendar","lead_capture","product_push","service_push","location_push","waitlist","seasonal","announcement","custom"]),
  status: z.enum(["draft","scheduled","active","paused","ended","archived"]).default("draft"), conversionGoalId: z.string().trim().min(1).max(150).optional(), defaultDestinationId: z.string().trim().min(1).max(150).optional(),
  title: z.string().trim().max(160).optional(), message: z.string().trim().max(1000).optional(), startsAt: z.iso.datetime().optional(), endsAt: z.iso.datetime().optional(), timezone: z.string().trim().min(1).max(80).default("America/Sao_Paulo"),
  priority: z.number().int().min(-1000).max(1000).default(0), requiresIdentity: z.boolean().default(false), identityMode: z.enum(["none","phone","email","phone_or_email"]).default("phone"),
  identityVerification: z.enum(["none","otp"]).default("none"), completionChannel: z.enum(["native","whatsapp","external_url","email","phone"]).optional(),
  eligibility: activationEligibilitySchema.default({}), limits: activationLimitsSchema, settings: z.record(z.string(), z.unknown()).default({}), offers: z.array(z.unknown()).default([]), placements: z.array(z.unknown()).default([]),
  entryPointIds: z.array(z.string().uuid()).default([]), locationIds: z.array(z.string().uuid()).default([]), publishedSnapshot: z.record(z.string(), z.unknown()).optional(), publishedAt: z.iso.datetime().optional(), version: z.number().int().positive().default(1), createdAt: z.iso.datetime().optional(), updatedAt: z.iso.datetime().optional(),
});

const validSchedule = (value: { startsAt?: string; endsAt?: string }) => !value.startsAt || !value.endsAt || new Date(value.endsAt) > new Date(value.startsAt);
export const activationSchema = activationBaseSchema.refine(validSchedule, { path: ["endsAt"], message: "O término deve ser posterior ao início." });
export const activationCreateSchema = activationBaseSchema.omit({ id: true, workspaceId: true, projectId: true, createdAt: true, updatedAt: true }).partial({ activationKey: true, status: true, timezone: true, priority: true, requiresIdentity: true, identityMode: true, identityVerification: true, eligibility: true, limits: true, settings: true, offers: true, placements: true, entryPointIds: true, locationIds: true, version: true }).refine(validSchedule, { path: ["endsAt"], message: "O término deve ser posterior ao início." });
export const activationPatchSchema = activationBaseSchema.omit({ id: true, workspaceId: true, projectId: true, createdAt: true, updatedAt: true }).partial().refine(validSchedule, { path: ["endsAt"], message: "O término deve ser posterior ao início." });
