import type { ConversionActivation } from "@/features/activations/activation.types";
const state = globalThis as typeof globalThis & { __virouActivations?: Map<string, ConversionActivation> };
export const activationMemory = state.__virouActivations || (state.__virouActivations = new Map());
