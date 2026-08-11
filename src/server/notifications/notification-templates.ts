import type { CommercialNotificationEvent } from "@/server/notifications/notification-events";

const labels: Record<CommercialNotificationEvent, [string, string]> = {
  "lead.created": ["Novo lead", "Uma pessoa concluiu a jornada."],
  "quote.submitted": ["Novo orçamento", "Uma solicitação de orçamento foi enviada."],
  "quote.status_changed": ["Orçamento atualizado", "O status de um orçamento mudou."],
  "booking.submitted": ["Novo agendamento", "Uma solicitação de agendamento foi enviada."],
  "booking.confirmed": ["Agendamento confirmado", "Um agendamento foi confirmado."],
  "booking.cancel_requested": ["Cancelamento solicitado", "O visitante solicitou cancelamento."],
  "booking.reschedule_requested": ["Reagendamento solicitado", "O visitante solicitou outro horário."],
  "order.submitted": ["Novo pedido", "Um pedido foi enviado."],
  "order.status_changed": ["Pedido atualizado", "O status de um pedido mudou."],
  "reservation.submitted": ["Nova reserva", "Uma solicitação de reserva foi enviada."],
  "reservation.confirmed": ["Reserva confirmada", "Uma reserva foi confirmada."],
  "reservation.cancel_requested": ["Cancelamento de reserva", "O visitante solicitou cancelamento da reserva."],
  "reservation.reschedule_requested": ["Alteração de reserva", "O visitante solicitou alteração de datas."],
  "source.processing_failed": ["Material não processado", "Uma fonte de negócio falhou durante o processamento."],
  "project.publish_blocked": ["Publicação bloqueada", "O projeto possui dados obrigatórios pendentes."],
  "project.published": ["Projeto publicado", "A experiência já está disponível para visitantes."],
};

export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!,
  );
}

export function notificationTemplate(
  eventKey: CommercialNotificationEvent,
  data: Record<string, unknown>,
  actionUrl?: string,
) {
  const [title, fallbackBody] = labels[eventKey];
  const visitor = typeof data.name === "string"
    ? data.name
    : typeof data.visitorName === "string"
      ? data.visitorName
      : undefined;
  const body = visitor ? `${fallbackBody} Contato: ${visitor}.` : fallbackBody;
  const context = [
    ["Interesse", data.interest],
    ["Serviço", data.service],
    ["Unidade", data.location],
    ["Data", data.date],
    ["Bairro", data.neighborhood],
    ["URL", data.url],
  ].filter(([, value]) => typeof value === "string" && value);
  const html = `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p>${context.length ? `<ul>${context.map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join("")}</ul>` : ""}${actionUrl ? `<p><a href="${escapeHtml(actionUrl)}">Abrir na Virou</a></p>` : ""}`;
  return { title, body, subject: `${title} · Virou`, html };
}
