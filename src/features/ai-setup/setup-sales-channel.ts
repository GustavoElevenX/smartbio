export const setupSalesChannels = ["whatsapp", "phone", "link", "in_person", "other"] as const;

export type SetupSalesChannel = (typeof setupSalesChannels)[number];

export function validateSetupSalesChannel(input: {
  salesChannel?: SetupSalesChannel;
  salesDestination?: string;
  phone?: string;
}) {
  if (!input.salesChannel) return "Escolha por onde o cliente compra ou contrata.";
  if (input.salesChannel === "whatsapp" || input.salesChannel === "phone") {
    return input.phone?.trim() ? undefined : "Informe o WhatsApp ou telefone principal para esse canal de vendas.";
  }
  const destination = input.salesDestination?.trim();
  if (!destination) return input.salesChannel === "link"
    ? "Informe o link onde o cliente compra ou contrata."
    : "Conte onde e como o cliente compra ou contrata por esse canal.";
  if (input.salesChannel === "link") {
    try {
      const url = new URL(destination);
      if (url.protocol === "https:" || url.protocol === "http:") return undefined;
    } catch {
      // A URL completa é necessária para criar um destino de venda seguro.
    }
    return "Informe um link completo, começando com https://.";
  }
  return undefined;
}
