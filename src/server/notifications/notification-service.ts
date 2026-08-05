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

export async function createCommercialNotification(
  input: CommercialNotificationInput,
) {
  if (!isCommercialNotificationEvent(input.eventKey)) {
    throw new Error("Evento de notificação desconhecido.");
  }

  const recipients = await notificationRepository.workspaceRecipients(
    input.workspaceId,
    input.recipientUserIds,
  );
  const actionUrl = input.objectType === "project"
    ? `/app/projects/${input.projectId}/editor`
    : `/app/projects/${input.projectId}/operations?type=${encodeURIComponent(input.objectType)}&id=${encodeURIComponent(input.objectId)}`;
  const template = notificationTemplate(input.eventKey, input.data, actionUrl);
  const results = [];

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
        await notificationRepository.delivery(notification.id, "email", {
          status: "failed",
          provider: process.env.EMAIL_PROVIDER || "resend",
          error: error instanceof Error ? error.message : "Falha no e-mail.",
        });
      }
    } else {
      await notificationRepository.delivery(notification.id, "email", {
        status: "skipped",
      });
    }

    results.push(notification);
  }

  return results;
}

export async function notifyProjectEvent(
  projectId: string,
  eventKey: CommercialNotificationEvent,
  objectType: string,
  objectId: string,
  data: Record<string, unknown>,
) {
  const client = createServiceClient();
  if (!client) return [];
  const { data: project } = await client
    .from("projects")
    .select("workspace_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return [];

  return createCommercialNotification({
    workspaceId: project.workspace_id,
    projectId,
    eventKey,
    objectType,
    objectId,
    data,
  });
}
