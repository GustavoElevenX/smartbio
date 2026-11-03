import { z } from "zod";
import { isExternalUrl } from "@/lib/external-url";

export const presenceActionSchema = z.object({
  type: z.enum(["start_conversion_goal", "go_to_presence_page", "scroll_to_section", "open_url", "open_whatsapp", "start_activation"]),
  label: z.string().trim().min(1).max(80),
  conversionGoalId: z.string().min(1).optional(),
  pageId: z.string().min(1).optional(),
  anchor: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).optional(),
  url: z.string().trim().max(2048).refine(isExternalUrl, "Informe um link HTTP ou HTTPS válido.").optional(),
  whatsappPhone: z.string().refine((value) => /^\+?[1-9]\d{7,14}$/.test(value.replace(/[\s().-]/g, "")), "Informe um WhatsApp válido com DDD e código do país.").optional(),
  whatsappDestinationId: z.string().min(1).optional(),
  whatsappMessage: z.string().max(500).optional(),
  activationId: z.string().uuid().optional(),
  style: z.enum(["primary", "secondary", "ghost", "link"]).default("primary"),
  analyticsLabel: z.string().max(100).optional(),
}).superRefine((action, context) => {
  const required: Partial<Record<typeof action.type, keyof typeof action>> = {
    start_conversion_goal: "conversionGoalId",
    go_to_presence_page: "pageId",
    scroll_to_section: "anchor",
    open_url: "url",
    start_activation: "activationId",
  };
  const field = required[action.type];
  if (field && !action[field]) context.addIssue({ code: "custom", path: [field], message: "Destino obrigatório para esta ação." });
});
