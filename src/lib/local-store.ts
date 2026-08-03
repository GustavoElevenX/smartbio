"use client";

import { demoProjects } from "@/data/demo-projects";
import { uid } from "@/lib/utils";
import type { AnalyticsEvent, Lead, Project } from "@/types";

const KEYS = { projects: "smartbio:projects:v2", leads: "smartbio:leads:v2", events: "smartbio:events:v2", user: "smartbio:user:v2" };

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

function write<T>(key: string, value: T) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
}

function initialEvents(): AnalyticsEvent[] {
  const events: AnalyticsEvent[] = [];
  const names: AnalyticsEvent["eventName"][] = ["page_view", "session_started", "step_viewed", "option_clicked", "form_started", "recommendation_viewed", "cta_clicked", "whatsapp_clicked", "journey_completed"];
  for (const project of demoProjects) {
    for (let session = 0; session < (project.slug === "vertice" ? 42 : 31); session++) {
      const sessionId = `${project.id}-session-${session}`;
      const depth = session % 5 === 0 ? 3 : session % 3 === 0 ? 5 : names.length;
      names.slice(0, depth).forEach((eventName, index) => events.push({ id: uid("event"), projectId: project.id, visitorId: `visitor-${session}`, sessionId, eventName, stepId: project.steps[Math.min(index >> 1, project.steps.length - 1)]?.id, utmSource: session % 3 === 0 ? "instagram" : session % 3 === 1 ? "direct" : "youtube", utmCampaign: session % 4 === 0 ? "lancamento" : undefined, deviceType: session % 5 === 0 ? "desktop" : "mobile", createdAt: new Date(Date.now() - session * 4_600_000).toISOString() }));
    }
  }
  return events;
}

function initialLeads(): Lead[] {
  return [
    { id: "lead-1", projectId: "demo-vertice", projectName: "Vértice B2B", sessionId: "demo-vertice-session-1", name: "Marina Costa", email: "marina@northco.com", phone: "11987654321", company: "North Co.", status: "qualified", source: "instagram", campaign: "lancamento", recommendation: "Tráfego Pago + Social Media", answers: { objetivo: "Gerar leads", investimento: "R$ 10–30 mil" }, createdAt: new Date(Date.now() - 3_600_000).toISOString() },
    { id: "lead-2", projectId: "demo-casa-sucos", projectName: "Casa de Sucos Mix", sessionId: "demo-casa-sucos-session-2", name: "João Lima", phone: "11991234567", company: "MoveFit", status: "new", source: "instagram", recommendation: "Mix Empresas", answers: { negocio: "Academia", volume: "31–100 unidades" }, createdAt: new Date(Date.now() - 18_000_000).toISOString() },
    { id: "lead-3", projectId: "demo-vertice", projectName: "Vértice B2B", sessionId: "demo-vertice-session-4", name: "Ana Nunes", email: "ana@acme.com", phone: "11985554433", company: "Acme", status: "contacted", source: "youtube", recommendation: "Tráfego Pago + Social Media", answers: { objetivo: "Acelerar vendas", investimento: "R$ 3–10 mil" }, createdAt: new Date(Date.now() - 86_400_000).toISOString() },
  ];
}

export const localStore = {
  getProjects(): Project[] { return read(KEYS.projects, demoProjects); },
  getProject(value: string): Project | undefined { return this.getProjects().find((project) => project.id === value || project.slug === value); },
  saveProject(project: Project) { const projects = this.getProjects(); const index = projects.findIndex((item) => item.id === project.id); const next = { ...project, updatedAt: new Date().toISOString() }; if (index >= 0) projects[index] = next; else projects.unshift(next); write(KEYS.projects, projects); return next; },
  deleteProject(id: string) { write(KEYS.projects, this.getProjects().filter((project) => project.id !== id)); },
  getLeads(projectId?: string): Lead[] { const leads = read<Lead[]>(KEYS.leads, initialLeads()); return projectId ? leads.filter((lead) => lead.projectId === projectId) : leads; },
  addLead(lead: Omit<Lead, "id" | "createdAt">) { const next = { ...lead, id: uid("lead"), createdAt: new Date().toISOString() }; write(KEYS.leads, [next, ...read<Lead[]>(KEYS.leads, initialLeads())]); return next; },
  updateLead(id: string, patch: Partial<Lead>) { const leads = this.getLeads().map((lead) => lead.id === id ? { ...lead, ...patch } : lead); write(KEYS.leads, leads); },
  getEvents(projectId?: string): AnalyticsEvent[] { const events = read<AnalyticsEvent[]>(KEYS.events, initialEvents()); return projectId ? events.filter((event) => event.projectId === projectId) : events; },
  track(event: Omit<AnalyticsEvent, "id" | "createdAt">) { const next = { ...event, id: uid("event"), createdAt: new Date().toISOString() }; write(KEYS.events, [next, ...read<AnalyticsEvent[]>(KEYS.events, initialEvents())]); return next; },
  getUser(): { name: string; email: string } | null { return read(KEYS.user, null); },
  setUser(user: { name: string; email: string } | null) { if (user) write(KEYS.user, user); else localStorage.removeItem(KEYS.user); },
};
