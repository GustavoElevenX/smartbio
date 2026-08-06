import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { CommercialNotificationEvent } from "@/server/notifications/notification-events";

const sources = [
  { table: "leads", eventKey: "lead.created", objectType: "lead" },
  { table: "quote_requests", eventKey: "quote.submitted", objectType: "quote" },
  { table: "bookings", eventKey: "booking.submitted", objectType: "booking" },
  { table: "order_requests", eventKey: "order.submitted", objectType: "order" },
  { table: "reservations", eventKey: "reservation.submitted", objectType: "reservation" },
] as const;

export async function reconcileNotificationOutbox(since: string) {
  const client = createServiceClient();
  if (!client) throw new Error("Supabase não configurado.");
  let inserted = 0;
  for (const source of sources) {
    const { data, error } = await client.from(source.table)
      .select("id,project_id,created_at,projects!inner(workspace_id)")
      .gte("created_at", since)
      .limit(1000);
    if (error) continue;
    for (const row of data || []) {
      const relation = Array.isArray(row.projects) ? row.projects[0] : row.projects;
      if (!relation?.workspace_id) continue;
      const { error: enqueueError } = await client.from("notification_outbox").upsert({
        workspace_id: relation.workspace_id,
        project_id: row.project_id,
        event_key: source.eventKey satisfies CommercialNotificationEvent,
        object_type: source.objectType,
        object_id: row.id,
        payload: { data: { reconciled: true } },
      }, { onConflict: "event_key,object_type,object_id", ignoreDuplicates: true });
      if (!enqueueError) inserted += 1;
    }
  }
  return { inserted };
}
