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
  const answerLine = (key: string, value: string) => {
    const plain = key.replaceAll("_", " ").trim();
    const label = plain ? `${plain[0].toLocaleUpperCase("pt-BR")}${plain.slice(1)}` : "Informação";
    return `• ${label}${/[?!:]$/.test(label) ? "" : ":"} ${value}`;
  };
  const lines = [input.greeting || (input.businessName ? `Olá! Vim pelo site da ${input.businessName}.` : "Olá! Vim pela Sobe.")];
  const location = typeof input.location === "string" ? input.location : input.location?.name;
  const answers = Object.entries(input.answers || {}).filter(([, value]) => Boolean(value?.trim()));
  if (input.interest || location || answers.length || input.items?.length) lines.push("", "*Resumo da jornada*");
  if (input.interest) lines.push(`Interesse: ${input.interest}`);
  if (location) lines.push(`Unidade: ${location}`);
  if (answers.length) {
    lines.push("", "*Informações compartilhadas*");
    for (const [key, value] of answers) lines.push(answerLine(key, value));
  }
  if (input.items?.length) {
    lines.push("", "*Pedido*");
    for (const item of input.items) lines.push(`• ${item.quantity}x ${item.name}`);
  }
  const benefit = input.benefitClaim?.benefitLabel || input.activation?.benefitLabel;
  if (benefit || input.benefitClaim?.code) lines.push("", "*Benefício*");
  if (benefit) lines.push(`Benefício: ${benefit}`);
  if (input.benefitClaim?.code) lines.push(`Código: ${input.benefitClaim.code}`);
  if (input.closing) lines.push("", input.closing);
  return lines.join("\n");
}

export function buildWhatsAppUrl(phone: string, message: string) {
  const normalized = phone.replace(/\D/g, "");
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
