import { describe, expect, it } from "vitest";

import type { AISetupSession, ExtractedBusinessSource } from "@/features/ai-setup/ai-setup.schema";
import { deterministicCommercialArchitecture } from "@/features/ai-setup/commercial-architecture";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import {
  mergeProjectCommercialContexts,
  projectCommercialContextFromActivation,
  reconcileOperationalProjectContext,
} from "@/features/commercial-context/project-commercial-context";
import { CompositionOrchestrator } from "@/features/composition/composition-orchestrator";
import type { Project } from "@/types";
import { ProjectCommercialContextRepository } from "@/server/commercial-context/project-commercial-context-repository";
import { ProjectCommercialContextService } from "@/server/commercial-context/project-commercial-context-service";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";

const now = "2026-08-26T12:00:00.000Z";
const actor: AuthenticatedActor = { userId: "owner", email: "owner@sobe.test", workspaceId: "workspace", role: "owner", persistence: "memory", mode: "workspace" };

function profile(description: string) {
  return new RuleBasedBusinessAnalyzer().analyze({ businessName: "Negócio", businessDescription: description, primaryGoal: "Converter", primaryDestination: "WhatsApp", slug: "negocio" });
}

function source(input: Partial<ExtractedBusinessSource> = {}): ExtractedBusinessSource {
  return {
    summary: "Fonte oficial",
    facts: [], services: [], products: [], categories: [], schedules: [], prices: [], locations: [], openingHours: [], contacts: [], policies: [], accommodations: [], reservableUnits: [], frequentlyAskedQuestions: [], brandStatements: [], destinations: [], detectedLinks: [], warnings: [],
    ...input,
  };
}

async function fixture(description: string, input: { phone?: string; sources?: ExtractedBusinessSource[] } = {}) {
  const architecture = deterministicCommercialArchitecture({ businessName: "Casa Contexto", businessDescription: description, phone: input.phone, profile: profile(description), sources: input.sources });
  const project = await new CompositionOrchestrator(undefined, undefined, undefined, undefined, undefined, architecture).compose({ businessName: "Casa Contexto", businessDescription: description, primaryGoal: architecture.intents[0]?.label || "Continuar", primaryDestination: input.phone ? "WhatsApp" : "Site", slug: "casa-contexto", phone: input.phone });
  const session: AISetupSession = {
    id: crypto.randomUUID(), workspaceId: "workspace", status: "review",
    initialInput: { businessName: "Casa Contexto", description, phone: input.phone },
    extractedProfile: profile(description), commercialArchitecture: architecture, architectureReviewed: true,
    visitorActions: [], actionsConfirmed: true, answers: {}, missingRequirements: [], questions: [], sources: [], projectDraft: project,
    usedFallback: false, createdAt: now, updatedAt: now,
  };
  return { architecture, project, session };
}

describe("ProjectCommercialContext", () => {
  it("materializa a Activation em memória durável por projeto e referencia entidades operacionais", async () => {
    const { architecture, project, session } = await fixture("Vendemos produtos e recebemos pedidos pelo WhatsApp.", { phone: "5511999999999" });
    const context = projectCommercialContextFromActivation({ projectId: project.id, project, session, now });
    expect(context.projectId).toBe(project.id);
    expect(context.revision).toBe(1);
    expect(context.lastConfirmedAt).toBe(now);
    expect(context.intentContexts.map((item) => item.id)).toEqual(architecture.intents.map((item) => item.id));
    expect(context.channelContexts[0]).toMatchObject({ status: "confirmed" });
    expect(context.channelContexts[0].destinationId).toBeTruthy();
    expect(JSON.stringify(context.channelContexts)).not.toContain("5511999999999");
    expect(context.evidence.some((item) => item.origin === "user")).toBe(true);
  });

  it("sobrevive à sessão de Activation e pode ser recuperado por uma nova instância do serviço", async () => {
    const { project, session } = await fixture("Vendemos produtos e recebemos pedidos pelo WhatsApp.", { phone: "5511999999999" });
    const repository = new ProjectCommercialContextRepository();
    const activationService = new ProjectCommercialContextService(repository);
    const saved = await activationService.materializeActivationContext(actor, session, project.id, project);
    const laterProjectService = new ProjectCommercialContextService(repository);
    const restored = await laterProjectService.get(actor, project.id);
    expect(restored).toEqual(saved);
    expect(restored?.intentContexts.length).toBeGreaterThan(0);
    expect(restored?.purchaseMechanisms.length).toBeGreaterThan(0);
  });

  it("não sobrescreve silenciosamente decisões confirmadas com uma nova inferência", async () => {
    const first = await fixture("Recebemos pedidos pelo WhatsApp.", { phone: "5511111111111" });
    const confirmed = projectCommercialContextFromActivation({ projectId: first.project.id, project: first.project, session: first.session, now });
    const second = await fixture("Recebemos pedidos por um novo WhatsApp.", { phone: "5522222222222" });
    const inferred = projectCommercialContextFromActivation({ projectId: first.project.id, project: { ...second.project, id: first.project.id }, session: { ...second.session, architectureReviewed: false }, current: confirmed, now: "2026-08-27T12:00:00.000Z" });
    const merged = mergeProjectCommercialContexts(confirmed, inferred, "generated");
    expect(merged.summary).toEqual(confirmed.summary);
    expect(merged.channelContexts.some((item) => item.id === confirmed.channelContexts[0].id && item.status === "confirmed")).toBe(true);
  });

  it("mantém divergências como proposta até uma decisão explícita", async () => {
    const { project, session } = await fixture("Recebemos pedidos pelo WhatsApp.", { phone: "5511111111111" });
    const repository = new ProjectCommercialContextRepository();
    const service = new ProjectCommercialContextService(repository);
    const current = await service.materializeActivationContext(actor, session, project.id, project);
    const proposedContext = { ...current, revision: current.revision + 1, summary: { ...current.summary, commercialModel: "Novo modelo sugerido pela fonte" }, updatedAt: "2026-08-27T12:00:00.000Z" };
    const proposal = await service.proposeUpdate(actor, { projectId: project.id, proposedContext, reason: "Uma fonte nova diverge do modelo confirmado." });
    expect((await service.get(actor, project.id))?.summary.commercialModel).toBe(current.summary.commercialModel);
    await service.rejectProposal(actor, project.id, proposal.id);
    expect((await service.get(actor, project.id))?.revision).toBe(current.revision);
  });

  it("sincroniza uma nova unidade sem apagar caminhos B2B e identifica intenções impactadas", async () => {
    const { project, session } = await fixture("Recebemos pedidos e também atendemos revendedores pelo comercial.", { phone: "5511999999999" });
    const current = projectCommercialContextFromActivation({ projectId: project.id, project, session, now });
    const resaleId = current.intentContexts.find((item) => item.semanticKey === "resale")?.id;
    const updatedProject: Project = {
      ...project,
      commercialConfig: {
        ...project.commercialConfig,
        routingDestinations: [...(project.commercialConfig?.routingDestinations || []), { id: "destination-sul", key: "destination-sul", type: "whatsapp", label: "WhatsApp Sul", value: "5533333333333" }],
        locations: [...(project.commercialConfig?.locations || []), { id: "location-sul", projectId: project.id, name: "Sul", countryCode: "BR", geocodingStatus: "pending", timezone: "America/Sao_Paulo", openingHours: [], supportsDelivery: false, supportsPickup: true, supportsInPerson: true, priority: 1, isActive: true, routingDestinationId: "destination-sul" }],
      },
    };
    const result = reconcileOperationalProjectContext(current, updatedProject, "2026-08-27T12:00:00.000Z");
    expect(result.changedLocationIds).toEqual(["location-sul"]);
    expect(result.context.locationContexts.find((item) => item.locationId === "location-sul")?.destinationIds).toEqual(["destination-sul"]);
    expect(result.context.intentContexts.some((item) => item.id === resaleId)).toBe(true);
  });

  it("usa booking externo de hotel sem inventar reserva ou disponibilidade nativa", async () => {
    const description = "Pousada com acomodações. O hóspede pode consultar disponibilidade e reservar.";
    const { architecture } = await fixture(description, { sources: [source({ detectedLinks: [{ url: "https://booking.example.com/pousada", label: "Reservar agora", classification: "scheduling", external: true }] })] });
    const reservation = architecture.journeyBlueprints.find((item) => architecture.intents.find((intent) => intent.id === item.intentId)?.semanticKey === "reserve");
    expect(reservation?.mode).toBe("direct_external");
    expect(reservation?.steps).toHaveLength(0);
    expect(reservation?.completion.destinationStrategy).toBe("external_url");
  });

  it("transforma reserva via WhatsApp em solicitação estruturada, sem prometer disponibilidade", async () => {
    const description = "Hospedagem que recebe solicitações de reserva pelo WhatsApp.";
    const { architecture } = await fixture(description, { phone: "5511999999999" });
    const reservation = architecture.journeyBlueprints.find((item) => architecture.intents.find((intent) => intent.id === item.intentId)?.semanticKey === "reserve");
    expect(reservation?.mode).toBe("hybrid");
    expect(reservation?.steps[0].expectedCapability).toBeNull();
    expect(reservation?.steps[0].collects).toEqual(["Data de entrada", "Data de saída", "Quantidade de hóspedes"]);
    expect(reservation?.completion.handoffSummary).toBe(true);
  });

  it("representa venda assistida de veículos como qualificação genérica, sem template de nicho", async () => {
    const description = "Veículos disponíveis: SUV; Sedan; Hatch. Ajudamos o visitante a escolher a melhor opção antes de falar com um vendedor pelo WhatsApp.";
    const { architecture } = await fixture(description, { phone: "5511999999999" });
    const recommendation = architecture.journeyBlueprints.find((item) => architecture.intents.find((intent) => intent.id === item.intentId)?.semanticKey === "recommendation");
    expect(recommendation?.mode).toBe("qualification");
    expect(recommendation?.steps[0].expectedCapability).toBe("qualification");
    expect(architecture.issues.join(" ").toLowerCase()).not.toContain("concessionária");
  });

  it("alterar apenas a identidade visual não muda relações comerciais", async () => {
    const { project, session } = await fixture("Vendemos produtos e recebemos pedidos pelo WhatsApp.", { phone: "5511999999999" });
    const before = projectCommercialContextFromActivation({ projectId: project.id, project, session, now });
    const after = projectCommercialContextFromActivation({ projectId: project.id, project: { ...project, visualDirection: "Nova direção", designSystem: { ...project.designSystem, colors: { ...project.designSystem.colors, primary: "#123456" } } }, session, now });
    expect(after.intentContexts).toEqual(before.intentContexts);
    expect(after.purchaseMechanisms).toEqual(before.purchaseMechanisms);
    expect(after.channelContexts).toEqual(before.channelContexts);
  });
});
