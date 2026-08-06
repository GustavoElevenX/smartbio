import { z } from "zod";
import {
  businessLocationObjectSchema, catalogCategorySchema, catalogItemSchema, projectPolicySchema,
  quoteDefinitionSchema, reservableUnitSchema, routingDestinationSchema, routingRuleSchema,
  schedulableServiceSchema, serviceOfferingObjectSchema,
} from "@/features/commercial-data/commercial-data.schema";

const partialItems = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) => z.array(schema.partial()).max(1000);

export const commercialConfigPatchSchema = z.object({
  serviceOfferings: partialItems(serviceOfferingObjectSchema).optional(),
  quoteDefinition: quoteDefinitionSchema.partial().optional(),
  schedulableServices: partialItems(schedulableServiceSchema).optional(),
  catalogCategories: partialItems(catalogCategorySchema).optional(),
  catalogItems: partialItems(catalogItemSchema).optional(),
  reservableUnits: partialItems(reservableUnitSchema).optional(),
  routingDestinations: partialItems(routingDestinationSchema).optional(),
  routingRules: partialItems(routingRuleSchema).optional(),
  locations: partialItems(businessLocationObjectSchema).optional(),
  policies: partialItems(projectPolicySchema).optional(),
  paymentUrl: z.url().optional(),
});

export type CommercialConfigPatch = z.infer<typeof commercialConfigPatchSchema>;
