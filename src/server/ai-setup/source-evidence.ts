import "server-only";

import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import type { DataOrigin } from "@/types";

export interface SetupFact {
  key: string;
  label: string;
  value: string;
  origin: DataOrigin;
  sourceId: string;
  confidence: number;
}

export function initialSetupFacts(input: AISetupSession["initialInput"]): SetupFact[] {
  const values: Array<[string, string, string | undefined]> = [
    ["business.name", "Nome do negócio", input.businessName],
    ["business.description", "Descrição", input.description],
    ["business.website", "Site", input.websiteUrl],
    ["business.phone", "Telefone", input.phone],
  ];
  return values.flatMap(([key, label, value]) => value
    ? [{ key, label, value, origin: "user" as const, sourceId: "initial-input", confidence: 1 }]
    : []);
}
