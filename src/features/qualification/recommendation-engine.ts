import type { JourneyMode, ServiceOffering } from "@/types";

const stopwords = new Set([
  "a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "em",
  "mais", "o", "os", "para", "por", "que", "um", "uma", "no", "na", "nos", "nas",
  "meu", "minha", "meus", "minhas", "quero", "gostaria", "preciso", "esta", "estao",
]);

interface SemanticConcept {
  terms: string[];
  signals: string[];
  description?: string;
}

// Vocabulário transversal de necessidades. Ele enriquece descrições confirmadas,
// mas nunca adiciona preço, prazo, garantia ou procedimento técnico.
const semanticConcepts: SemanticConcept[] = [
  { terms: ["higienizacao", "higienizar"], signals: ["odor", "cheiro", "mancha", "sujeira interna", "interior", "banco", "carpete", "estofado"], description: "Limpeza mais profunda da parte interna para cuidar de bancos, carpetes e superfícies." },
  { terms: ["polimento", "polir"], signals: ["pintura sem brilho", "perda de brilho", "marca superficial", "risco leve", "recuperacao estetica da pintura"], description: "Cuidado estético da pintura para situações de perda de brilho e marcas superficiais." },
  { terms: ["vitrificacao", "vitrificar", "protecao da pintura"], signals: ["proteger pintura", "protecao", "conservar pintura", "preservar pintura"], description: "Opção de cuidado voltada à proteção e conservação da pintura." },
  { terms: ["lavagem", "lavar"], signals: ["sujeira externa", "limpeza externa", "cuidado geral", "veiculo sujo"], description: "Limpeza cuidadosa da parte externa para a manutenção geral do veículo." },
  { terms: ["farol", "farois", "revitalizacao de farol"], signals: ["farol opaco", "farol amarelado", "amarelado", "opaco", "transparencia do farol"], description: "Cuidado direcionado a faróis com aparência opaca ou amarelada." },
  { terms: ["infantil", "crianca", "aniversario infantil"], signals: ["crianca", "aniversario", "familia", "festa infantil"], description: "Formato de evento pensado para celebrações infantis e seus convidados." },
  { terms: ["casamento", "cerimonia", "noivos"], signals: ["casamento", "cerimonia", "noivos", "recepcao"], description: "Formato de evento relacionado à celebração de casamento." },
  { terms: ["corporativo", "empresa", "empresarial"], signals: ["empresa", "equipe", "confraternizacao", "reuniao corporativa"], description: "Formato para encontros, celebrações e necessidades de empresas ou equipes." },
  { terms: ["mini wedding", "casamento intimista"], signals: ["evento pequeno", "poucos convidados", "intimo", "intimista", "mini wedding"], description: "Formato de celebração de casamento para uma proposta menor e mais intimista." },
  { terms: ["locacao", "aluguel", "apenas o espaco"], signals: ["somente espaco", "apenas local", "estrutura", "salao", "locacao do espaco"], description: "Locação do espaço para quem deseja organizar os demais detalhes separadamente." },
  { terms: ["viagem", "turismo"], signals: ["viajar", "aeroporto", "hotel", "turismo", "conversacao em viagem"], description: "Opção relacionada a necessidades práticas de viagem." },
  { terms: ["negocios", "profissional", "executivo"], signals: ["trabalho", "reuniao", "carreira", "apresentacao profissional", "empresa"], description: "Opção voltada a contextos profissionais e de negócios." },
  { terms: ["iniciante", "introducao", "basico"], signals: ["comecar", "primeiros passos", "sem experiencia", "iniciante", "basico"], description: "Opção de entrada para quem está começando nesse tema." },
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
    .replace(/(?:coes|cao|mente|amentos|imento|idades|idade)$/g, "")
    .replace(/(?:ados|adas|idos|idas|ando|endo|indo|ais|eis|oes)$/g, "")
    .replace(/s$/g, "");
}

function semanticTokens(value: string) {
  const normalized = normalize(value);
  const values = new Set(tokenList(normalized).flatMap((token) => [token, stem(token)]));
  for (const concept of semanticConcepts) {
    if (concept.terms.some((term) => normalized.includes(normalize(term)))) {
      for (const signal of [...concept.terms, ...concept.signals]) {
        for (const token of tokenList(signal)) values.add(stem(token));
      }
    }
  }
  return values;
}

function answerEntries(answers: Record<string, unknown>) {
  return Object.entries(answers).flatMap(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];
    return values.map((item) => ({ key, value: String(item ?? "").trim() })).filter((item) => item.value);
  });
}

function configuredSignals(service: ServiceOffering) {
  const value = service.settings?.recommendationSignals;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

export function inferRecommendationSignals(name: string, description = "") {
  const source = normalize(`${name} ${description}`);
  const signals = semanticConcepts
    .filter((concept) => concept.terms.some((term) => source.includes(normalize(term))))
    .flatMap((concept) => concept.signals);
  return [...new Set([...signals, ...tokenList(`${name} ${description}`)])].slice(0, 24);
}

export function conservativeServiceDescription(name: string, businessContext = "") {
  const source = normalize(`${name} ${businessContext}`);
  const concept = semanticConcepts.find((candidate) => candidate.terms.some((term) => source.includes(normalize(term))));
  return concept?.description || `Atendimento relacionado a ${name.toLocaleLowerCase("pt-BR")}, com o escopo confirmado pela equipe.`;
}

export type RecommendationConfidence = "clear" | "possible" | "uncertain";

export interface ServiceRecommendation {
  service?: ServiceOffering;
  confidence: RecommendationConfidence;
  label: string;
  title: string;
  reason: string;
  matchedSignals?: string[];
}

function evidenceFor(service: ServiceOffering, entries: ReturnType<typeof answerEntries>) {
  const serviceTokens = semanticTokens(`${service.name} ${service.shortDescription || ""} ${service.description || ""} ${configuredSignals(service).join(" ")}`);
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
    const signals = configuredSignals(service);
    const serviceTokens = semanticTokens(`${service.name} ${service.shortDescription || ""} ${service.description || ""} ${signals.join(" ")}`);
    const matchedSignals = [...serviceTokens].filter((token) => answerTokens.has(token));
    const phraseMatches = signals.filter((signal) => {
      const signalTokens = semanticTokens(signal);
      return signalTokens.size > 0 && [...signalTokens].every((token) => answerTokens.has(token));
    }).length;
    const score = matchedSignals.length * 3 + phraseMatches * 5 + (exact ? journeyMode === "explicit_choice" ? 100 : 4 : 0) + (service.isFeatured ? 0.01 : 0);
    return { service, score, matchedSignals };
  }).toSorted((a, b) => b.score - a.score || a.service.order - b.service.order);
  const best = ranked[0];
  const runnerUp = ranked[1];

  if (!best || best.score < 3) {
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
    };
  }

  const lead = best.score - (runnerUp?.score || 0);
  const confidence: RecommendationConfidence = best.score >= 12 && lead >= 3 ? "clear" : "possible";
  return {
    service: best.service,
    confidence,
    label: confidence === "clear" ? "Boa compatibilidade" : "Possibilidade relevante",
    title: `${best.service.name} pode fazer sentido`,
    reason: explanation(best.service, entries),
    matchedSignals: best.matchedSignals,
  };
}
