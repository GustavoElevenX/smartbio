import type { CatalogItem, OrderRequest, OrderRequestItem } from "@/types";

export function createOrderItem(item: CatalogItem, quantity = 1, variantId?: string): OrderRequestItem {
  const variant = item.variants.find((candidate) => candidate.id === variantId);
  return {
    itemId: item.id,
    name: variant ? `${item.name} · ${variant.name}` : item.name,
    quantity: Math.max(1, Math.floor(quantity)),
    unitPrice: (item.price || 0) + (variant?.priceDelta || 0),
    variantId,
  };
}

export function calculateOrderTotals(
  items: OrderRequestItem[],
  options: { currency?: string; deliveryFee?: number; discount?: number } = {},
): OrderRequest["totals"] {
  const subtotal = items.reduce((total, item) => total + item.unitPrice * Math.max(0, item.quantity), 0);
  const deliveryFee = Math.max(0, options.deliveryFee || 0);
  const discount = Math.min(subtotal + deliveryFee, Math.max(0, options.discount || 0));
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    deliveryFee: deliveryFee || undefined,
    discount: discount || undefined,
    total: Math.round((subtotal + deliveryFee - discount) * 100) / 100,
    currency: options.currency || "BRL",
  };
}
