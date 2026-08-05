"use client";

import { demoProjects } from "@/data/demo-projects";
import { hasBookingConflict } from "@/features/scheduling/availability-engine";
import { uid } from "@/lib/utils";
import { canUseLocalStore } from "@/lib/runtime-mode";
import type { AnalyticsEvent, Booking, Lead, OrderRequest, Project, QuoteRequest, Reservation } from "@/types";

const VERSION = "v3";
const KEYS = {
  projects: `smartbio:projects:${VERSION}`,
  leads: `smartbio:leads:${VERSION}`,
  events: `smartbio:events:${VERSION}`,
  user: `smartbio:user:${VERSION}`,
  quotes: `smartbio:quotes:${VERSION}`,
  bookings: `smartbio:bookings:${VERSION}`,
  orders: `smartbio:orders:${VERSION}`,
  reservations: `smartbio:reservations:${VERSION}`,
};
const LEGACY_KEYS = { projects: "smartbio:projects:v2", leads: "smartbio:leads:v2", events: "smartbio:events:v2", user: "smartbio:user:v2" };

function read<T>(key: string, fallback: T, legacyKey?: string): T {
  if (!canUseLocalStore()) return fallback;
  if (typeof window === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    if (value) return JSON.parse(value) as T;
    if (legacyKey) {
      const legacy = localStorage.getItem(legacyKey);
      if (legacy) {
        const parsed = JSON.parse(legacy) as T;
        write(key, parsed);
        return parsed;
      }
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (!canUseLocalStore()) return;
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* local demo can reach the browser quota with large media */ }
}

function initialEvents(): AnalyticsEvent[] {
  const events: AnalyticsEvent[] = [];
  const names: AnalyticsEvent["eventName"][] = ["page_view", "session_started", "step_viewed", "option_clicked", "form_started", "recommendation_viewed", "cta_clicked", "whatsapp_clicked", "journey_completed"];
  for (const project of demoProjects) {
    for (let session = 0; session < (project.slug === "vertice" ? 42 : 18); session++) {
      const sessionId = `${project.id}-session-${session}`;
      const depth = session % 5 === 0 ? 3 : session % 3 === 0 ? 5 : names.length;
      names.slice(0, depth).forEach((eventName, index) => events.push({
        id: uid("event"), projectId: project.id, visitorId: `visitor-${session}`, sessionId, eventName,
        stepId: project.steps[Math.min(index >> 1, project.steps.length - 1)]?.id,
        utmSource: session % 3 === 0 ? "instagram" : session % 3 === 1 ? "direct" : "youtube",
        utmCampaign: session % 4 === 0 ? "lancamento" : undefined,
        deviceType: session % 5 === 0 ? "desktop" : "mobile",
        createdAt: new Date(Date.now() - session * 4_600_000).toISOString(),
      }));
    }
  }
  return events;
}

function initialLeads(): Lead[] {
  return [
    { id: "lead-1", projectId: "demo-vertice", projectName: "Vértice B2B", sessionId: "demo-vertice-session-1", name: "Marina Costa", email: "marina@northco.com", phone: "11987654321", company: "North Co.", status: "qualified", source: "instagram", campaign: "lancamento", recommendation: "Tráfego Pago + Social Media", score: 74, qualificationBand: "qualified", qualificationReason: "Investimento e urgência compatíveis.", commercialAction: "qualification", operationalStatus: "diagnóstico sugerido", answers: { objetivo: "Gerar leads", investimento: "R$ 10–30 mil" }, createdAt: new Date(Date.now() - 3_600_000).toISOString() },
    { id: "lead-2", projectId: "demo-casa-sucos", projectName: "Casa de Sucos Mix", sessionId: "demo-casa-sucos-session-2", name: "João Lima", phone: "11991234567", company: "MoveFit", status: "new", source: "instagram", recommendation: "Mix Empresas", commercialAction: "catalog_order", operationalStatus: "pedido recebido", answers: { negocio: "Academia", volume: "31–100 unidades" }, createdAt: new Date(Date.now() - 18_000_000).toISOString() },
    { id: "lead-3", projectId: "demo-vertice", projectName: "Vértice B2B", sessionId: "demo-vertice-session-4", name: "Ana Nunes", email: "ana@acme.com", phone: "11985554433", company: "Acme", status: "contacted", source: "youtube", recommendation: "Tráfego Pago + Social Media", score: 55, qualificationBand: "qualified", commercialAction: "qualification", answers: { objetivo: "Acelerar vendas", investimento: "R$ 3–10 mil" }, createdAt: new Date(Date.now() - 86_400_000).toISOString() },
  ];
}

function upsertById<T extends { id: string }>(items: T[], value: T) {
  const index = items.findIndex((item) => item.id === value.id);
  if (index >= 0) items[index] = value; else items.unshift(value);
  return items;
}

export const localStore = {
  getProjects(): Project[] {
    if (!canUseLocalStore()) return [];
    const stored = read(KEYS.projects, demoProjects, LEGACY_KEYS.projects);
    const refreshed = stored.map((project) => {
      const demo = demoProjects.find((candidate) => candidate.id === project.id);
      return demo && project.workspaceId === "demo-workspace" && project.version < demo.version ? demo : project;
    });
    const missing = demoProjects.filter((demo) => !refreshed.some((project) => project.id === demo.id));
    const projects = missing.length ? [...refreshed, ...missing] : refreshed;
    if (missing.length || refreshed.some((project, index) => project !== stored[index])) write(KEYS.projects, projects);
    return projects;
  },
  getProject(value: string): Project | undefined { return this.getProjects().find((project) => project.id === value || project.slug === value); },
  saveProject(project: Project) { const projects = this.getProjects(); const next = { ...project, updatedAt: new Date().toISOString() }; write(KEYS.projects, upsertById(projects, next)); return next; },
  deleteProject(id: string) { write(KEYS.projects, this.getProjects().filter((project) => project.id !== id)); },
  getLeads(projectId?: string): Lead[] { const leads = read<Lead[]>(KEYS.leads, canUseLocalStore() ? initialLeads() : [], LEGACY_KEYS.leads); return projectId ? leads.filter((lead) => lead.projectId === projectId) : leads; },
  addLead(lead: Omit<Lead, "id" | "createdAt">) { const next = { ...lead, id: uid("lead"), createdAt: new Date().toISOString() }; write(KEYS.leads, [next, ...read<Lead[]>(KEYS.leads, initialLeads(), LEGACY_KEYS.leads)]); return next; },
  updateLead(id: string, patch: Partial<Lead>) { const leads = this.getLeads().map((lead) => lead.id === id ? { ...lead, ...patch } : lead); write(KEYS.leads, leads); },
  getEvents(projectId?: string): AnalyticsEvent[] { const events = read<AnalyticsEvent[]>(KEYS.events, canUseLocalStore() ? initialEvents() : [], LEGACY_KEYS.events); return projectId ? events.filter((event) => event.projectId === projectId) : events; },
  track(event: Omit<AnalyticsEvent, "id" | "createdAt">) { const next = { ...event, id: uid("event"), createdAt: new Date().toISOString() }; write(KEYS.events, [next, ...read<AnalyticsEvent[]>(KEYS.events, initialEvents(), LEGACY_KEYS.events)]); return next; },
  getQuoteRequests(projectId?: string) { const items = read<QuoteRequest[]>(KEYS.quotes, []); return projectId ? items.filter((item) => item.projectId === projectId) : items; },
  saveQuoteRequest(request: QuoteRequest) { const items = this.getQuoteRequests(); const existing = request.idempotencyKey && items.find((item) => item.idempotencyKey === request.idempotencyKey); if (existing) return existing; write(KEYS.quotes, upsertById(items, request)); return request; },
  updateQuoteRequest(id: string, patch: Partial<QuoteRequest>) { const items = this.getQuoteRequests().map((item) => item.id === id ? { ...item, ...patch } : item); write(KEYS.quotes, items); return items.find((item) => item.id === id); },
  getBookings(projectId?: string) { const items = read<Booking[]>(KEYS.bookings, []); return projectId ? items.filter((item) => item.projectId === projectId) : items; },
  saveBooking(booking: Booking) { const items = this.getBookings(); const existing = booking.idempotencyKey && items.find((item) => item.idempotencyKey === booking.idempotencyKey); if (existing) return existing; if (hasBookingConflict(booking, items)) throw new Error("Este horário acabou de ser ocupado. Escolha outro."); write(KEYS.bookings, upsertById(items, booking)); return booking; },
  updateBooking(id: string, patch: Partial<Booking>) { const items = this.getBookings().map((item) => item.id === id ? { ...item, ...patch } : item); write(KEYS.bookings, items); return items.find((item) => item.id === id); },
  getOrders(projectId?: string) { const items = read<OrderRequest[]>(KEYS.orders, []); return projectId ? items.filter((item) => item.projectId === projectId) : items; },
  saveOrder(order: OrderRequest) { const items = this.getOrders(); const existing = order.idempotencyKey && items.find((item) => item.idempotencyKey === order.idempotencyKey); if (existing) return existing; write(KEYS.orders, upsertById(items, order)); return order; },
  updateOrder(id: string, patch: Partial<OrderRequest>) { const items = this.getOrders().map((item) => item.id === id ? { ...item, ...patch } : item); write(KEYS.orders, items); return items.find((item) => item.id === id); },
  getReservations(projectId?: string) { const items = read<Reservation[]>(KEYS.reservations, []); return projectId ? items.filter((item) => item.projectId === projectId) : items; },
  saveReservation(reservation: Reservation) { const items = this.getReservations(); const existing = reservation.idempotencyKey && items.find((item) => item.idempotencyKey === reservation.idempotencyKey); if (existing) return existing; write(KEYS.reservations, upsertById(items, reservation)); return reservation; },
  updateReservation(id: string, patch: Partial<Reservation>) { const items = this.getReservations().map((item) => item.id === id ? { ...item, ...patch } : item); write(KEYS.reservations, items); return items.find((item) => item.id === id); },
  getUser(): { name: string; email: string } | null { return read(KEYS.user, null, LEGACY_KEYS.user); },
  setUser(user: { name: string; email: string } | null) { if (typeof window === "undefined") return; if (user) write(KEYS.user, user); else { try { localStorage.removeItem(KEYS.user); } catch {} } },
};
