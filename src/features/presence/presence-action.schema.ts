import { z } from "zod";

export const presenceActionSchema = z.object({
  type: z.enum(["start_conversion_goal", "go_to_presence_page", "scroll_to_section", "open_url", "open_whatsapp"]),
  label: z.string().trim().min(1).max(80),
  conversionGoalId: z.string().min(1).optional(),
  pageId: z.string().min(1).optional(),
  anchor: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).optional(),
  url: z.url().optional(),
  whatsappPhone: z.string().regex(/^\+?[1-9]\d{7,14}$/).optional(),
  whatsappMessage: z.string().max(500).optional(),
  style: z.enum(["primary", "secondary", "ghost", "link"]).default("primary"),
  analyticsLabel: z.string().max(100).optional(),
}).superRefine((action, context) => {
  const required: Partial<Record<typeof action.type, keyof typeof action>> = {
    start_conversion_goal: "conversionGoalId",
    go_to_presence_page: "pageId",
    scroll_to_section: "anchor",
    open_url: "url",
    open_whatsapp: "whatsappPhone",
  };
  const field = required[action.type];
  if (field && !action[field]) context.addIssue({ code: "custom", path: [field], message: "Destino obrigatório para esta ação." });
});
