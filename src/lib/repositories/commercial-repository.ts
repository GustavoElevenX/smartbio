"use client";

import { localStore } from "@/lib/local-store";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { AnalyticsEvent, CapabilityKey, Lead } from "@/types";

export interface CommercialOperation {
  id: string;
  projectId: string;
  kind: Exclude<CapabilityKey, "qualification" | "routing" | "payment">;
  status: string;
  contact: string;
  value?: number;
  scheduledAt?: string;
  createdAt: string;
}

async function authenticatedClient() {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ? supabase : null;
}

export const commercialRepository = {
  async getEvents(projectId: string): Promise<AnalyticsEvent[]> {
    const supabase = await authenticatedClient();
    if (!supabase) return localStore.getEvents(projectId);
    const { data, error } = await supabase
      .from("analytics_events")
      .select(
        "id,project_id,session_id,event_name,step_id,option_id,conversion_goal_id,entry_point_id,destination_id,metadata,created_at,visitor_sessions(visitor_id,utm_source,utm_medium,utm_campaign,utm_content,utm_term,device_type)",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((row) => {
      const session = Array.isArray(row.visitor_sessions)
        ? row.visitor_sessions[0]
        : row.visitor_sessions;
      return {
        id: String(row.id),
        projectId: row.project_id,
        sessionId: row.session_id || "",
        visitorId: session?.visitor_id || "",
        eventName: row.event_name,
        stepId: row.step_id || undefined,
        optionId: row.option_id || undefined,
        conversionGoalId: row.conversion_goal_id || undefined,
        entryPointId: row.entry_point_id || undefined,
        destinationId: row.destination_id || undefined,
        metadata: row.metadata || {},
        utmSource: session?.utm_source || undefined,
        utmMedium: session?.utm_medium || undefined,
        utmCampaign: session?.utm_campaign || undefined,
        utmContent: session?.utm_content || undefined,
        utmTerm: session?.utm_term || undefined,
        deviceType: session?.device_type || undefined,
        createdAt: row.created_at,
      } as AnalyticsEvent;
    });
  },
  async getLeads(projectId: string): Promise<Lead[]> {
    const supabase = await authenticatedClient();
    if (!supabase) return localStore.getLeads(projectId);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      projectName: "",
      sessionId: row.session_id || "",
      name: row.name || undefined,
      email: row.email || undefined,
      phone: row.phone || undefined,
      company: row.company || undefined,
      status: row.status,
      source: row.source || undefined,
      campaign: row.campaign || undefined,
      recommendation: row.recommendation || undefined,
      answers: row.answers || {},
      score: row.score || undefined,
      qualificationBand: row.qualification_band || undefined,
      qualificationReason: row.qualification_reason || undefined,
      commercialAction: row.commercial_action || undefined,
      commercialObjectId: row.commercial_object_id || undefined,
      operationalStatus: row.operational_status || undefined,
      estimatedValue: row.estimated_value
        ? Number(row.estimated_value)
        : undefined,
      scheduledAt: row.scheduled_at || undefined,
      locationName: row.location_name || undefined,
      items: row.items || [],
      attachments: row.attachments || [],
      timeline: row.timeline || [],
      notes: row.notes || undefined,
      createdAt: row.created_at,
    })) as Lead[];
  },
  async updateLead(id: string, patch: Partial<Lead>) {
    localStore.updateLead(id, patch);
    const supabase = await authenticatedClient();
    if (!supabase) return;
    const remote: Record<string, unknown> = {};
    if (patch.status) remote.status = patch.status;
    if (patch.notes !== undefined) remote.notes = patch.notes;
    if (patch.operationalStatus !== undefined)
      remote.operational_status = patch.operationalStatus;
    const { error } = await supabase.from("leads").update(remote).eq("id", id);
    if (error) throw new Error(error.message);
  },
  async getOperations(projectId: string): Promise<CommercialOperation[]> {
    const supabase = await authenticatedClient();
    if (!supabase) {
      return [
        ...localStore
          .getQuoteRequests(projectId)
          .map((item) => ({
            id: item.id,
            projectId,
            kind: "quote" as const,
            status: item.status,
            contact: String(
              item.answers.name || item.answers.phone || "Visitante",
            ),
            value: item.estimatedMax,
            createdAt: item.createdAt,
          })),
        ...localStore
          .getBookings(projectId)
          .map((item) => ({
            id: item.id,
            projectId,
            kind: "scheduling" as const,
            status: item.status,
            contact: String(
              item.visitorData.name || item.visitorData.phone || "Visitante",
            ),
            scheduledAt: item.startsAt,
            createdAt: item.createdAt || item.startsAt,
          })),
        ...localStore
          .getOrders(projectId)
          .map((item) => ({
            id: item.id,
            projectId,
            kind: "catalog_order" as const,
            status: item.status,
            contact: String(
              item.visitorData.name || item.visitorData.phone || "Visitante",
            ),
            value: item.totals.total,
            createdAt: item.createdAt || new Date().toISOString(),
          })),
        ...localStore
          .getReservations(projectId)
          .map((item) => ({
            id: item.id,
            projectId,
            kind: "reservation" as const,
            status: item.status,
            contact: String(
              item.visitorData.name || item.visitorData.phone || "Visitante",
            ),
            value: item.total,
            scheduledAt: item.checkIn,
            createdAt: item.createdAt || item.checkIn,
          })),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    const [quotes, bookings, orders, reservations] = await Promise.all([
      supabase
        .from("quote_requests")
        .select("id,project_id,status,visitor_data,estimated_max,created_at")
        .eq("project_id", projectId),
      supabase
        .from("bookings")
        .select("id,project_id,status,visitor_data,starts_at,created_at")
        .eq("project_id", projectId),
      supabase
        .from("order_requests")
        .select("id,project_id,status,visitor_data,totals,created_at")
        .eq("project_id", projectId),
      supabase
        .from("reservations")
        .select("id,project_id,status,visitor_data,total,check_in,created_at")
        .eq("project_id", projectId),
    ]);
    const failed = [quotes, bookings, orders, reservations].find(
      (result) => result.error,
    );
    if (failed?.error) throw new Error(failed.error.message);
    const contact = (value: unknown) => {
      const data = value as Record<string, unknown> | null;
      return String(data?.name || data?.phone || "Visitante");
    };
    return [
      ...(quotes.data || []).map((row) => ({
        id: row.id,
        projectId: row.project_id,
        kind: "quote" as const,
        status: row.status,
        contact: contact(row.visitor_data),
        value: row.estimated_max ? Number(row.estimated_max) : undefined,
        createdAt: row.created_at,
      })),
      ...(bookings.data || []).map((row) => ({
        id: row.id,
        projectId: row.project_id,
        kind: "scheduling" as const,
        status: row.status,
        contact: contact(row.visitor_data),
        scheduledAt: row.starts_at,
        createdAt: row.created_at,
      })),
      ...(orders.data || []).map((row) => ({
        id: row.id,
        projectId: row.project_id,
        kind: "catalog_order" as const,
        status: row.status,
        contact: contact(row.visitor_data),
        value: Number((row.totals as Record<string, unknown>)?.total || 0),
        createdAt: row.created_at,
      })),
      ...(reservations.data || []).map((row) => ({
        id: row.id,
        projectId: row.project_id,
        kind: "reservation" as const,
        status: row.status,
        contact: contact(row.visitor_data),
        value: row.total ? Number(row.total) : undefined,
        scheduledAt: row.check_in,
        createdAt: row.created_at,
      })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async updateOperation(operation: CommercialOperation, status: string) {
    if (operation.kind === "quote")
      localStore.updateQuoteRequest(operation.id, { status: status as never });
    if (operation.kind === "scheduling")
      localStore.updateBooking(operation.id, { status: status as never });
    if (operation.kind === "catalog_order")
      localStore.updateOrder(operation.id, { status: status as never });
    if (operation.kind === "reservation")
      localStore.updateReservation(operation.id, { status: status as never });
    const supabase = await authenticatedClient();
    if (!supabase) return;
    const table =
      operation.kind === "quote"
        ? "quote_requests"
        : operation.kind === "scheduling"
          ? "bookings"
          : operation.kind === "catalog_order"
            ? "order_requests"
            : "reservations";
    const { error } = await supabase
      .from(table)
      .update({ status })
      .eq("id", operation.id);
    if (error) throw new Error(error.message);
  },
};
