import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "@/features/brand-intelligence/brand-analyzer";
import { buildPalette, contrastRatio } from "@/features/brand-intelligence/colors";
import { RuleBasedExperienceComposer } from "@/features/composition/experience-composer";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "@/features/whatsapp/whatsapp";
import { slugify } from "@/lib/utils";
import { analyticsEventSchema, leadSchema } from "@/lib/validation/schemas";

describe("fundação SmartBio", () => {
  it("normaliza slugs sem caracteres perigosos", () => { expect(slugify("  Vértice B2B & Vendas  ")).toBe("vertice-b2b-vendas"); expect(slugify("<script>alert(1)</script>")).toBe("script-alert-1-script"); });
  it("gera foreground legível para as cores de ação", () => { const palette = buildPalette(["#6D5EF5", "#FF725E", "#19B88B"]); expect(contrastRatio(palette.primary, palette.primaryForeground)).toBeGreaterThanOrEqual(4.5); expect(contrastRatio(palette.accent, palette.accentForeground)).toBeGreaterThanOrEqual(4.5); });
  it("remove scripts, eventos e referências externas de SVG", () => { const dirty = '<svg onload="alert(1)"><script>alert(2)</script><image href="https://evil.test/x" /></svg>'; const safe = sanitizeSvg(dirty); expect(safe).not.toContain("script"); expect(safe).not.toContain("onload"); expect(safe).not.toContain("https://"); });
  it("gera mensagem contextual e URL codificada do WhatsApp", () => { const message = buildWhatsAppMessage({ interest: "Tráfego Pago", answers: { objetivo: "Gerar leads" } }); expect(message).toContain("Interesse: Tráfego Pago"); expect(message).toContain("objetivo: Gerar leads"); expect(buildWhatsAppUrl("+55 (11) 99999-9999", message)).toContain("wa.me/5511999999999?text="); });
  it("valida evento e bloqueia honeypot preenchido", () => { expect(analyticsEventSchema.safeParse({ projectId: "p", visitorId: "v", sessionId: "s", eventName: "page_view" }).success).toBe(true); expect(leadSchema.safeParse({ projectId: "p", projectName: "P", sessionId: "s", answers: {}, honeypot: "bot" }).success).toBe(false); });
  it("compõe projetos diferentes sem templates fixos", () => { const composer = new RuleBasedExperienceComposer(); const first = composer.compose({ businessName: "Aurora", businessDescription: "Consultoria financeira para pequenas empresas", primaryGoal: "Gerar leads", primaryDestination: "WhatsApp", slug: "aurora" }); const second = composer.compose({ businessName: "Cacto", businessDescription: "Produtos naturais para consumo diário", primaryGoal: "Gerar vendas", primaryDestination: "Checkout", slug: "cacto" }); expect(first.steps).toHaveLength(4); expect(first.steps[0].options?.[0].label).not.toBe(second.steps[0].options?.[0].label); expect(first.designSystem.imagery.decorativeStyle).not.toBeUndefined(); expect(first.slug).toBe("aurora"); });
});
