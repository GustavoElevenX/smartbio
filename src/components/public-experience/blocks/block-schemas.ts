import { z } from "zod";

export const blockContentSchemas = {
  media_upload: z.object({ fieldKey: z.string().default("media"), maxFiles: z.number().int().min(1).max(8).default(4), required: z.boolean().default(false) }),
  quantity_selector: z.object({ fieldKey: z.string().default("quantity"), min: z.number().int().min(0).default(1), max: z.number().int().max(999).default(20) }),
  service_selector: z.object({ fieldKey: z.string().default("service"), options: z.array(z.string()).optional(), services: z.array(z.object({ id: z.string(), name: z.string(), durationMinutes: z.number().optional() })).optional() }),
  resource_selector: z.object({ resources: z.array(z.object({ id: z.string(), name: z.string() })).default([]) }),
  location_selector: z.object({ fieldKey: z.string().default("location"), options: z.array(z.string()).default([]) }),
  policy_card: z.object({ text: z.string().max(1000).default("Consulte as políticas do negócio antes de confirmar.") }),
  deposit_card: z.object({ percent: z.number().min(0).max(100).optional(), external: z.boolean().optional() }),
};

type BlockContent<T extends keyof typeof blockContentSchemas> = z.infer<(typeof blockContentSchemas)[T]>;

export function parseBlockContent<T extends keyof typeof blockContentSchemas>(type: T, content: Record<string, unknown> | undefined) {
  return blockContentSchemas[type].safeParse(content || {}) as z.ZodSafeParseResult<BlockContent<T>>;
}
