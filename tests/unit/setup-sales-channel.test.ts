import { describe, expect, it } from "vitest";
import { setupInitialInputSchema } from "@/features/ai-setup/ai-setup.schema";
import { validateSetupSalesChannel } from "@/features/ai-setup/setup-sales-channel";

const business = { businessName: "Aurora", description: "Atendimento e vendas para clientes." };

describe("canal principal de vendas na criação", () => {
  it("exige escolha do canal e número quando a venda ocorre por WhatsApp ou telefone", () => {
    expect(validateSetupSalesChannel({})).toMatch(/Escolha/);
    expect(validateSetupSalesChannel({ salesChannel: "whatsapp" })).toMatch(/principal/);
    expect(setupInitialInputSchema.safeParse({ ...business, salesChannel: "phone" }).success).toBe(false);
    expect(setupInitialInputSchema.safeParse({ ...business, salesChannel: "whatsapp", phone: "11999999999" }).success).toBe(true);
  });

  it("exige link completo quando a compra acontece em site ou outro link", () => {
    expect(setupInitialInputSchema.safeParse({ ...business, salesChannel: "link", salesDestination: "minhaloja.com" }).success).toBe(false);
    expect(setupInitialInputSchema.safeParse({ ...business, salesChannel: "link", salesDestination: "https://minhaloja.com/comprar" }).success).toBe(true);
  });

  it("aceita uma descrição livre para atendimento presencial ou outros canais", () => {
    expect(setupInitialInputSchema.safeParse({ ...business, salesChannel: "in_person" }).success).toBe(false);
    expect(setupInitialInputSchema.safeParse({ ...business, salesChannel: "in_person", salesDestination: "Na loja do centro" }).success).toBe(true);
    expect(setupInitialInputSchema.safeParse({ ...business, salesChannel: "other", salesDestination: "Por mensagem na plataforma que usamos" }).success).toBe(true);
  });
});
