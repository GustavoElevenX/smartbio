import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formFieldIssues, formFieldKey } from "@/features/forms/form-field-utils";
import { getPresenceReadinessIssues } from "@/features/presence/presence-readiness";
import { createPresencePage } from "@/features/presence/presence-page-service";
import { findDemoProject } from "@/data/demo-projects";
import type { FormField } from "@/types";

describe("fechamento do Form Builder", () => {
  it("gera chaves semânticas, estáveis e sem colisão", () => {
    expect(formFieldKey("Nome completo")).toBe("name");
    expect(formFieldKey("WhatsApp", ["phone"])).toBe("phone_2");
    expect(formFieldKey("Qual é o seu objetivo?", [])).toBe("qual_e_o_seu_objetivo");
  });

  it("valida opções e chaves duplicadas", () => {
    const field: FormField = { id: "a", label: "Objetivo", key: "objetivo", type: "select", required: true, options: [] };
    const duplicate: FormField = { ...field, id: "b" };
    expect(formFieldIssues(field, [field, duplicate])).toEqual(expect.arrayContaining(["Esta chave já está em uso.", "Adicione ao menos uma opção."]));
  });

  it("mantém o handoff restrito aos campos explicitamente incluídos", () => {
    const source = readFileSync("src/components/public-experience/public-experience.tsx", "utf8");
    expect(source).toContain(".filter((field) => field.includeInHandoff)");
    expect(source).toContain("field.handoffLabel || field.label");
  });
});

describe("fechamento de ativações e Presence", () => {
  it("continua a meta sem anexar claim quando o benefício falha", () => {
    const source = readFileSync("src/components/public-activations/activation-runtime-provider.tsx", "utf8");
    expect(source).toContain("onContinueWithoutBenefit");
    expect(source).toContain("launcher.open({ goalId: activation.conversionGoalId, activationId: activation.id, pageId })");
  });

  it("bloqueia URL, telefone e ativação ausentes com mensagens específicas", () => {
    const project = structuredClone(findDemoProject("casadesucosmix")!);
    const page = createPresencePage(project.id, "Início", "home");
    page.sections[0].content = {
      primaryAction: { type: "open_url", label: "Abrir", url: "javascript:alert(1)" },
      secondaryAction: { type: "open_whatsapp", label: "WhatsApp", whatsappPhone: "123" },
      action: { type: "start_activation", label: "Oferta" },
    };
    project.presence = { pages: [page] };
    const labels = getPresenceReadinessIssues(project).map((issue) => issue.label);
    expect(labels).toEqual(expect.arrayContaining(["CTA com URL inválida", "CTA com telefone inválido", "CTA sem ativação"]));
  });
});
