import { describe, expect, it } from "vitest";
import {
  activationUnderstandingFromCommercialArchitecture,
  capabilitiesFromCommercialArchitecture,
  commercialArchitectureFromActivationUnderstanding,
  deterministicCommercialArchitecture,
  normalizeCommercialArchitecture,
  requirementsFromCommercialArchitecture,
  visitorActionsFromCommercialArchitecture,
} from "@/features/ai-setup/commercial-architecture";
import type { AISetupSession, ExtractedBusinessSource } from "@/features/ai-setup/ai-setup.schema";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import { planAdaptiveQuestions } from "@/server/ai-setup/question-planner";
import { ContractActivationProvider } from "@/server/ai/activation-gate-fake-provider";
import { AISetupService } from "@/server/ai-setup/ai-setup-service";
import type { AISetupRepository } from "@/server/ai-setup/ai-setup-repository";
import { AISetupNotFoundError } from "@/server/ai-setup/ai-setup-errors";
import { setAIProviderForTests } from "@/server/ai/ai-client";
import type { AISetupActor } from "@/server/auth/setup-actor";

function profile(description: string) {
  return new RuleBasedBusinessAnalyzer().analyze({ businessName: "Negócio", businessDescription: description, primaryGoal: "Atender", primaryDestination: "WhatsApp", slug: "negocio" });
}

function source(input: Partial<ExtractedBusinessSource> = {}): ExtractedBusinessSource {
  return {
    summary: "Fonte comercial",
    facts: [], services: [], products: [], categories: [], schedules: [], prices: [], locations: [], openingHours: [], contacts: [], policies: [], accommodations: [], reservableUnits: [], frequentlyAskedQuestions: [], brandStatements: [], destinations: [], detectedLinks: [], warnings: [],
    ...input,
  };
}

function repositoryDouble() {
  const sessions = new Map<string, AISetupSession>();
  return {
    async create(_actor: AISetupActor, session: AISetupSession) { sessions.set(session.id, structuredClone(session)); return structuredClone(session); },
    async createIdempotent(_actor: AISetupActor, session: AISetupSession) { sessions.set(session.id, structuredClone(session)); return structuredClone(session); },
    async get(_actor: AISetupActor, id: string) { const session = sessions.get(id); return session ? structuredClone(session) : null; },
    async latestActive() { return null; },
    async update(_actor: AISetupActor, session: AISetupSession) { if (!sessions.has(session.id)) throw new AISetupNotFoundError("ausente"); sessions.set(session.id, structuredClone(session)); return structuredClone(session); },
    async addMessage() {},
  } as unknown as AISetupRepository;
}

describe("CommercialArchitecture context-first", () => {
  it("preserva o entendimento contextual legado como adaptador, com recomendação antes do contato", async () => {
    const description = "Produtos reais:\n- Opção A\n- Opção B\n- Opção C\nQueremos orientar antes do WhatsApp.";
    const provider = new ContractActivationProvider();
    const input = { input: { businessName: "Escolha Certa", businessDescription: description, primaryGoal: "Orientar", primaryDestination: "WhatsApp", slug: "escolha-certa", phone: "5511999999999" }, workspaceId: "workspace" };
    const understanding = await provider.analyzeActivationUnderstanding(input);
    const architecture = commercialArchitectureFromActivationUnderstanding(understanding, { businessName: "Escolha Certa", businessDescription: description, phone: "5511999999999", profile: profile(description) });
    expect(visitorActionsFromCommercialArchitecture(architecture)[0]).toMatchObject({ key: "recommendation", isPrimary: true });
    expect(activationUnderstandingFromCommercialArchitecture(architecture).offerings).toHaveLength(3);
  });

  it("deduplica intenções, mantém vínculo intent → blueprint e remove canais inexistentes de unidades", () => {
    const evidence = [{ sourceId: "user", origin: "user" as const, excerpt: "Pedido e unidade", confidence: 1 }];
    const architecture = normalizeCommercialArchitecture({
      status: "ready", confidence: 0.9,
      businessSummary: { whatItSells: "Produtos", commercialModel: "Pedidos por unidade", evidence },
      offerings: [], audienceContexts: [],
      channels: [{ id: "wa-a", type: "whatsapp", label: "WhatsApp A", value: "5511999999999", purpose: null, isFallback: false, evidence, confidence: 1 }],
      locations: [{ id: "loc-a", label: "Unidade A", address: null, channelIds: ["wa-a", "ausente"], evidence, confidence: 1 }],
      intents: [
        { id: "pedido", semanticKey: "order", label: "Fazer pedido", visitorNeed: "Pedir", priority: 100, visibleOnEntry: true, evidence, confidence: 0.9 },
        { id: "pedido-duplicado", semanticKey: "order", label: "Fazer pedido", visitorNeed: "Pedir", priority: 90, visibleOnEntry: true, evidence, confidence: 0.8 },
      ],
      journeyBlueprints: [{ id: "flow", intentId: "pedido", objective: "Pedir", mode: "routing", steps: [{ purpose: "Escolher unidade", expectedCapability: "routing", collects: [], usesOfferings: [], usesLocations: ["loc-a"] }], completion: { type: "whatsapp", channelId: "wa-a", destinationStrategy: "by_location", handoffSummary: true }, requiredFacts: [], assumptions: [], confidence: 0.9 }],
      issues: [],
    });
    expect(architecture.intents).toHaveLength(1);
    expect(architecture.journeyBlueprints[0].intentId).toBe(architecture.intents[0].id);
    expect(architecture.locations[0].channelIds).toEqual(["wa-a"]);
    expect(capabilitiesFromCommercialArchitecture(architecture).map((item) => item.key)).toEqual(["routing"]);
  });

  it("transforma cardápio real em caminho direto e mantém revenda em um caminho independente", () => {
    const description = "Vendemos produtos, recebemos encomendas e atendemos também revendedores pelo comercial.";
    const architecture = deterministicCommercialArchitecture({
      businessName: "Operação Mix",
      businessDescription: description,
      phone: "5511988887777",
      profile: profile(description),
      sources: [source({ detectedLinks: [
        { url: "https://menu.example.com", label: "Ver cardápio", classification: "menu", external: true },
        { url: "https://wa.me/5511977776666", label: "Comercial revenda", classification: "commercial_b2b", external: true },
      ] })],
    });
    const paths = architecture.journeyBlueprints.map((item) => ({ key: architecture.intents.find((intent) => intent.id === item.intentId)?.semanticKey, mode: item.mode }));
    expect(paths).toContainEqual({ key: "view_products", mode: "direct_external" });
    expect(paths.some((item) => item.key === "resale")).toBe(true);
    expect(new Set(architecture.journeyBlueprints.map((item) => item.intentId)).size).toBe(architecture.journeyBlueprints.length);
  });

  it("não cria a mesma arquitetura para negócios do mesmo nicho com operações diferentes", () => {
    const multi = "Clínica com várias unidades. O cliente escolhe a unidade e agenda o atendimento pelo WhatsApp.";
    const quoteFirst = "Clínica de unidade única. Antes de agendar, o cliente precisa pedir orçamento e enviar os detalhes.";
    const left = deterministicCommercialArchitecture({ businessName: "Clínica A", businessDescription: multi, phone: "5511911111111", profile: profile(multi) });
    const right = deterministicCommercialArchitecture({ businessName: "Clínica B", businessDescription: quoteFirst, phone: "5511922222222", profile: profile(quoteFirst) });
    expect(left.journeyBlueprints.map((item) => item.mode)).not.toEqual(right.journeyBlueprints.map((item) => item.mode));
    expect(visitorActionsFromCommercialArchitecture(left).map((item) => item.key)).not.toEqual(visitorActionsFromCommercialArchitecture(right).map((item) => item.key));
  });

  it("faz perguntas somente para requiredFacts ausentes e prioriza destino/unidade", () => {
    const description = "Atendimento por unidade.";
    const architecture = deterministicCommercialArchitecture({ businessName: "Rede", businessDescription: description, profile: profile(description), sources: [source({ locations: [{ name: "Centro", description: null, attributes: [] }, { name: "Norte", description: null, attributes: [] }] })] });
    const requirements = requirementsFromCommercialArchitecture(architecture, "session");
    const questions = planAdaptiveQuestions(requirements, {}, 3, {}, {}, architecture);
    expect(questions.length).toBeLessThanOrEqual(3);
    expect(questions.map((item) => item.key)).toEqual(requirements.slice(0, 3).map((item) => item.key));
    expect(questions.every((item) => item.reason.includes("altera o caminho"))).toBe(true);
  });

  it("confirma a interpretação inteira sem seleção manual de ações", async () => {
    process.env.ACTIVATION_GATE_FAKE_AI = "true";
    setAIProviderForTests(new ContractActivationProvider());
    const actor: AISetupActor = { userId: "owner", email: "owner@sobe.test", workspaceId: "workspace", role: "owner", persistence: "memory", mode: "workspace" };
    const service = new AISetupService(repositoryDouble());
    try {
      let session = await service.start(actor, { businessName: "Escolha Certa", description: "Produtos reais:\n- Opção A\n- Opção B\n- Opção C\nAjudamos o visitante a descobrir a melhor opção antes do WhatsApp.", phone: "5511999999999" });
      session = await service.analyze(actor, session.id);
      expect(session.commercialArchitecture?.journeyBlueprints.length).toBeGreaterThan(0);
      expect(session.architectureReviewed).toBe(false);
      expect(session.actionsConfirmed).toBe(false);
      session = await service.confirmCommercialArchitecture(actor, session.id);
      expect(session.architectureReviewed).toBe(true);
      expect(session.actionsConfirmed).toBe(true);
      expect(session.visitorActions[0]).toMatchObject({ key: "recommendation", confirmedByBusiness: true });
    } finally {
      delete process.env.ACTIVATION_GATE_FAKE_AI;
      setAIProviderForTests(undefined);
    }
  });
});
