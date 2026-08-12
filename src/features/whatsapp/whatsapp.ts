export function buildWhatsAppMessage(input: {
  greeting?: string;
  businessName?: string;
  interest?: string;
  answers?: Record<string, string>;
  location?: { name?: string } | string;
  activation?: { name?: string; benefitLabel?: string };
  benefitClaim?: { code?: string; benefitLabel?: string };
  items?: Array<{ name: string; quantity: number }>;
  closing?: string;
}) {
  const lines = [input.greeting || (input.businessName ? `Olá! Vim pelo site da ${input.businessName}.` : "Olá! Vim pela Virou.")];
  if (input.interest) lines.push("", `Interesse: ${input.interest}`);
  const benefit = input.benefitClaim?.benefitLabel || input.activation?.benefitLabel;
  if (benefit) lines.push("", `Benefício: ${benefit}`);
  if (input.benefitClaim?.code) lines.push(`Código: ${input.benefitClaim.code}`);
  const location = typeof input.location === "string" ? input.location : input.location?.name;
  if (location) lines.push("", `Unidade indicada: ${location}`);
  if (input.items?.length) { lines.push("", "Itens:"); for (const item of input.items) lines.push(`${item.quantity}x ${item.name}`); }
  for (const [key, value] of Object.entries(input.answers || {})) {
    if (value) lines.push(`${key.replaceAll("_", " ")}: ${value}`);
  }
  if (input.closing) lines.push("", input.closing);
  return lines.join("\n");
}

export function buildWhatsAppUrl(phone: string, message: string) {
  const normalized = phone.replace(/\D/g, "");
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
