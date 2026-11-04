import { z } from "zod";

export const feedbackSchema = z.object({ reason: z.enum(["not_using", "no_traffic", "no_result", "too_expensive", "alternative", "missing_feature", "other"]).optional(), comment: z.string().trim().max(1000).optional() });
