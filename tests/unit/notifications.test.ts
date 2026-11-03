import { describe, expect, it } from "vitest";
import {
  commercialNotificationEvents,
  notificationEventDetails,
  trafficMilestoneForCount,
} from "@/server/notifications/notification-events";
import { notificationTemplate } from "@/server/notifications/notification-templates";

describe("notificações do produto", () => {
  it("transforma visitas em marcos sem avisar a cada acesso", () => {
    expect(trafficMilestoneForCount(0)).toBeUndefined();
    expect(trafficMilestoneForCount(1)).toBe(1);
    expect(trafficMilestoneForCount(24)).toBe(1);
    expect(trafficMilestoneForCount(25)).toBe(25);
    expect(trafficMilestoneForCount(743)).toBe(500);
  });

  it("apresenta publicação sem tratar o nome do negócio como contato", () => {
    const template = notificationTemplate("project.published", { name: "Casa Mix" }, "/casa-mix");
    expect(template.title).toBe("Sua página está no ar");
    expect(template.body).toContain("Casa Mix");
    expect(template.body).not.toContain("Contato:");
  });

  it("explica o fluxo recebido com contagem localizada", () => {
    expect(notificationTemplate("traffic.milestone_reached", { count: 1 }).body).toContain("primeira visita");
    expect(notificationTemplate("traffic.milestone_reached", { count: 1_000 }).body).toContain("1.000 visitas");
  });

  it("só comunica encerramento com uma data real", () => {
    const template = notificationTemplate("subscription.ending", { endingAt: "2026-09-30T12:00:00.000Z" });
    expect(template.body).toContain("renovação automática está desativada");
    expect(template.body).toContain("30 de setembro de 2026");
  });

  it("mantém metadados legíveis para todas as preferências", () => {
    for (const event of commercialNotificationEvents) {
      expect(notificationEventDetails[event].label).not.toBe(event);
      expect(notificationEventDetails[event].description.length).toBeGreaterThan(10);
    }
  });
});
