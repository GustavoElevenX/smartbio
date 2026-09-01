import { calculateOrderTotals } from "@/features/catalog/order-engine";
import { features } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { orderRequestSchema } from "@/lib/validation/schemas";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";
import { enqueueProjectNotification } from "@/server/notifications/notification-service";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { publicRateLimitIdentifier } from "@/server/rate-limit/public-identifier";
import { registerOpportunity } from "@/server/opportunities/service";
import { calculateClaimBenefit } from "@/server/benefits/redemption-service";
import { getRequestId, logError, requestPathname, withRequestId } from "@/server/observability/log";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const raw = await request.json().catch(() => null);
  const candidate = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const rate = await consumeRateLimit("public-order-submit", publicRateLimitIdentifier(request, { projectId: typeof candidate.projectId === "string" ? candidate.projectId : undefined, sessionId: typeof candidate.sessionId === "string" ? candidate.sessionId : undefined }), rateLimitRules.publicFormSubmit, { failClosed: true });
  const respond = <T extends Response>(response: T) => withRequestId(applyRateLimitHeaders(response, rate), requestId);
  if (!rate.allowed) return respond(apiError("Muitos pedidos em sequência.", 429, "rate_limited"));
  if (!features.nativeCatalogOrders) return respond(apiError("Pedidos nativos estão desativados.", 404, "feature_disabled"));
  const parsed = orderRequestSchema.safeParse(raw);
  if (!parsed.success) return respond(validationError(parsed.error));
  if (parsed.data.honeypot) return respond(apiSuccess({ accepted: true }, 202));
  const supabase = createServiceClient();
  const project = await getPublicProjectById(supabase, parsed.data.projectId);
  if (!project) return respond(apiError("Projeto não encontrado.", 404, "project_not_found"));
  const catalog = new Map((project.commercialConfig?.catalogItems || []).filter((item) => item.isAvailable).map((item) => [item.id, item]));
  const items = parsed.data.items.map((requested) => {
    const item = catalog.get(requested.itemId);
    if (!item) return null;
    const variant = item.variants.find((candidate) => candidate.id === requested.variantId && candidate.isAvailable);
    return { itemId: item.id, name: variant ? `${item.name} · ${variant.name}` : item.name, quantity: requested.quantity, unitPrice: (item.price || 0) + (variant?.priceDelta || 0), variantId: variant?.id, notes: requested.notes };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!items.length || items.length !== parsed.data.items.length) return respond(apiError("Um ou mais itens não estão disponíveis.", 409, "item_unavailable"));
  const currency = items.length ? catalog.get(items[0].itemId)?.currency : "BRL";
  const previewTotals = calculateOrderTotals(items, { currency, deliveryFee: 0, discount: 0 });
  let serverDiscount = 0;
  let resolvedClaim: { id: string; activation_id: string; customer_identity_id: string } | null = null;
  if (parsed.data.benefitClaimCode && supabase) {
    try {
      const benefit = await calculateClaimBenefit(supabase, { projectId: project.id, code: parsed.data.benefitClaimCode, subtotal: previewTotals.subtotal, deliveryFee: 0, locationId: parsed.data.locationId, fulfillment: parsed.data.fulfillment });
      if (!benefit.eligible) return respond(apiError("O benefício não se aplica a este pedido.", 409, benefit.reason || "benefit_not_applicable"));
      serverDiscount = benefit.discountAmount + benefit.deliveryDiscount;
      const { data: claim } = await supabase.from("benefit_claims").select("id,activation_id,customer_identity_id").eq("project_id",project.id).eq("code",parsed.data.benefitClaimCode.toUpperCase()).maybeSingle();
      if (!claim) return respond(apiError("Benefício inválido ou expirado.",409,"invalid_benefit_claim"));
      resolvedClaim = claim;
    } catch { return respond(apiError("Benefício inválido ou expirado.", 409, "invalid_benefit_claim")); }
  }
  const totals = calculateOrderTotals(items, { currency, deliveryFee: 0, discount: serverDiscount });
  if (!supabase) return respond(apiSuccess({ accepted: true, persisted: false, order: { ...parsed.data, items, totals, status: "submitted" } }, 202));
  const { data, error } = await supabase.rpc("create_order_request", { target_project: project.id, request_session_key: parsed.data.sessionId, request_idempotency_key: parsed.data.idempotencyKey, request_fulfillment: parsed.data.fulfillment, target_location: parsed.data.locationId || null, requested_items: items, requested_totals: totals, requested_visitor_data: parsed.data.visitorData });
  if (error) { logError("order_submit_failed", { requestId, route: requestPathname(request), workspaceId: project.workspaceId, code: error.code }); return respond(apiError("Não foi possível enviar o pedido.", 400, "order_submit_failed")); }
  const orderId = typeof data === "object" && data && "id" in data ? String(data.id) : String(data);
  const opportunity = await registerOpportunity(supabase, { workspaceId: project.workspaceId, projectId: project.id, projectName: project.name, sessionId: parsed.data.sessionId, sourceType: "order", sourceId: orderId, title: `Pedido · ${items.length} item(ns)`, conversionGoalId: parsed.data.conversionGoalId, entryPointId: parsed.data.entryPointId, activationId: resolvedClaim?.activation_id || parsed.data.activationId, benefitClaimId: resolvedClaim?.id, customerIdentityId: resolvedClaim?.customer_identity_id, attribution: parsed.data.attribution, visitorData: parsed.data.visitorData, estimatedValue: totals.total, currency: totals.currency, summary: items.map((item) => item.name).join(", ") }).catch(() => null);
  await enqueueProjectNotification(project.id, "order.submitted", "opportunity", opportunity?.id || orderId, { ...parsed.data.visitorData, interest: items.map((item) => item.name).join(", "), location: parsed.data.locationId }).catch(() => undefined);
  return respond(apiSuccess({ accepted: true, persisted: true, order: data }, 201));
}
