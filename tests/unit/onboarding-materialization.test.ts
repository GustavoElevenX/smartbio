import { describe, expect, it } from "vitest";

import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { materializeSetupAnswers } from "@/features/ai-setup/materialize-setup-answers";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import { draftCapabilityRequirements } from "@/features/capabilities/capability-requirements";
import { RuleBasedExperienceComposer } from "@/features/composition/experience-composer";
import { getProjectReadiness } from "@/features/publishing/project-readiness";

const initialInput = {
  businessName: "Patas & Brilho Pet Care",
  description: "Pet shop de bairro com serviços de banho, tosa e hidratação. O cliente escolhe o serviço e solicita um horário pelo WhatsApp.",
  phone: "5511987654321",
};

function setupSession(): AISetupSession {
  const project = new RuleBasedExperienceComposer().compose({
    businessName: initialInput.businessName,
    businessDescription: initialInput.description,
    primaryGoal: "Criar uma jornada comercial",
    primaryDestination: "WhatsApp",
    slug: "patas-brilho-pet-care",
    phone: initialInput.phone,
  });
  const answers = {
    "quote.services": "Banho, tosa higiênica, tosa completa e hidratação",
    "quote.mode": "range",
    "quote.destination": "whatsapp",
    "quote.visitor": "Nome do tutor, WhatsApp, nome do pet, porte e serviço desejado",
    "scheduling.services": "Banho: 1 hora. Tosa higiênica: 1h30. Tosa completa: 2 horas.",
    "scheduling.availability": "Segunda a sábado, das 8h às 18h",
    "scheduling.destination": "manual_approval",
  };
  return {
    id: "setup-test",
    workspaceId: "local-workspace",
    status: "review",
    initialInput,
    visitorActions: [],
    actionsConfirmed: false,
    answers,
    missingRequirements: draftCapabilityRequirements(project.capabilities || []).map((requirement) => ({
      ...requirement,
      status: answers[requirement.key as keyof typeof answers] == null ? "missing" : "verified",
      value: answers[requirement.key as keyof typeof answers],
      origin: answers[requirement.key as keyof typeof answers] == null ? undefined : "user",
    })),
    questions: [],
    sources: [],
    usedFallback: true,
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
  };
}

describe("materialização do onboarding adaptativo", () => {
  it("transforma respostas verificadas em configuração publicável", () => {
    const session = setupSession();
    const base = new RuleBasedExperienceComposer().compose({
      businessName: initialInput.businessName,
      businessDescription: initialInput.description,
      primaryGoal: "Criar uma jornada comercial",
      primaryDestination: "WhatsApp",
      slug: "patas-brilho-pet-care",
      phone: initialInput.phone,
    });
    const project = materializeSetupAnswers(base, session);

    expect(project.commercialConfig?.quoteDefinition?.questions.map((field) => field.key)).toEqual(["servico", "quantidade", "detalhes"]);
    expect(project.commercialConfig?.schedulableServices).toHaveLength(3);
    expect(project.commercialConfig?.schedulableServices?.[1].durationMinutes).toBe(90);
    expect(project.commercialConfig?.availabilityRules).toHaveLength(6);
    expect(project.commercialConfig?.availabilityRules?.[0]).toMatchObject({ startTime: "08:00", endTime: "18:00" });

    const quoteStep = project.steps.find((step) => step.type === "quote");
    expect(quoteStep?.formFields).toHaveLength(3);
    expect(quoteStep?.options?.[0]).toMatchObject({ actionType: "start_capability", actionPayload: { capability: "quote" } });
    const scheduleStep = project.steps.find((step) => step.type === "schedule");
    expect(scheduleStep?.blocks?.map((block) => block.type)).toEqual(["service_selector", "calendar", "schedule_slots"]);
    expect(scheduleStep?.blocks?.[0].content?.services).toHaveLength(3);
    expect(getProjectReadiness(project).publishable).toBe(true);
  });

  it("não ativa roteamento para uma única empresa que apenas menciona bairro", () => {
    const analyzer = new RuleBasedBusinessAnalyzer();
    const single = analyzer.analyze({
      businessName: "Pet local",
      businessDescription: "Pet shop de bairro com serviço de banho e atendimento por horário.",
      primaryGoal: "Agendar",
      primaryDestination: "WhatsApp",
      slug: "pet-local",
    });
    const multiple = analyzer.analyze({
      businessName: "Rede Pet",
      businessDescription: "Rede com várias unidades e indicação da unidade mais próxima.",
      primaryGoal: "Encontrar unidade",
      primaryDestination: "WhatsApp",
      slug: "rede-pet",
    });

    expect(single.hasMultipleLocations).toBe(false);
    expect(single.capacityKinds).not.toContain("location");
    expect(multiple.hasMultipleLocations).toBe(true);
    expect(multiple.capacityKinds).toContain("location");
  });

  it("aplica identidade visual e copy específicas para pet", () => {
    const project = new RuleBasedExperienceComposer().compose({
      businessName: initialInput.businessName,
      businessDescription: initialInput.description,
      primaryGoal: "Agendar",
      primaryDestination: "WhatsApp",
      slug: "patas-brilho-pet-care",
      phone: initialInput.phone,
    });

    expect(project.brand.extractedColors[0]).toBe("#2F6B5B");
    expect(project.subtitle).toContain("pet");
    expect(project.steps[0].description).not.toBe(initialInput.description);
    expect(project.steps[0].options?.[0].label).toBe("Ver serviços e horários");
  });
});
