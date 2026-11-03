import { describe, expect, it } from "vitest";

import { findDemoProject } from "@/data/demo-projects";
import { buildJourneyHandoff } from "@/features/handoff/journey-handoff";
import { getProjectReadiness } from "@/features/publishing/project-readiness";
import { buildRecommendationHandoff } from "@/features/qualification/recommendation-handoff";
import { resolveRoute } from "@/features/routing/routing-engine";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "@/features/whatsapp/whatsapp";
import { projectHasUsableWhatsApp, resolveWhatsAppTarget, whatsappActionHasUsableDestination, whatsappRoutingModel } from "@/features/whatsapp/whatsapp-destination";
import { projectWhatsAppNumbers, updateProjectWhatsAppNumbers, whatsappNumberErrors } from "@/features/whatsapp/project-whatsapp-numbers";
import type { BusinessLocation, Project, StepOption } from "@/types";

const routedOption: StepOption = {
  id: "whatsapp",
  label: "Confirmar no WhatsApp",
  value: "whatsapp",
  actionType: "open_whatsapp",
  actionPayload: { routing: true, completionType: "whatsapp" },
};

function unit(id: string, whatsapp?: string): BusinessLocation {
  return {
    id,
    projectId: "project",
    name: `Unidade ${id}`,
    countryCode: "BR",
    geocodingStatus: "pending",
    whatsapp,
    timezone: "America/Sao_Paulo",
    openingHours: [],
    supportsDelivery: true,
    supportsPickup: true,
    supportsInPerson: true,
    priority: 1,
    isActive: true,
  };
}

function routedProject(phones: Array<string | undefined>, mainPhone?: string): Project {
  const project = structuredClone(findDemoProject("casadesucosmix")!);
  project.phone = mainPhone;
  project.steps = [{ id: "start", type: "action", title: "Finalizar", order: 0, isActive: true, options: [routedOption] }];
  project.conversionGoals = [{ id: "goal", projectId: project.id, name: "Contato", kind: "contact", targetStepId: "start", isPrimary: true, isActive: true, order: 0 }];
  project.capabilities = [];
  project.dataRequirements = [{ id: "old", key: "contact.whatsapp", label: "WhatsApp", capability: "project", status: "missing", severity: "blocking", reason: "Pendência antiga" }];
  project.presence = undefined;
  project.commercialConfig = { locations: phones.map((phone, index) => unit(String(index + 1), phone)), routingDestinations: [], routingRules: [] };
  return project;
}

describe("WhatsApp sem API na publicação", () => {
  it("aceita e encaminha quatro números informados diretamente nas unidades", () => {
    const project = routedProject(["+55 (11) 98888-0001", "5511988880002", "5511988880003", "5511988880004"]);
    expect(whatsappActionHasUsableDestination(project, routedOption)).toBe(true);
    const model = whatsappRoutingModel(project);
    for (const [index, location] of model.locations.entries()) {
      const result = resolveRoute({ location_id: location.id }, [], model.destinations, model.fallbackDestinationId, model.locations, "whatsapp");
      expect(result.destination?.value).toBe(`551198888000${index + 1}`);
    }
    expect(getProjectReadiness(project).blocking.some((item) => item.key === "contact.whatsapp")).toBe(false);
  });

  it("usa o número principal como destino geral quando uma unidade não possui número próprio", () => {
    const project = routedProject([undefined, undefined, undefined, undefined], "+55 (11) 97777-1234");
    expect(projectHasUsableWhatsApp(project)).toBe(true);
    expect(getProjectReadiness(project).blocking.some((item) => item.key === "contact.whatsapp")).toBe(false);
  });

  it("respeita o número específico escolhido no CTA", () => {
    const project = routedProject([], "+55 (11) 96666-4321");
    project.commercialConfig = {
      routingDestinations: [{ id: "old", key: "old", type: "whatsapp", label: "WhatsApp antigo", value: "5511955550000", isDefault: true, role: "general_contact" }],
      locations: [],
      routingRules: [],
    };
    const target = resolveWhatsAppTarget(project, { destinationId: "old", phone: "5511944440000" });
    const model = whatsappRoutingModel(project);
    expect(target).toMatchObject({ phone: "5511955550000", source: "destination", destination: { id: "old" } });
    expect(model.destinations.find((item) => item.id === "old")?.value).toBe("5511966664321");
  });

  it("usa o principal quando o CTA não escolhe um destino específico", () => {
    const project = routedProject([], "+55 (11) 96666-4321");
    expect(resolveWhatsAppTarget(project, {})).toMatchObject({ phone: "5511966664321", source: "project" });
  });

  it("mantém vários WhatsApps e sincroniza o principal com o telefone do projeto", () => {
    const project = routedProject([], "+55 (11) 96666-4321");
    const current = projectWhatsAppNumbers(project);
    const updated = updateProjectWhatsAppNumbers(project, [
      { ...current[0], isDefault: false },
      { id: "00000000-0000-4000-8000-000000000002", key: "whatsapp-vendas", type: "whatsapp", label: "Vendas", value: "+55 (21) 98888-0000", isDefault: true, role: "general_contact" },
    ]);
    const numbers = projectWhatsAppNumbers(updated);

    expect(numbers).toHaveLength(2);
    expect(numbers.find((item) => item.isDefault)).toMatchObject({ label: "Vendas", value: "+55 (21) 98888-0000" });
    expect(updated.phone).toBe("+55 (21) 98888-0000");
  });

  it("impede o cadastro duplicado mesmo com formatações diferentes", () => {
    const project = routedProject([], "+55 (11) 96666-4321");
    const current = projectWhatsAppNumbers(project)[0];
    const duplicate = { ...current, id: "00000000-0000-4000-8000-000000000003", key: "whatsapp-suporte", label: "Suporte", value: "5511966664321", isDefault: false };

    expect(whatsappNumberErrors([current, duplicate])).toMatchObject({
      [current.id]: { phone: "Este número já está cadastrado." },
      [duplicate.id]: { phone: "Este número já está cadastrado." },
    });
  });

  it("mantém o número específico da unidade acima do WhatsApp principal", () => {
    const project = routedProject(["5511988880001"], "5511966664321");
    expect(resolveWhatsAppTarget(project, { locationId: "1", phone: "5511944440000" })).toMatchObject({ phone: "5511988880001", source: "location" });
  });

  it("mantém o bloqueio quando falta número de uma unidade e não existe contato principal", () => {
    const project = routedProject(["5511988880001", "5511988880002", "5511988880003", undefined]);
    expect(whatsappActionHasUsableDestination(project, routedOption)).toBe(false);
    expect(getProjectReadiness(project).blocking.some((item) => item.key === "contact.whatsapp")).toBe(true);
  });

  it("leva todas as respostas da jornada para a mensagem de confirmação", () => {
    const fields = [
      { id: "flavor", key: "flavor", label: "Sabor", type: "text" as const, required: true, includeInHandoff: false },
      { id: "date", key: "date", label: "Data desejada", type: "date" as const, required: true, includeInHandoff: false },
      { id: "quantity", key: "quantity", label: "Quantidade", type: "number" as const, required: true, includeInHandoff: false },
      { id: "notes", key: "notes", label: "Observações", type: "textarea" as const, required: false, includeInHandoff: false },
    ];
    const answers = { flavor: "Cupuaçu", date: "2026-09-20", quantity: 12, notes: "Sem açúcar" };
    const journey = buildJourneyHandoff({
      fields,
      answers,
      includeAll: true,
      selectedLocation: { id: "golden", name: "Golden Shop" },
      selections: [{ stepId: "occasion", stepTitle: "Para qual ocasião?", optionId: "corporate", optionLabel: "Evento empresarial" }],
    });
    const recommendation = buildRecommendationHandoff({ fields, answers, serviceName: "Encomenda", confidence: "clear" });
    const message = buildWhatsAppMessage({ greeting: "Olá, quero concluir meu pedido.", businessName: "Casa de Sucos", interest: "Confirmar encomenda", location: journey.location, answers: { ...journey.answers, orientação_recebida: recommendation.answers.orientação_recebida }, items: [{ name: "Combo detox", quantity: 2 }] });
    expect(journey.answers).toEqual({ Sabor: "Cupuaçu", "Data desejada": "20/09/2026", Quantidade: "12", Observações: "Sem açúcar", "Para qual ocasião?": "Evento empresarial" });
    expect(recommendation.answers.contexto_informado).toContain("Observações: Sem açúcar");
    const decodedUrl = decodeURIComponent(buildWhatsAppUrl("+55 (11) 97777-1234", message));
    expect(decodedUrl).toContain("*Resumo da jornada*");
    expect(decodedUrl).toContain("• Data desejada: 20/09/2026");
    expect(decodedUrl).toContain("• Para qual ocasião? Evento empresarial");
    expect(decodedUrl).toContain("*Pedido*\n• 2x Combo detox");
    expect(decodedUrl).toContain("Orientação recebida: Encomenda foi indicada");
  });
});
