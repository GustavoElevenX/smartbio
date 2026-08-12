import type { PresenceSectionType } from "./presence.types";
import { presenceSectionContentSchemas } from "./presence-section.schema";

export const presenceSectionRegistry: Record<PresenceSectionType, { label: string; description: string; defaultContent: Record<string, unknown> }> = {
  hero: { label: "Hero", description: "Proposta principal e ações", defaultContent: { badges: [], alignment: "left" } },
  rich_text: { label: "Texto", description: "Conteúdo editorial", defaultContent: { body: "Conte sua história aqui." } },
  benefits: { label: "Benefícios", description: "Benefícios em destaque", defaultContent: { items: Array.from({ length: 3 }, (_, index) => ({ id: `benefit-${index + 1}`, title: `Benefício ${index + 1}`, description: "Descreva o benefício." })) } },
  feature_grid: { label: "Diferenciais", description: "Grade de diferenciais", defaultContent: { columns: 3, items: Array.from({ length: 3 }, (_, index) => ({ id: `feature-${index + 1}`, title: `Diferencial ${index + 1}`, description: "Descreva o diferencial." })) } },
  services: { label: "Serviços", description: "Serviços dos dados comerciais", defaultContent: { dataSource: "commercial_data", layout: "grid", showPrice: true } },
  products: { label: "Produtos", description: "Produtos do catálogo", defaultContent: { layout: "grid", maxItems: 8, showPrice: true } },
  about: { label: "Sobre", description: "História e posicionamento", defaultContent: { body: "Apresente o negócio.", bullets: [] } },
  stats: { label: "Números", description: "Dados confirmados", defaultContent: { items: [] } },
  logo_cloud: { label: "Logos", description: "Clientes e parceiros", defaultContent: { assetIds: [] } },
  gallery: { label: "Galeria", description: "Imagens do negócio", defaultContent: { assetIds: [], columns: 3, lightbox: true } },
  portfolio: { label: "Portfólio", description: "Trabalhos realizados", defaultContent: { assetIds: [], columns: 3, lightbox: true } },
  testimonials: { label: "Depoimentos", description: "Provas sociais confirmadas", defaultContent: { items: [] } },
  faq: { label: "FAQ", description: "Perguntas frequentes", defaultContent: { items: [] } },
  pricing: { label: "Preços", description: "Planos ou ofertas confirmadas", defaultContent: { items: [] } },
  locations: { label: "Unidades", description: "Localizações comerciais", defaultContent: { showOpeningHours: true, showPhone: true, showMapLink: true } },
  contact: { label: "Contato", description: "Canais confirmados", defaultContent: { socialLinks: [] } },
  video: { label: "Vídeo", description: "Vídeo externo", defaultContent: { url: "https://www.youtube.com/" } },
  conversion_cta: { label: "Chamada para ação", description: "Conecta conteúdo à jornada", defaultContent: { primaryAction: { type: "start_conversion_goal", label: "Começar", conversionGoalId: "defina-uma-meta", style: "primary" } } },
  divider: { label: "Divisor", description: "Separação visual", defaultContent: {} },
};

export function hasKnownPresenceSection(type: string): type is PresenceSectionType { return type in presenceSectionContentSchemas; }
