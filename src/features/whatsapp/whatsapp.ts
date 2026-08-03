export function buildWhatsAppMessage(input: {
  greeting?: string;
  interest?: string;
  answers?: Record<string, string>;
  closing?: string;
}) {
  const lines = [input.greeting || "Olá! Vim pelo link da bio."];
  if (input.interest) lines.push("", `Interesse: ${input.interest}`);
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
