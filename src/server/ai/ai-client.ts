import "server-only";

import { readServerEnv } from "@/lib/env/server";
import type { VirouAIProvider } from "@/server/ai/ai-provider";
import { OpenAIVirouProvider } from "@/server/ai/openai-provider";
import { ActivationGateFakeProvider } from "@/server/ai/activation-gate-fake-provider";

let provider: VirouAIProvider | undefined;

export function isAIConfigured() {
  return fakeProviderEnabled() || Boolean(readServerEnv().OPENAI_API_KEY);
}

function fakeProviderEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.ACTIVATION_GATE_FAKE_AI === "true";
}

export function getAIProvider(): VirouAIProvider {
  if (!provider) provider = fakeProviderEnabled() ? new ActivationGateFakeProvider() : new OpenAIVirouProvider();
  return provider;
}

export function setAIProviderForTests(next?: VirouAIProvider) {
  provider = next;
}
