export interface OperationalSignals {
  hasProjects: boolean;
  published: boolean;
  sessions: number;
  intentions: number;
  actions: number;
  opportunities: number;
  conversions: number;
  trialDaysRemaining?: number;
}

export interface NextBestAction {
  key: "create" | "publish" | "distribute" | "clarify" | "friction" | "handoff" | "confirm" | "optimize" | "upgrade";
  title: string;
  description: string;
  actionLabel: string;
}

export function resolveNextBestAction(input: OperationalSignals): NextBestAction {
  if (!input.hasProjects) return { key: "create", title: "Crie sua primeira estrutura", description: "Comece pelo resultado que seu negócio quer gerar.", actionLabel: "Criar minha estrutura" };
  if (!input.published) return { key: "publish", title: "Prepare sua estrutura para publicar", description: "Revise o que precisa de confirmação e coloque sua primeira versão no ar.", actionLabel: "Revisar publicação" };
  if (!input.sessions) return { key: "distribute", title: "Leve visitantes para sua estrutura", description: "Sua estrutura está no ar. Agora use uma Entrada no canal que traz visitantes.", actionLabel: "Criar entrada" };
  if (!input.intentions) return { key: "clarify", title: "Revise a clareza do primeiro passo", description: "Houve tráfego, mas nenhuma intenção foi registrada no período.", actionLabel: "Revisar estrutura" };
  if (!input.actions) return { key: "friction", title: "Reduza a fricção da jornada", description: "Visitantes demonstraram intenção, mas ainda não concluíram uma ação.", actionLabel: "Ver evidência" };
  if (!input.opportunities) return { key: "handoff", title: "Revise o destino da ação", description: "Ações foram concluídas, mas não geraram oportunidades registradas.", actionLabel: "Revisar destino" };
  if (!input.conversions) return { key: "confirm", title: "Atualize o resultado das oportunidades", description: "Confirme conversões somente quando o resultado comercial for conhecido.", actionLabel: "Ver oportunidades" };
  if (input.trialDaysRemaining != null && input.trialDaysRemaining <= 2) return { key: "upgrade", title: "Revise o valor gerado no trial", description: "Use seus dados reais para decidir se o Sobe Pro faz sentido para o negócio.", actionLabel: "Ver plano" };
  return { key: "optimize", title: "Revise o próximo insight", description: "Já existe resultado confirmado; compare as versões e avalie oportunidades de melhoria.", actionLabel: "Ver otimização" };
}
