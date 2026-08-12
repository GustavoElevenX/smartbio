import "server-only";

import { readServerEnv } from "@/lib/env/server";
import type { VirouAIProvider } from "@/server/ai/ai-provider";
import { OpenAIVirouProvider } from "@/server/ai/openai-provider";

let provider: VirouAIProvider | undefined;

export function isAIConfigured() {
  return Boolean(readServerEnv().OPENAI_API_KEY);
}

export function getAIProvider(): VirouAIProvider {
  if (!provider) provider = new OpenAIVirouProvider();
  return provider;
}

export function setAIProviderForTests(next?: VirouAIProvider) {
  provider = next;
}
