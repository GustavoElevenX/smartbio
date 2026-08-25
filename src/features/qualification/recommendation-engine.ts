import { offerIntelligenceFor, type OfferIntelligenceProfile } from "@/features/qualification/offer-intelligence";
import type { JourneyMode, ServiceOffering } from "@/types";

const stopwords = new Set([
  "a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "em",
  "mais", "o", "os", "para", "por", "que", "um", "uma", "no", "na", "nos", "nas",
  "meu", "minha", "meus", "minhas", "quero", "gostaria", "preciso", "esta", "estao", "nao",
]);

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function tokenList(value: string) {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function stem(token: string) {
  return token
    .replace(/(?:coes|cao|mente|amentos|amento|imentos|imento|idades|idade)$/g, "")
    .replace(/(?:ados|adas|idos|idas|ando|endo|indo|ais|eis|oes)$/g, "")
    .replace(/(?:ar|er|ir)$/g, "")
    .replace(/s$/g, "");
}

function semanticTokens(value: string) {
  return new Set(tokenList(value).flatMap((token) => [token, stem(token)]).filter((token) => token.length > 1));
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function answerEntries(answers: Record<string, unknown>) {
  return Object.entries(answers).flatMap(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];
    return values.map((item) => ({ key, value: String(item ?? "").trim() })).filter((item) => item.value);
  });
}

function signalMatch(signal: string, answerTokens: Set<string>) {
  const tokens = [...semanticTokens(signal)];
  const matched = tokens.filter((token) => answerTokens.has(token));
  const required = tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length * 0.67);
  return { matched: tokens.length > 0 && matched.length >= required, tokenCount: matched.length };
}

function matchedPhrases(signals: string[], answerTokens: Set<string>) {
  return signals.filter((signal) => signalMatch(signal, answerTokens).matched);
}

/** Compatibilidade para consumidores antigos: apenas termos da oferta atual, sem vocabulário setorial global. */
export function inferRecommendationSignals(name: string, description = "", context = "") {
  void context;
  return unique([name, ...tokenList(`${name} ${description}`)]).slice(0, 24);
}

export function inferStrongRecommendationSignals(name: string, description = "", context = "") {
  void name;
  void description;
  void context;
  return [] as string[];
}

export function inferRecommendationSubject(context: string) {
  void context;
  return undefined;
}

export function conservativeServiceDescription(name: string) {
  const normalized = name.trim().replace(/[.!?]+$/g, "");
  return `${normalized}: opção real informada pelo negócio, com escopo a confirmar com a equipe.`;
}

export type RecommendationConfidence = "clear" | "possible" | "uncertain";

export interface ServiceRecommendation {
  service?: ServiceOffering;
  confidence: RecommendationConfidence;
  label: string;
  title: string;
  reason: string;
  matchedSignals?: string[];
  strongEvidence?: boolean;
}

interface RankedOffer {
  service: ServiceOffering;
  profile?: OfferIntelligenceProfile;
  score: number;
  matchedSignals: string[];
  strongEvidence: boolean;
  ambiguityMatches: string[];
}

function explanation(best: RankedOffer, entries: ReturnType<typeof answerEntries>) {
  const stated = entries.map((item) => item.value.replace(/[.!?]+$/g, "")).join("; ").slice(0, 280);
  const grounded = best.profile?.explanationData[0];
  if (stated && grounded) return `Você relatou “${stated}”. ${grounded}`;
  if (stated) return `Você relatou “${stated}”. Os sinais informados tornam esta uma possibilidade a considerar, sem substituir a avaliação da equipe.`;
  if (grounded) return grounded;
  return "Os sinais disponíveis tornam esta uma possibilidade a considerar. A equipe pode confirmar o escopo antes da decisão.";
}

function rankOffer(service: ServiceOffering, answerTokens: Set<string>, normalizedAnswers: string, journeyMode: JourneyMode): RankedOffer {
  const profile = offerIntelligenceFor(service);
  const exact = normalizedAnswers.includes(normalize(service.name));
  if (!profile) {
    const lexical = [...semanticTokens(`${service.name} ${service.shortDescription || ""} ${service.description || ""}`)]
      .filter((token) => answerTokens.has(token));
    return {
      service,
      score: lexical.length + (exact ? journeyMode === "explicit_choice" ? 100 : 3 : 0),
      matchedSignals: lexical,
      strongEvidence: false,
      ambiguityMatches: [],
    };
  }

  const supporting = matchedPhrases([
    ...profile.compatibleNeeds,
    ...profile.relatedGoals,
    ...profile.supportingSignals,
  ], answerTokens);
  const ambiguityMatches = matchedPhrases(profile.ambiguitySignals, answerTokens);
  const exclusions = matchedPhrases(profile.exclusions, answerTokens);
  const strongGroups = profile.strongSignalGroups.map((group) => {
    const clues = matchedPhrases(group.clues, answerTokens);
    return { group, clues, satisfied: clues.length >= group.minimumMatches };
  });
  const satisfied = strongGroups.filter((group) => group.satisfied);
  const matchedStrongClues = unique(satisfied.flatMap((group) => group.clues));
  const strongEvidence = satisfied.length > 0;
  const lexical = [...semanticTokens(`${service.name} ${profile.safeDescription}`)].filter((token) => answerTokens.has(token));
  const ambiguityScore = profile.fallbackEligible && ambiguityMatches.length ? ambiguityMatches.length * 5 : 0;
  const supportingScore = supporting.reduce((score, signal) => score + (semanticTokens(signal).size >= 2 ? 4 : 1), 0);
  const score = (strongEvidence ? 18 + matchedStrongClues.length * 5 : 0)
    + supportingScore
    + lexical.length
    + ambiguityScore
    + (exact ? journeyMode === "explicit_choice" ? 100 : 3 : 0)
    - exclusions.length * 20;
  return {
    service,
    profile,
    score,
    matchedSignals: unique([...matchedStrongClues, ...supporting, ...ambiguityMatches]),
    strongEvidence,
    ambiguityMatches,
  };
}

export function recommendService(
  answers: Record<string, unknown>,
  offerings: ServiceOffering[],
  options: { journeyMode?: JourneyMode } = {},
): ServiceRecommendation {
  const active = offerings.filter((offering) => offering.isActive);
  const entries = answerEntries(answers);
  const combined = entries.map((entry) => entry.value).join(" ");
  const normalizedAnswers = normalize(combined);
  const answerTokens = semanticTokens(combined);
  const journeyMode = options.journeyMode || "assisted_discovery";
  const ranked = active
    .map((service) => rankOffer(service, answerTokens, normalizedAnswers, journeyMode))
    .toSorted((a, b) => b.score - a.score || a.service.order - b.service.order);
  const best = ranked[0];
  const runnerUp = ranked[1];

  if (!best || best.score < 4) {
    return {
      confidence: "uncertain",
      label: "Orientação inicial",
      title: "Vale conversar com a equipe antes de escolher",
      reason: entries.length
        ? `Você relatou “${entries.map((entry) => entry.value).join("; ").slice(0, 260)}”. Ainda faltam sinais suficientes para apontar uma única opção com segurança.`
        : "Suas respostas ajudam a preparar a conversa, mas ainda não apontam com segurança para uma única opção.",
    };
  }

  if (journeyMode === "explicit_choice" && best.score >= 100) {
    return {
      service: best.service,
      confidence: "clear",
      label: "Opção escolhida",
      title: best.service.name,
      reason: `Você escolheu ${best.service.name}. Confira os detalhes e continue com a equipe.`,
      matchedSignals: best.matchedSignals,
      strongEvidence: true,
    };
  }

  const lead = best.score - (runnerUp?.score || 0);
  if (!best.strongEvidence && lead < 2) {
    return {
      confidence: "uncertain",
      label: "Orientação inicial",
      title: "Vale conversar com a equipe antes de escolher",
      reason: entries.length
        ? `Você relatou “${entries.map((entry) => entry.value).join("; ").slice(0, 260)}”. Esses sinais ainda se relacionam com mais de uma opção, então a equipe deve confirmar o caminho.`
        : "As respostas ainda se relacionam com mais de uma opção. A equipe pode avaliar o contexto antes de indicar um caminho.",
    };
  }

  const fallbackOffer = Boolean(best.profile?.fallbackEligible && best.ambiguityMatches.length && !best.strongEvidence);
  const confidence: RecommendationConfidence = best.strongEvidence
    ? "clear"
    : best.score >= 8 && lead >= 3 && !fallbackOffer
      ? "clear"
      : "possible";
  return {
    service: best.service,
    confidence,
    label: confidence === "clear" ? "Boa compatibilidade" : fallbackOffer ? "Avaliação conservadora" : "Possibilidade relevante",
    title: `${best.service.name} pode fazer sentido`,
    reason: explanation(best, entries),
    matchedSignals: best.matchedSignals,
    strongEvidence: best.strongEvidence,
  };
}
