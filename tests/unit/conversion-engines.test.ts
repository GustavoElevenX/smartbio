import { describe, expect, it } from "vitest";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import { CapabilityPlanner } from "@/features/capabilities/capability-planner";
import { calculateOrderTotals } from "@/features/catalog/order-engine";
import { RuleBasedExperienceComposer } from "@/features/composition/experience-composer";
import { qualifyLead } from "@/features/qualification/qualification-engine";
import { calculateQuoteEstimate } from "@/features/quotes/quote-engine";
import { availableUnitQuantity, calculateReservationTotal } from "@/features/reservations/reservation-engine";
import { resolveRoute } from "@/features/routing/routing-engine";
import { generateAvailableSlots, hasBookingConflict } from "@/features/scheduling/availability-engine";
import type { Booking, Reservation, ReservableUnit } from "@/types";

describe("camada de entendimento e capacidades", () => {
  it("infere orçamento com fotos para limpeza sem depender de uma vertical fixa", () => {
    const profile = new RuleBasedBusinessAnalyzer().analyze({ businessName: "LimpaBem", businessDescription: "Limpeza de sofá com orçamento e avaliação por foto", primaryGoal: "Orçamento", primaryDestination: "WhatsApp", slug: "limpabem" });
    expect(profile.offerKinds).toContain("service");
    expect(profile.primaryIntents).toContain("request_quote");
    expect(profile.requiresMediaUpload).toBe(true);
    expect(new CapabilityPlanner().plan(profile).map((item) => item.key)).toEqual(expect.arrayContaining(["quote", "qualification"]));
  });

  it("compõe projeto validável com perfil, capacidades e fluxo comercial", () => {
    const project = new RuleBasedExperienceComposer().compose({ businessName: "Clínica Teste", businessDescription: "Clínica de nutrição com consulta e agenda por horário", primaryGoal: "Agendar", primaryDestination: "Experiência nativa", slug: "clinica-teste", primaryIntents: ["schedule"], capacityKinds: ["time_slot", "professional"] });
    expect(project.businessProfile?.primaryIntents).toContain("schedule");
    expect(project.capabilities?.some((item) => item.key === "scheduling")).toBe(true);
    expect(project.steps.some((step) => step.type === "schedule")).toBe(true);
  });
});

describe("motores determinísticos", () => {
  it("pontua qualificação e retorna recomendação", () => {
    const result = qualifyLead({ investimento: 12000 }, [{ id: "r1", projectId: "p", condition: { field: "investimento", operator: "greater_than", value: 10000 }, scoreDelta: 60, recommendationKey: "enterprise", reason: "Faixa compatível" }]);
    expect(result).toMatchObject({ score: 60, band: "qualified", recommendationKey: "enterprise" });
  });

  it("calcula faixa de orçamento apenas com regras aplicáveis", () => {
    const estimate = calculateQuoteEstimate({ baseAmount: 100, currency: "BRL", estimationMode: "range" }, [
      { id: "add", condition: { field: "tipo", operator: "equals", value: "sofá" }, operation: "add", amount: 80 },
      { id: "range", condition: { field: "quantidade", operator: "greater_than", value: 1 }, operation: "range", minAmount: 220, maxAmount: 300 },
    ], { tipo: "sofá", quantidade: 2 });
    expect(estimate).toMatchObject({ min: 220, max: 300, appliedRuleIds: ["add", "range"], requiresManualReview: false });
  });

  it("remove slots ocupados e considera buffers", () => {
    const service = { id: "s", projectId: "p", name: "Consulta", durationMinutes: 50, bufferBeforeMinutes: 0, bufferAfterMinutes: 10, capacity: 1, confirmationMode: "instant" as const, isActive: true };
    const booking: Booking = { id: "b", projectId: "p", sessionId: "session", serviceId: "s", startsAt: "2026-08-03T09:00:00", endsAt: "2026-08-03T09:50:00", status: "confirmed", confirmationMode: "instant", visitorData: {} };
    const slots = generateAvailableSlots({ date: "2026-08-03", service, rules: [{ id: "rule", projectId: "p", weekday: 1, startTime: "08:00", endTime: "11:00", timezone: "America/Sao_Paulo" }], bookings: [booking], intervalMinutes: 30 });
    expect(slots.some((slot) => slot.startsAt.includes("09:00"))).toBe(false);
    expect(hasBookingConflict({ startsAt: "2026-08-03T09:30:00", endsAt: "2026-08-03T10:00:00" }, [booking])).toBe(true);
  });

  it("recalcula carrinho, disponibilidade de unidade e total de diárias", () => {
    expect(calculateOrderTotals([{ itemId: "i", name: "Item", quantity: 2, unitPrice: 25 }], { deliveryFee: 10, discount: 5 })).toMatchObject({ subtotal: 50, total: 55 });
    const unit: ReservableUnit = { id: "u", projectId: "p", name: "Chalé", capacityAdults: 2, capacityChildren: 1, quantity: 2, basePrice: 500, currency: "BRL", isActive: true, mediaAssetIds: [], amenities: [] };
    const reservation: Reservation = { id: "r", projectId: "p", sessionId: "s", unitId: "u", checkIn: "2026-09-10", checkOut: "2026-09-12", adults: 2, children: 0, status: "confirmed", visitorData: {} };
    expect(availableUnitQuantity(unit, { checkIn: "2026-09-11", checkOut: "2026-09-13" }, [reservation])).toBe(1);
    expect(calculateReservationTotal(unit, "2026-09-10", "2026-09-13")).toBe(1500);
  });

  it("aplica a regra de roteamento de maior prioridade e usa fallback", () => {
    const destinations = [{ id: "a", key: "a", type: "whatsapp" as const, label: "A" }, { id: "b", key: "b", type: "whatsapp" as const, label: "B" }];
    const rules = [{ id: "low", projectId: "p", priority: 1, condition: { field: "regiao", operator: "contains" as const, value: "Sul" }, destinationId: "a", isActive: true }, { id: "high", projectId: "p", priority: 10, condition: { field: "regiao", operator: "contains" as const, value: "Sul" }, destinationId: "b", isActive: true }];
    expect(resolveRoute({ regiao: "Zona Sul" }, rules, destinations, "a").destination?.id).toBe("b");
    expect(resolveRoute({ regiao: "Centro" }, rules, destinations, "a").fallback).toBe(true);
  });
});
