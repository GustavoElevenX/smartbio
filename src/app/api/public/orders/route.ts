import { calculateOrderTotals } from "@/features/catalog/order-engine";
import { features } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { orderRequestSchema } from "@/lib/validation/schemas";
import { apiError, apiSuccess, requestIp, validationError } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";
import { checkRateLimit } from "@/server/services/rate-limit";
import { notifyProjectEvent } from "@/server/notifications/notification-service";

export async function POST(request: Request) {
  if (!features.nativeCatalogOrders) return apiError("Pedidos nativos estão desativados.", 404, "feature_disabled");
  if (!checkRateLimit(`order:${requestIp(request)}`, 10, 60_000)) return apiError("Muitos pedidos em sequência.", 429, "rate_limited");
  const parsed = orderRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  if (parsed.data.honeypot) return apiSuccess({ accepted: true }, 202);
  const supabase = createServiceClient();
  const project = await getPublicProjectById(supabase, parsed.data.projectId);
  if (!project) return apiError("Projeto não encontrado.", 404, "project_not_found");
  const catalog = new Map((project.commercialConfig?.catalogItems || []).filter((item) => item.isAvailable).map((item) => [item.id, item]));
  const items = parsed.data.items.map((requested) => {
    const item = catalog.get(requested.itemId);
    if (!item) return null;
    const variant = item.variants.find((candidate) => candidate.id === requested.variantId && candidate.isAvailable);
    return { itemId: item.id, name: variant ? `${item.name} · ${variant.name}` : item.name, quantity: requested.quantity, unitPrice: (item.price || 0) + (variant?.priceDelta || 0), variantId: variant?.id, notes: requested.notes };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!items.length || items.length !== parsed.data.items.length) return apiError("Um ou mais itens não estão disponíveis.", 409, "item_unavailable");
  const totals = calculateOrderTotals(items, { currency: items.length ? catalog.get(items[0].itemId)?.currency : "BRL", deliveryFee: parsed.data.fulfillment === "delivery" ? parsed.data.totals.deliveryFee : 0, discount: parsed.data.totals.discount });
  if (!supabase) return apiSuccess({ accepted: true, persisted: false, order: { ...parsed.data, items, totals, status: "submitted" } }, 202);
  const { data, error } = await supabase.rpc("create_order_request", { target_project: project.id, request_session_key: parsed.data.sessionId, request_idempotency_key: parsed.data.idempotencyKey, request_fulfillment: parsed.data.fulfillment, target_location: parsed.data.locationId || null, requested_items: items, requested_totals: totals, requested_visitor_data: parsed.data.visitorData });
  if (error) { console.error("order_submit_failed", { projectId: project.id, code: error.code }); return apiError("Não foi possível enviar o pedido.", 400, "order_submit_failed"); }
  const orderId = typeof data === "object" && data && "id" in data ? String(data.id) : String(data);
  await notifyProjectEvent(project.id, "order.submitted", "order", orderId, { ...parsed.data.visitorData, interest: items.map((item) => item.name).join(", "), location: parsed.data.locationId }).catch(() => undefined);
  return apiSuccess({ accepted: true, persisted: true, order: data }, 201);
}
