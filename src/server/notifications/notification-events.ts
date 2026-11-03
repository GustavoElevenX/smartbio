export const commercialNotificationEvents = [
  "lead.created",
  "quote.submitted",
  "quote.status_changed",
  "booking.submitted",
  "booking.confirmed",
  "booking.cancel_requested",
  "booking.reschedule_requested",
  "order.submitted",
  "order.status_changed",
  "reservation.submitted",
  "reservation.confirmed",
  "reservation.cancel_requested",
  "reservation.reschedule_requested",
  "source.processing_failed",
  "project.publish_blocked",
  "project.published",
  "traffic.milestone_reached",
  "subscription.activated",
  "subscription.ending",
  "trial.ending",
] as const;

export type CommercialNotificationEvent = typeof commercialNotificationEvents[number];

export function isCommercialNotificationEvent(
  value: string,
): value is CommercialNotificationEvent {
  return (commercialNotificationEvents as readonly string[]).includes(value);
}

export const notificationEventDetails: Record<
  CommercialNotificationEvent,
  { label: string; description: string; category: "activity" | "results" | "billing" | "system"; email?: boolean }
> = {
  "lead.created": { label: "Novos leads", description: "Quando uma pessoa deixa seus dados.", category: "results" },
  "quote.submitted": { label: "Pedidos de orçamento", description: "Novas solicitações de orçamento.", category: "results" },
  "quote.status_changed": { label: "Atualizações de orçamento", description: "Mudanças no andamento de orçamentos.", category: "results" },
  "booking.submitted": { label: "Novos agendamentos", description: "Solicitações de horário recebidas.", category: "results" },
  "booking.confirmed": { label: "Agendamentos confirmados", description: "Confirmações de horários.", category: "results" },
  "booking.cancel_requested": { label: "Cancelamentos de agendamento", description: "Pedidos de cancelamento.", category: "results" },
  "booking.reschedule_requested": { label: "Reagendamentos", description: "Pedidos para alterar um horário.", category: "results" },
  "order.submitted": { label: "Novos pedidos", description: "Pedidos enviados pela página.", category: "results" },
  "order.status_changed": { label: "Atualizações de pedido", description: "Mudanças no andamento de pedidos.", category: "results" },
  "reservation.submitted": { label: "Novas reservas", description: "Solicitações de reserva recebidas.", category: "results" },
  "reservation.confirmed": { label: "Reservas confirmadas", description: "Confirmações de reservas.", category: "results" },
  "reservation.cancel_requested": { label: "Cancelamentos de reserva", description: "Pedidos para cancelar reservas.", category: "results" },
  "reservation.reschedule_requested": { label: "Alterações de reserva", description: "Pedidos para alterar datas.", category: "results" },
  "source.processing_failed": { label: "Falhas ao processar materiais", description: "Quando uma fonte precisa de atenção.", category: "system" },
  "project.publish_blocked": { label: "Publicação bloqueada", description: "Pendências que impedem a publicação.", category: "system" },
  "project.published": { label: "Página publicada", description: "Confirmação de que a página está no ar.", category: "activity" },
  "traffic.milestone_reached": { label: "Marcos de visitas", description: "Primeira visita e novos marcos de audiência.", category: "activity", email: false },
  "subscription.activated": { label: "Plano aprovado", description: "Confirmação da ativação do SOBE Pro.", category: "billing", email: false },
  "subscription.ending": { label: "Assinatura perto do fim", description: "Aviso quando a renovação automática está desativada.", category: "billing", email: false },
  "trial.ending": { label: "Teste perto do fim", description: "Aviso antes do encerramento do período gratuito.", category: "billing", email: false },
};

const trafficMilestones = [1, 25, 100, 500, 1_000, 5_000, 10_000] as const;

export function trafficMilestoneForCount(count: number) {
  return trafficMilestones.findLast((milestone) => count >= milestone);
}
