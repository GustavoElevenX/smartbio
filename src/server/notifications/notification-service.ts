import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import {
  isCommercialNotificationEvent,
  type CommercialNotificationEvent,
} from "@/server/notifications/notification-events";
import { notificationRepository } from "@/server/notifications/notification-repository";
import { notificationTemplate } from "@/server/notifications/notification-templates";
import { configuredEmailProvider } from "@/server/notifications/resend-provider";

export interface CommercialNotificationInput {
  workspaceId: string;
  projectId: string;
  eventKey: CommercialNotificationEvent;
  objectType: string;
  objectId: string;
  recipientUserIds?: string[];
  data: Record<string, unknown>;
}

interface OutboxRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  event_key: string;
  object_type: string;
  object_id: string;
  payload: {
    data?: Record<string, unknown>;
    recipientUserIds?: string[];
    recipientEmail?: string;
    acceptanceUrl?: string;
  };
  attempts: number;
}

function database() {
  const client = createServiceClient();
  if (!client) throw new Error("Supabase não configurado para notificações.");
  return client;
}

function sanitizedError(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha na entrega.";
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 300);
}

export async function createCommercialNotification(
  input: CommercialNotificationInput,
) {
  if (!isCommercialNotificationEvent(input.eventKey)) {
    throw new Error("Evento de notificação desconhecido.");
  }
  const { data, error } = await database()
    .from("notification_outbox")
    .upsert(
      {
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        event_key: input.eventKey,
        object_type: input.objectType,
        object_id: input.objectId,
        payload: {
          data: input.data,
          recipientUserIds: input.recipientUserIds,
        },
      },
      {
        onConflict: "event_key,object_type,object_id",
        ignoreDuplicates: true,
      },
    )
    .select("id,status")
    .maybeSingle();
  if (error) throw new Error("Não foi possível enfileirar a notificação.");
  return data || { status: "already_enqueued" };
}

export async function enqueueProjectNotification(
  projectId: string,
  eventKey: CommercialNotificationEvent,
  objectType: string,
  objectId: string,
  data: Record<string, unknown>,
) {
  try {
    const client = createServiceClient();
    if (!client) return { status: "persistence_unavailable" };
    const { data: project, error } = await client
      .from("projects")
      .select("workspace_id")
      .eq("id", projectId)
      .maybeSingle();
    if (error || !project)
      throw new Error("Projeto da notificação não encontrado.");
    return await createCommercialNotification({
      workspaceId: project.workspace_id,
      projectId,
      eventKey,
      objectType,
      objectId,
      data,
    });
  } catch (error) {
    console.error("notification_outbox_enqueue_failed", {
      projectId,
      eventKey,
      objectType,
      objectId,
      message: sanitizedError(error),
    });
    return { status: "enqueue_failed" };
  }
}

export const notifyProjectEvent = enqueueProjectNotification;

export async function deliverNotification(input: CommercialNotificationInput) {
  if (!isCommercialNotificationEvent(input.eventKey)) {
    throw new Error("Evento de notificação desconhecido.");
  }
  const recipients = await notificationRepository.workspaceRecipients(
    input.workspaceId,
    input.recipientUserIds,
  );
  const actionUrl =
    input.objectType === "project"
      ? `/app/projects/${input.projectId}/editor`
      : `/app/projects/${input.projectId}/operations?type=${encodeURIComponent(input.objectType)}&id=${encodeURIComponent(input.objectId)}`;
  const template = notificationTemplate(input.eventKey, input.data, actionUrl);
  const results = [];
  const emailErrors: string[] = [];

  for (const userId of recipients) {
    const preference = await notificationRepository.preference(
      input.workspaceId,
      userId,
      input.eventKey,
    );
    const notification = await notificationRepository.create({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      userId,
      eventKey: input.eventKey,
      title: template.title,
      body: template.body,
      actionUrl,
      objectType: input.objectType,
      objectId: input.objectId,
      metadata: input.data,
      readAt: preference.inApp ? undefined : new Date().toISOString(),
    });

    await notificationRepository.delivery(notification.id, "in_app", {
      status: preference.inApp ? "sent" : "skipped",
      provider: "database",
    });

    if (preference.email) {
      try {
        const { data: previousDelivery } = await database()
          .from("notification_deliveries")
          .select("status")
          .eq("notification_id", notification.id)
          .eq("channel", "email")
          .maybeSingle();
        if (previousDelivery?.status === "sent") {
          results.push(notification);
          continue;
        }
        const email = await notificationRepository.userEmail(userId);
        if (!email) throw new Error("Destinatário sem e-mail.");
        const sent = await configuredEmailProvider().send({
          to: email,
          subject: template.subject,
          html: template.html,
        });
        await notificationRepository.delivery(notification.id, "email", {
          status: "sent",
          provider: sent.provider,
          messageId: sent.messageId,
        });
      } catch (error) {
        const message = sanitizedError(error);
        emailErrors.push(message);
        await notificationRepository.delivery(notification.id, "email", {
          status: "failed",
          provider: process.env.EMAIL_PROVIDER || "resend",
          error: message,
        });
      }
    } else {
      await notificationRepository.delivery(notification.id, "email", {
        status: "skipped",
      });
    }
    results.push(notification);
  }

  if (emailErrors.length) throw new Error(emailErrors[0]);
  return results;
}

export function notificationRetryDelaySeconds(attempt: number) {
  return (
    [0, 60, 5 * 60, 30 * 60, 2 * 60 * 60][Math.max(0, attempt - 1)] ||
    2 * 60 * 60
  );
}

export async function processNotificationOutboxBatch(
  workerId: string,
  limit = 25,
) {
  const client = database();
  const { data, error } = await client.rpc("claim_notification_outbox", {
    p_worker_id: workerId,
    p_limit: Math.max(1, Math.min(limit, 100)),
  });
  if (error) throw new Error("Não foi possível reservar o lote da outbox.");
  const claimed = (data || []) as OutboxRow[];
  const summary = {
    claimed: claimed.length,
    completed: 0,
    retried: 0,
    dead: 0,
  };

  for (const row of claimed) {
    try {
      if (row.event_key === "workspace.invitation") {
        if (!row.payload.recipientEmail || !row.payload.acceptanceUrl)
          throw new Error("Convite sem destinatário ou URL.");
        await configuredEmailProvider().send({
          to: row.payload.recipientEmail,
          subject: "Você recebeu um convite para a Virou",
          html: `<p>Você foi convidado para colaborar em um workspace da Virou.</p><p><a href="${row.payload.acceptanceUrl}">Aceitar convite</a></p><p>Este convite expira em 7 dias.</p>`,
        });
      } else {
        if (!row.project_id) throw new Error("Projeto da notificação ausente.");
        await deliverNotification({
          workspaceId: row.workspace_id,
          projectId: row.project_id,
          eventKey: row.event_key as CommercialNotificationEvent,
          objectType: row.object_type,
          objectId: row.object_id,
          recipientUserIds: row.payload?.recipientUserIds,
          data: row.payload?.data || {},
        });
      }
      const { error: completedError } = await client
        .from("notification_outbox")
        .update({
          status: "completed",
          locked_at: null,
          locked_by: null,
          last_error: null,
        })
        .eq("id", row.id)
        .eq("locked_by", workerId);
      if (completedError)
        throw new Error("Não foi possível concluir o item da outbox.");
      summary.completed += 1;
    } catch (error) {
      const dead = row.attempts >= 5;
      const availableAt = new Date(
        Date.now() + notificationRetryDelaySeconds(row.attempts + 1) * 1000,
      ).toISOString();
      await client
        .from("notification_outbox")
        .update({
          status: dead ? "dead" : "failed",
          available_at: availableAt,
          locked_at: null,
          locked_by: null,
          last_error: sanitizedError(error),
        })
        .eq("id", row.id)
        .eq("locked_by", workerId);
      if (dead) summary.dead += 1;
      else summary.retried += 1;
    }
  }

  console.info("notification_outbox_batch", summary);
  return summary;
}
