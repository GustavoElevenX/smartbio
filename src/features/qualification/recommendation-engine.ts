import type { JourneyMode, ServiceOffering } from "@/types";

const stopwords = new Set([
  "a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "em",
  "mais", "o", "os", "para", "por", "que", "um", "uma", "no", "na", "nos", "nas",
  "meu", "minha", "meus", "minhas", "quero", "gostaria", "preciso", "esta", "estao", "nao",
]);

interface ContextualSignalProfile {
  contextTerms?: string[];
  offerTerms: string[];
  signals: string[];
  strongSignals?: string[];
  subject?: string;
}

// Relações semânticas só são ativadas quando o catálogo e o contexto do projeto
// sustentam o domínio. Elas enriquecem sinais; nunca são usadas para escrever copy.
const contextualProfiles: ContextualSignalProfile[] = [
  { contextTerms: ["automot", "veiculo", "carro", "farol", "pintura automotiva"], offerTerms: ["higienizacao", "limpeza interna"], signals: ["manchas ou odor no interior", "sujeira em bancos ou carpetes", "limpeza da parte interna"], subject: "o veículo" },
  { contextTerms: ["automot", "veiculo", "carro", "farol"], offerTerms: ["polimento"], signals: ["pintura perdeu o brilho", "marcas superficiais na pintura", "recuperar a aparência da pintura"], subject: "o veículo" },
  { contextTerms: ["automot", "veiculo", "carro", "farol"], offerTerms: ["vitrificacao", "protecao da pintura"], signals: ["proteger a pintura", "conservar a pintura", "preservar o acabamento"], subject: "o veículo" },
  { contextTerms: ["automot", "veiculo", "carro", "farol"], offerTerms: ["lavagem"], signals: ["sujeira externa", "limpeza geral do veículo", "cuidado externo"], subject: "o veículo" },
  { contextTerms: ["automot", "veiculo", "carro", "farol"], offerTerms: ["farol"], signals: ["faróis opacos", "faróis amarelados", "recuperar a transparência dos faróis"], subject: "o veículo" },
  { contextTerms: ["evento", "festa", "casamento", "celebracao", "cerimonia"], offerTerms: ["infantil", "crianca"], signals: ["aniversário de criança", "festa para crianças", "celebração infantil"], subject: "o evento" },
  { contextTerms: ["evento", "festa", "casamento", "celebracao", "cerimonia"], offerTerms: ["casamento", "cerimonia"], signals: ["celebração de casamento", "cerimônia e recepção", "evento para noivos"], subject: "o evento" },
  { contextTerms: ["evento", "festa", "casamento", "celebracao", "cerimonia"], offerTerms: ["corporativo", "empresarial"], signals: ["encontro da empresa", "evento para a equipe", "confraternização corporativa"], subject: "o evento" },
  { contextTerms: ["evento", "festa", "casamento", "celebracao", "cerimonia"], offerTerms: ["mini wedding", "intimista"], signals: ["casamento pequeno e intimista", "poucos convidados", "mini wedding"], subject: "o evento" },
  { contextTerms: ["evento", "festa", "casamento", "celebracao", "cerimonia"], offerTerms: ["locacao", "apenas o espaco"], signals: ["somente o espaço", "organizar os demais detalhes separadamente", "locação do local"], subject: "o evento" },
  { contextTerms: ["idioma", "ingles", "escola de linguas", "curso de linguas"], offerTerms: ["viagem", "turismo"], signals: ["usar o idioma em viagem", "conversação em aeroporto ou hotel", "viajar com mais autonomia"], subject: "o uso do idioma" },
  { contextTerms: ["idioma", "ingles", "escola de linguas", "curso de linguas"], offerTerms: ["negocios", "profissional", "executivo"], signals: ["usar o idioma no trabalho", "reuniões e apresentações profissionais", "comunicação com empresas"], subject: "o uso do idioma" },
  { contextTerms: ["idioma", "ingles", "escola de linguas", "curso de linguas"], offerTerms: ["iniciante", "basico"], signals: ["começar do início", "primeiros passos no idioma", "ainda sem experiência"], subject: "o uso do idioma" },
  { contextTerms: ["interiores", "arquitetura", "decoracao", "ambiente"], offerTerms: ["um ambiente", "um comodo"], signals: ["renovar um ambiente", "projeto para um cômodo", "orientação para um espaço da casa"], strongSignals: ["renovar um ambiente da casa", "projeto de apenas um cômodo"], subject: "o ambiente" },
  { contextTerms: ["interiores", "arquitetura", "decoracao", "ambiente"], offerTerms: ["projeto completo", "apartamento", "casa completa"], signals: ["projeto completo do imóvel", "vários ambientes da casa", "apartamento inteiro"], subject: "o ambiente" },
  { contextTerms: ["climatizacao", "ar condicionado", "refrigeracao", "aparelho de ar"], offerTerms: ["higienizacao", "limpeza"], signals: ["cheiro ruim no aparelho", "sem limpeza há muito tempo", "sujeira no equipamento"], strongSignals: ["aparelho funciona e gela mas tem cheiro ruim", "equipamento sem limpeza há muito tempo"], subject: "o aparelho de ar-condicionado" },
  { contextTerms: ["climatizacao", "ar condicionado", "refrigeracao", "aparelho de ar"], offerTerms: ["baixo rendimento", "refrigeracao", "avaliacao", "diagnostico"], signals: ["refrigera menos que antes", "liga mas não gela normalmente", "perda de rendimento"], strongSignals: ["aparelho liga mas refrigera menos que antes", "não gela como antes"], subject: "o aparelho de ar-condicionado" },
  { contextTerms: ["climatizacao", "ar condicionado", "refrigeracao", "aparelho de ar"], offerTerms: ["manutencao preventiva"], signals: ["acompanhamento preventivo dos equipamentos", "manutenção regular", "equipamentos da empresa"], subject: "o aparelho de ar-condicionado" },
  { contextTerms: ["bicicleta", "bike", "ciclismo", "freio", "cambio"], offerTerms: ["freio"], signals: ["freio fazendo ruído", "dificuldade para frear", "freio desregulado"], strongSignals: ["freio não responde normalmente", "dificuldade para frear"], subject: "a bicicleta" },
  { contextTerms: ["bicicleta", "bike", "ciclismo", "freio", "cambio"], offerTerms: ["cambio", "marcha"], signals: ["marchas pulam", "dificuldade para trocar as marchas", "câmbio desregulado"], strongSignals: ["marchas pulam e há dificuldade para trocar", "não consegue trocar as marchas"], subject: "a bicicleta" },
  { contextTerms: ["bicicleta", "bike", "ciclismo", "freio", "cambio"], offerTerms: ["pneu", "camara"], signals: ["pneu furado", "câmara furada", "pneu desgastado"], strongSignals: ["pneu ou câmara furada", "pneu precisa ser trocado"], subject: "a bicicleta" },
  { contextTerms: ["bicicleta", "bike", "ciclismo", "freio", "cambio"], offerTerms: ["revisao completa"], signals: ["vários pontos precisam de revisão", "manutenção geral da bicicleta", "revisão completa"], subject: "a bicicleta" },
];

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
  return new Set(tokenList(value).flatMap((token) => [token, stem(token)]));
}

function matchesAny(value: string, terms: string[]) {
  const normalized = normalize(value);
  return terms.some((term) => normalized.includes(normalize(term)));
}

function profilesFor(name: string, description: string, context: string) {
  const offer = `${name} ${description}`;
  return contextualProfiles.filter((profile) =>
    matchesAny(offer, profile.offerTerms)
    && (!profile.contextTerms?.length || matchesAny(context, profile.contextTerms)),
  );
}

function objectFromOperation(name: string, operation: RegExp) {
  const match = normalize(name).match(operation);
  return match?.[1]?.trim() || "o item";
}

function genericOperationSignals(name: string) {
  const normalized = normalize(name);
  if (/\binstalacao\b|\binstalar\b/.test(normalized)) {
    const object = objectFromOperation(name, /(?:instalacao|instalar)(?:\s+de)?\s+(.+)/);
    return {
      signals: [`${object} novo`, `${object} ainda não instalado`, `colocar ${object} em funcionamento`],
      strongSignals: [`${object} novo e ainda não instalado`, "nunca instalado", "colocar em funcionamento"],
    };
  }
  if (/\bmontagem\b|\bmontar\b/.test(normalized)) {
    const object = objectFromOperation(name, /(?:montagem|montar)(?:\s+de)?\s+(.+)/);
    const baseObject = object.replace(/\s+nov[oa]$/, "");
    return {
      signals: [`${object} desmontado`, `${baseObject} desmontada`, `precisa montar ${object}`, `${object} comprado desmontado`],
      strongSignals: [`${baseObject} desmontada`, `${object} desmontado`, "comprado desmontado e precisa montar"],
    };
  }
  return { signals: [] as string[], strongSignals: [] as string[] };
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

function configuredSignals(service: ServiceOffering, key: "recommendationSignals" | "strongRecommendationSignals") {
  const value = service.settings?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

export function inferRecommendationSignals(name: string, description = "", context = "") {
  const profiles = profilesFor(name, description, context);
  const operation = genericOperationSignals(name);
  return unique([
    ...profiles.flatMap((profile) => profile.signals),
    ...operation.signals,
    ...tokenList(`${name} ${description}`),
  ]).slice(0, 30);
}

export function inferStrongRecommendationSignals(name: string, description = "", context = "") {
  const profiles = profilesFor(name, description, context);
  const operation = genericOperationSignals(name);
  return unique([...profiles.flatMap((profile) => profile.strongSignals || []), ...operation.strongSignals]).slice(0, 12);
}

export function inferRecommendationSubject(context: string) {
  return contextualProfiles.find((profile) => profile.subject && profile.contextTerms && matchesAny(context, profile.contextTerms))?.subject;
}

export function conservativeServiceDescription(name: string) {
  const normalized = name.trim().replace(/[.!?]+$/g, "");
  if (/^(?:instalação|montagem|ajuste|troca|revisão|manutenção|higienização|limpeza|avaliação|revitalização|polimento|vitrificação)\b/i.test(normalized)) {
    return `Serviço de ${normalized.toLocaleLowerCase("pt-BR")}.`;
  }
  return `${normalized}: opção oferecida pelo negócio, com detalhes confirmados pela equipe.`;
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

function evidenceFor(service: ServiceOffering, entries: ReturnType<typeof answerEntries>) {
  const serviceTokens = semanticTokens(`${service.name} ${service.shortDescription || ""} ${service.description || ""} ${configuredSignals(service, "recommendationSignals").join(" ")}`);
  return entries
    .map((entry) => ({ ...entry, overlap: [...semanticTokens(entry.value)].filter((token) => serviceTokens.has(token)).length }))
    .filter((entry) => entry.overlap > 0)
    .toSorted((a, b) => b.overlap - a.overlap)
    .slice(0, 2);
}

function explanation(service: ServiceOffering, entries: ReturnType<typeof answerEntries>) {
  const evidence = evidenceFor(service, entries);
  const stated = evidence.map((item) => item.value.replace(/[.!?]+$/g, "")).join("; ").slice(0, 220);
  const supported = service.shortDescription || service.description;
  if (stated && supported) return `Você indicou ${stated}. ${supported}`;
  if (stated) return `Você indicou ${stated}, e essa é a opção disponível mais relacionada a esse contexto.`;
  if (supported) return `Entre as opções disponíveis, esta é a mais relacionada às suas respostas. ${supported}`;
  return "Entre as opções disponíveis, esta parece a mais relacionada ao contexto informado. A equipe pode confirmar o escopo antes de você decidir.";
}

function signalMatch(signal: string, answerTokens: Set<string>) {
  const tokens = semanticTokens(signal);
  const matched = [...tokens].filter((token) => answerTokens.has(token));
  return { tokenCount: matched.length, phrase: tokens.size >= 2 && matched.length === tokens.size };
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
  const ranked = active.map((service) => {
    const exact = normalizedAnswers.includes(normalize(service.name));
    const signals = configuredSignals(service, "recommendationSignals");
    const strongSignals = configuredSignals(service, "strongRecommendationSignals");
    const serviceTokens = semanticTokens(`${service.name} ${service.shortDescription || ""} ${service.description || ""} ${signals.join(" ")}`);
    const matchedSignals = [...serviceTokens].filter((token) => answerTokens.has(token));
    const phraseMatches = signals.map((signal) => signalMatch(signal, answerTokens)).filter((match) => match.phrase).length;
    const strongMatches = strongSignals.map((signal) => signalMatch(signal, answerTokens));
    const strongPhraseMatches = strongMatches.filter((match) => match.phrase).length;
    const strongTokenMatches = Math.max(0, ...strongMatches.map((match) => match.tokenCount));
    const strongEvidence = strongPhraseMatches > 0 || strongTokenMatches >= 3;
    const strongScore = strongEvidence ? strongPhraseMatches * 14 + strongTokenMatches * 4 : 0;
    const score = matchedSignals.length * 3 + phraseMatches * 5 + strongScore + (exact ? journeyMode === "explicit_choice" ? 100 : 4 : 0) + (service.isFeatured ? 0.01 : 0);
    return { service, score, matchedSignals, strongEvidence };
  }).toSorted((a, b) => b.score - a.score || a.service.order - b.service.order);
  const best = ranked[0];
  const runnerUp = ranked[1];

  if (!best || best.score < 6) {
    return {
      confidence: "uncertain",
      label: "Orientação inicial",
      title: "Vale conversar com a equipe antes de escolher",
      reason: "Suas respostas ajudam a preparar a conversa, mas ainda não apontam com segurança para uma única opção.",
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
      reason: "As respostas ainda se relacionam com mais de uma opção. A equipe pode avaliar o contexto antes de indicar um caminho.",
    };
  }
  const confidence: RecommendationConfidence = best.strongEvidence || (best.score >= 12 && lead >= 3) ? "clear" : "possible";
  return {
    service: best.service,
    confidence,
    label: confidence === "clear" ? "Boa compatibilidade" : "Possibilidade relevante",
    title: `${best.service.name} pode fazer sentido`,
    reason: explanation(best.service, entries),
    matchedSignals: best.matchedSignals,
    strongEvidence: best.strongEvidence,
  };
}
