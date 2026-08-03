import { z } from "zod";

const safeText = z.string().trim().max(500).transform((value) => value.replace(/[<>]/g, ""));

export const analyticsEventSchema = z.object({
  projectId: z.string().min(1).max(100), visitorId: z.string().min(1).max(150), sessionId: z.string().min(1).max(150),
  eventName: z.enum(["page_view", "session_started", "step_viewed", "option_clicked", "form_started", "form_submitted", "recommendation_viewed", "cta_clicked", "whatsapp_clicked", "external_link_clicked", "journey_completed"]),
  stepId: z.string().max(100).optional(), optionId: z.string().max(100).optional(), metadata: z.record(z.string(), z.unknown()).optional(), referrer: z.string().url().max(1000).or(z.literal("")).optional(),
  utmSource: safeText.optional(), utmMedium: safeText.optional(), utmCampaign: safeText.optional(), utmContent: safeText.optional(), utmTerm: safeText.optional(), deviceType: z.enum(["mobile", "desktop", "tablet"]).optional(),
});

export const leadSchema = z.object({
  projectId: z.string().min(1).max(100), projectName: safeText, sessionId: z.string().min(1).max(150), name: safeText.optional(),
  email: z.string().email().max(250).optional().or(z.literal("")), phone: z.string().max(40).regex(/^[\d+()\s-]*$/).optional().or(z.literal("")), company: safeText.optional(),
  status: z.literal("new").default("new"), source: safeText.optional(), campaign: safeText.optional(), recommendation: safeText.optional(),
  answers: z.record(z.string(), z.string().max(1000)), honeypot: z.string().max(0).optional(),
});
