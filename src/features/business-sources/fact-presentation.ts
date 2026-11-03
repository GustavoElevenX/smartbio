import type { BusinessSource, BusinessSourceFact } from "@/types";

const typeLabels: Record<string, string> = {
  fact: "Informação geral",
  business: "Negócio",
  service: "Serviço",
  services: "Serviço",
  product: "Produto",
  products: "Produto",
  category: "Categoria",
  categories: "Categoria",
  schedule: "Horário",
  schedules: "Horário",
  openinghours: "Horário de funcionamento",
  price: "Preço",
  prices: "Preço",
  location: "Unidade ou endereço",
  locations: "Unidade ou endereço",
  contact: "Contato",
  contacts: "Contato",
  policy: "Regra do negócio",
  policies: "Regra do negócio",
  accommodation: "Acomodação",
  accommodations: "Acomodação",
  reservableunit: "Opção de reserva",
  reservableunits: "Opção de reserva",
  frequentlyaskedquestion: "Pergunta frequente",
  frequentlyaskedquestions: "Pergunta frequente",
  brandstatement: "Mensagem da marca",
  brandstatements: "Mensagem da marca",
  destination: "Destino de atendimento",
  destinations: "Destino de atendimento",
 };

const termLabels: Record<string, string> = {
  business: "negócio",
  name: "nome",
  description: "descrição",
  phone: "telefone",
  telephone: "telefone",
  whatsapp: "WhatsApp",
  email: "e-mail",
  address: "endereço",
  url: "link",
  link: "link",
  website: "site",
  site: "site",
  service: "serviço",
  services: "serviços",
  product: "produto",
  products: "produtos",
  category: "categoria",
  categories: "categorias",
  price: "preço",
  prices: "preços",
  location: "unidade",
  locations: "unidades",
  unit: "unidade",
  units: "unidades",
  opening: "funcionamento",
  hours: "horários",
  schedule: "agenda",
  schedules: "horários",
  policy: "regra",
  policies: "regras",
  menu: "cardápio",
  catalog: "catálogo",
  contact: "contato",
  contacts: "contatos",
  social: "rede social",
  instagram: "Instagram",
  title: "título",
  text: "texto",
  value: "informação",
};

const statusLabels: Record<BusinessSourceFact["verificationStatus"], string> = {
  verified: "Confirmada",
  needs_confirmation: "Aguardando confirmação",
  missing: "Incompleta",
  invalid: "Precisa de correção",
  rejected: "Descartada",
};

function normalizedToken(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

function sentenceCase(value: string) {
  return value ? value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1) : value;
}

export function factTypeLabel(type: string) {
  const normalized = normalizedToken(type).replace(/\s+/g, "");
  return typeLabels[normalized] || "Informação do negócio";
}

export function factFieldLabel(key: string, type?: string) {
  const parts = key
    .replace(/\[\d+\]/g, "")
    .split(/[.]/)
    .flatMap((part) => normalizedToken(part).split(/\s+/))
    .filter((part) => part && !/^\d+$/.test(part));
  const translated = parts.map((part) => termLabels[part]).filter((part): part is string => Boolean(part)).filter((part, index, all) => index === 0 || part !== all[index - 1]);
  if (!translated.length) return "Informação";
  const last = translated.at(-1) || "informação";
  const category = factTypeLabel(type || parts[0] || "fact").toLocaleLowerCase("pt-BR");
  if (last === "nome") return sentenceCase(`nome do ${category}`);
  if (last === "descrição") return sentenceCase(`descrição do ${category}`);
  if (translated.includes("WhatsApp") && last === "telefone") return "Número do WhatsApp";
  if (["link", "telefone", "WhatsApp", "e-mail", "endereço", "preço", "horários", "cardápio", "catálogo"].includes(last)) return sentenceCase(last);
  return sentenceCase(translated.slice(-2).join(" — "));
}

export function factStatusLabel(status: BusinessSourceFact["verificationStatus"]) {
  return statusLabels[status];
}

export function businessSourceStatusLabel(status: BusinessSource["status"]) {
  return {
    pending: "Aguardando análise",
    uploaded: "Material recebido",
    processing: "Analisando material",
    processed: "Análise concluída",
    failed: "Não foi possível analisar",
  }[status];
}

export function businessSourceTypeLabel(type: BusinessSource["type"]) {
  return {
    website: "Link",
    pdf: "Documento PDF",
    image: "Imagem",
    csv: "Planilha",
    text: "Texto",
  }[type];
}

export function formatFactValue(value: unknown, depth = 0): string {
  if (value === null || value === undefined || value === "") return "Não informado";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return new Intl.NumberFormat("pt-BR").format(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => formatFactValue(item, depth + 1)).join("\n");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => `${factFieldLabel(key)}: ${formatFactValue(nested, depth + 1)}`)
      .join(depth ? "; " : "\n");
  }
  return String(value);
}
