import { describe, expect, it } from "vitest";

import {
  factFieldLabel,
  factStatusLabel,
  factTypeLabel,
  formatFactValue,
} from "@/features/business-sources/fact-presentation";

describe("apresentação das informações encontradas", () => {
  it("traduz chaves, categorias e estados internos", () => {
    expect(factTypeLabel("contacts")).toBe("Contato");
    expect(factFieldLabel("contact.whatsapp.phone", "contacts")).toBe("Número do WhatsApp");
    expect(factStatusLabel("needs_confirmation")).toBe("Aguardando confirmação");
  });

  it("não mostra uma chave interna desconhecida como código", () => {
    expect(factFieldLabel("internal.opaque_identifier", "unknown_type")).toBe("Informação");
  });

  it("apresenta valores estruturados em português legível", () => {
    expect(formatFactValue({ phone: "(11) 99999-0000", active: true })).toBe("Telefone: (11) 99999-0000\nInformação: Sim");
  });
});
