import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PLATFORM_VISITOR_COOKIE = "sobe_vid";
export const PLATFORM_SESSION_COOKIE = "sobe_sid";
export const PLATFORM_VISITOR_MAX_AGE = 90 * 24 * 60 * 60;
export const PLATFORM_SESSION_MAX_AGE = 30 * 60;

export const PLATFORM_EVENT_NAMES = [
  "marketing_page_viewed",
  "marketing_section_viewed",
  "marketing_cta_clicked",
  "pricing_viewed",
  "register_viewed",
  "register_started",
  "register_submitted",
  "account_created",
  "email_confirmed",
  "onboarding_started",
  "onboarding_stage_completed",
  "commercial_architecture_generated",
  "commercial_architecture_confirmed",
  "commercial_architecture_edited",
  "commercial_architecture_regenerated",
  "onboarding_blocking_question_answered",
  "onboarding_completed",
  "project_created",
  "presence_page_created",
  "first_structure_generated",
  "first_public_preview_opened",
  "publish_readiness_viewed",
  "first_project_published",
  "project_published",
  "first_traffic_received",
  "first_opportunity_generated",
  "first_conversion_confirmed",
  "dashboard_viewed",
  "analytics_viewed",
  "optimization_viewed",
  "paywall_viewed",
  "trial_started",
  "trial_expired",
  "checkout_started",
  "subscription_started",
  "subscription_cancelled",
] as const;

export type PlatformEventName = (typeof PLATFORM_EVENT_NAMES)[number];

export const PLATFORM_PUBLIC_EVENT_NAMES = [
  "marketing_page_viewed",
  "marketing_section_viewed",
  "marketing_cta_clicked",
  "pricing_viewed",
  "register_viewed",
  "register_started",
  "register_submitted",
] as const satisfies readonly PlatformEventName[];

function signingSecret() {
  const secret = process.env.PLATFORM_TRACKING_SECRET || process.env.RATE_LIMIT_SECRET;
  if (!secret && process.env.NODE_ENV === "production")
    throw new Error("PLATFORM_TRACKING_SECRET não configurado.");
  return secret || "sobe-platform-tracking-development";
}

function signature(id: string) {
  return createHmac("sha256", signingSecret()).update(id).digest("base64url");
}

export function createSignedTrackingId() {
  const id = randomUUID();
  return { id, cookieValue: `${id}.${signature(id)}` };
}

export function readSignedTrackingId(value?: string | null) {
  if (!value) return undefined;
  const [id, supplied] = value.split(".");
  if (!id || !supplied || !/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const expected = signature(id);
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right) ? id : undefined;
}

export function trackingCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
    priority: "medium" as const,
  };
}

export interface PlatformTrackInput {
  eventName: PlatformEventName;
  path?: string;
  elementKey?: string;
  metadata?: Record<string, string | number | boolean>;
  idempotencyKey?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
  referrer?: string;
}

function deviceInfo(userAgent: string) {
  const mobile = /android|iphone|ipad|mobile/i.test(userAgent);
  const tablet = /ipad|tablet/i.test(userAgent);
  const browser = /edg/i.test(userAgent)
    ? "Edge"
    : /chrome|crios/i.test(userAgent)
      ? "Chrome"
      : /firefox|fxios/i.test(userAgent)
        ? "Firefox"
        : /safari/i.test(userAgent)
          ? "Safari"
          : "Outro";
  const os = /windows/i.test(userAgent)
    ? "Windows"
    : /android/i.test(userAgent)
      ? "Android"
      : /iphone|ipad|ios/i.test(userAgent)
        ? "iOS"
        : /mac os/i.test(userAgent)
          ? "macOS"
          : /linux/i.test(userAgent)
            ? "Linux"
            : "Outro";
  return { deviceType: tablet ? "tablet" : mobile ? "mobile" : "desktop", browser, os };
}

export async function persistPublicPlatformEvent(
  database: SupabaseClient,
  input: PlatformTrackInput,
  context: {
    visitorCookie?: string;
    sessionCookie?: string;
    userAgent: string;
  },
) {
  const now = new Date();
  const nowIso = now.toISOString();
  const existingVisitorKey = readSignedTrackingId(context.visitorCookie);
  let visitorCookie = context.visitorCookie;
  let visitorKey = existingVisitorKey;
  let visitor: Record<string, unknown> | null = null;
  if (visitorKey) {
    const { data } = await database
      .from("platform_marketing_visitors")
      .select("*")
      .eq("visitor_key", visitorKey)
      .maybeSingle();
    visitor = data;
  }
  if (!visitor) {
    const generated = createSignedTrackingId();
    visitorKey = generated.id;
    visitorCookie = generated.cookieValue;
    const { data, error } = await database
      .from("platform_marketing_visitors")
      .insert({
        visitor_key: visitorKey,
        first_seen_at: nowIso,
        last_seen_at: nowIso,
        first_referrer: input.referrer || null,
        first_landing_path: input.path || "/",
        first_utm_source: input.utm?.source || null,
        first_utm_medium: input.utm?.medium || null,
        first_utm_campaign: input.utm?.campaign || null,
        first_utm_content: input.utm?.content || null,
        first_utm_term: input.utm?.term || null,
      })
      .select("*")
      .single();
    if (error) throw error;
    visitor = data;
  } else {
    await database
      .from("platform_marketing_visitors")
      .update({ last_seen_at: nowIso })
      .eq("id", visitor.id);
  }
  if (!visitor) throw new Error("Não foi possível identificar o visitante da plataforma.");

  const existingSessionKey = readSignedTrackingId(context.sessionCookie);
  let sessionCookie = context.sessionCookie;
  let session: Record<string, unknown> | null = null;
  if (existingSessionKey) {
    const { data } = await database
      .from("platform_marketing_sessions")
      .select("*")
      .eq("session_key", existingSessionKey)
      .eq("visitor_id", visitor.id)
      .maybeSingle();
    if (data && now.getTime() - new Date(data.last_seen_at).getTime() <= PLATFORM_SESSION_MAX_AGE * 1000)
      session = data;
    else if (data)
      await database.from("platform_marketing_sessions").update({ ended_at: nowIso }).eq("id", data.id);
  }
  if (!session) {
    const generated = createSignedTrackingId();
    sessionCookie = generated.cookieValue;
    const detected = deviceInfo(context.userAgent);
    const { data, error } = await database
      .from("platform_marketing_sessions")
      .insert({
        session_key: generated.id,
        visitor_id: visitor.id,
        started_at: nowIso,
        last_seen_at: nowIso,
        landing_path: input.path || "/",
        referrer: input.referrer || null,
        utm_source: input.utm?.source || null,
        utm_medium: input.utm?.medium || null,
        utm_campaign: input.utm?.campaign || null,
        utm_content: input.utm?.content || null,
        utm_term: input.utm?.term || null,
        device_type: detected.deviceType,
        browser_family: detected.browser,
        os_family: detected.os,
      })
      .select("*")
      .single();
    if (error) throw error;
    session = data;
  } else {
    await database.from("platform_marketing_sessions").update({ last_seen_at: nowIso }).eq("id", session.id);
  }
  if (!session) throw new Error("Não foi possível iniciar a sessão da plataforma.");

  const { error: eventError } = await database.from("platform_marketing_events").upsert(
    {
      visitor_id: visitor.id,
      session_id: session.id,
      event_name: input.eventName,
      path: input.path || null,
      element_key: input.elementKey || null,
      metadata: input.metadata || {},
      idempotency_key: input.idempotencyKey || null,
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );
  if (eventError) throw eventError;
  return { visitorCookie: visitorCookie!, sessionCookie: sessionCookie! };
}

export async function recordPlatformGrowthEvent(
  database: SupabaseClient,
  input: {
    eventName: PlatformEventName;
    userId: string;
    workspaceId?: string;
    path?: string;
    elementKey?: string;
    metadata?: Record<string, unknown>;
    idempotencyKey?: string;
  },
) {
  const { data: attribution } = await database
    .from("platform_signup_attribution")
    .select("visitor_id,signup_session_id,workspace_id")
    .eq("user_id", input.userId)
    .maybeSingle();
  const { error } = await database.from("platform_marketing_events").upsert(
    {
      visitor_id: attribution?.visitor_id || null,
      session_id: attribution?.signup_session_id || null,
      user_id: input.userId,
      workspace_id: input.workspaceId || attribution?.workspace_id || null,
      event_name: input.eventName,
      path: input.path || null,
      element_key: input.elementKey || null,
      metadata: input.metadata || {},
      idempotency_key: input.idempotencyKey || null,
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function linkAuthAttribution(
  database: SupabaseClient,
  input: { userId: string; workspaceId: string; visitorCookie?: string; sessionCookie?: string },
) {
  const visitorKey = readSignedTrackingId(input.visitorCookie);
  const sessionKey = readSignedTrackingId(input.sessionCookie);
  const [{ data: visitor }, { data: session }] = await Promise.all([
    visitorKey
      ? database.from("platform_marketing_visitors").select("*").eq("visitor_key", visitorKey).maybeSingle()
      : Promise.resolve({ data: null }),
    sessionKey
      ? database.from("platform_marketing_sessions").select("*").eq("session_key", sessionKey).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const firstTouch = visitor
    ? {
        source: visitor.first_utm_source,
        medium: visitor.first_utm_medium,
        campaign: visitor.first_utm_campaign,
        content: visitor.first_utm_content,
        term: visitor.first_utm_term,
        referrer: visitor.first_referrer,
        landingPath: visitor.first_landing_path,
      }
    : {};
  const signupTouch = session
    ? {
        source: session.utm_source,
        medium: session.utm_medium,
        campaign: session.utm_campaign,
        content: session.utm_content,
        term: session.utm_term,
        referrer: session.referrer,
        landingPath: session.landing_path,
      }
    : {};
  const { error } = await database.from("platform_signup_attribution").upsert(
    {
      user_id: input.userId,
      workspace_id: input.workspaceId,
      visitor_id: visitor?.id || null,
      signup_session_id: session?.id || null,
      first_touch: firstTouch,
      signup_touch: signupTouch,
    },
    { onConflict: "user_id", ignoreDuplicates: true },
  );
  if (error) throw error;
  await recordPlatformGrowthEvent(database, {
    eventName: "account_created",
    userId: input.userId,
    workspaceId: input.workspaceId,
    idempotencyKey: `account_created:${input.userId}`,
  });
}
