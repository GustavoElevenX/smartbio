const labels: Record<string, string> = {
  active: "Ativo",
  archived: "Arquivado",
  blocked: "Bloqueado",
  billing: "Cobrança",
  business: "Empresarial",
  cancelled: "Cancelado",
  canceled: "Cancelado",
  converted: "Convertido",
  direct: "Direto",
  draft: "Rascunho",
  error: "Erro",
  ended: "Encerrado",
  expired: "Expirado",
  free: "Gratuito",
  inactive: "Inativo",
  in_progress: "Em andamento",
  lost: "Perdido",
  manual: "Manual",
  member: "Membro",
  new: "Novo",
  none: "Nenhum",
  owner: "Proprietário",
  paid: "Pago",
  paused: "Pausado",
  pending: "Pendente",
  pro: "SOBE Pro",
  published: "Publicado",
  revoked: "Revogado",
  scheduled: "Agendado",
  support_admin: "Administrador de suporte",
  super_admin: "Administrador principal",
  suspended: "Suspenso",
  system: "Sistema",
  trial: "Período de teste",
  trialing: "Em período de teste",
};

const features: Record<string, string> = {
  projects: "Negócios",
  presence: "Estrutura digital",
  presence_pages: "Páginas",
  multi_page: "Múltiplas páginas",
  conversion_goals: "Objetivos de conversão",
  entry_points: "Pontos de entrada",
  journey: "Jornada",
  opportunities: "Oportunidades",
  analytics_basic: "Análises básicas",
  analytics_advanced: "Análises avançadas",
  activations: "Ativações",
  active_activations: "Ativações ativas",
  benefit_claims: "Resgates de benefícios",
  benefit_validators: "Validação de benefícios",
  customer_history_import: "Importação de clientes",
  qualification: "Qualificação",
  quotes: "Orçamentos",
  scheduling: "Agendamentos",
  catalog_orders: "Pedidos do catálogo",
  reservations: "Reservas",
  routing: "Direcionamento",
  geo_routing: "Direcionamento geográfico",
  multi_unit: "Múltiplas unidades",
  ai_business_analysis: "Análise do negócio com IA",
  ai_journey: "Jornada com IA",
  ai_presence: "Estrutura digital com IA",
  ai_activation: "Ativação com IA",
  ai_optimization: "Otimização com IA",
  ai_structure_suggestions: "Sugestões de estrutura com IA",
  ai_page_edits: "Edição de páginas com IA",
  ai_generations_month: "Ações com IA por mês",
  media_storage_mb: "Armazenamento de arquivos",
  team_members: "Membros da equipe",
  custom_domain: "Domínio próprio",
  remove_virou_branding: "Remover marca SOBE",
};

const actions: Record<string, string> = {
  "support.started": "Suporte iniciado",
  "support.ended": "Suporte encerrado",
  "plan_catalog.updated": "Catálogo de planos atualizado",
  "workspace.status_changed": "Situação do espaço de trabalho alterada",
  "plan.changed": "Plano alterado",
  "override.created": "Exceção de recurso criada",
  "project.updated_by_support": "Negócio atualizado pelo suporte",
  "support.mutation": "Alteração realizada pelo suporte",
};

const trackingElements: Record<string, string> = {
  header_register: "Cadastro no cabeçalho",
  header_login: "Acesso ao painel no cabeçalho",
  hero_create_sobe: "Criar SOBE na abertura",
  hero_see_how_it_works: "Ver como funciona",
  build_create_sobe: "Criar SOBE na apresentação",
  pricing_create_sobe: "Criar SOBE no preço",
  final_create_sobe: "Criar SOBE no encerramento",
  footer_register: "Cadastro no rodapé",
};

export function adminValueLabel(value?: string | null) {
  if (!value) return "—";
  return labels[value.toLowerCase()] || value;
}

export function adminFeatureLabel(value: string) {
  return features[value] || "Recurso não identificado";
}

export function adminActionLabel(value: string) {
  return actions[value] || "Ação administrativa";
}

export function adminTrackingElementLabel(value?: string | null) {
  if (!value) return "—";
  return trackingElements[value] || "Elemento da página";
}
