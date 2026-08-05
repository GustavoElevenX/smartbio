import "server-only";

import { readServerEnv } from "@/lib/env/server";
import type { SmartBioAIProvider } from "@/server/ai/ai-provider";
import { OpenAISmartBioProvider } from "@/server/ai/openai-provider";

let provider: SmartBioAIProvider | undefined;

export function isAIConfigured() {
  return Boolean(readServerEnv().OPENAI_API_KEY);
}

export function getAIProvider(): SmartBioAIProvider {
  if (!provider) provider = new OpenAISmartBioProvider();
  return provider;
}

export function setAIProviderForTests(next?: SmartBioAIProvider) {
  provider = next;
}
