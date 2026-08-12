import type { ActivationOffer } from "./activation.types";
export interface BenefitCalculationInput { offer: ActivationOffer; subtotal: number; deliveryFee?: number; itemIds?: string[]; categoryIds?: string[]; fulfillment?: string; locationId?: string }
export interface BenefitCalculationResult { eligible: boolean; reason?: string; subtotal: number; discountAmount: number; deliveryDiscount: number; finalAmount: number; currency: string }
const cents = (value: number | undefined) => Math.max(0, Math.round((value || 0) * 100));
const money = (value: number) => Math.round(value) / 100;
function scopeMatches(input: BenefitCalculationInput) { const scope = input.offer.scope; if (scope.fulfillment?.length && (!input.fulfillment || !scope.fulfillment.includes(input.fulfillment as never))) return false; if (scope.locationIds?.length && (!input.locationId || !scope.locationIds.includes(input.locationId))) return false; if (scope.catalogItemIds?.length && !(input.itemIds || []).some((id) => scope.catalogItemIds!.includes(id))) return false; if (scope.catalogCategoryIds?.length && !(input.categoryIds || []).some((id) => scope.catalogCategoryIds!.includes(id))) return false; return true; }
export function calculateBenefit(input: BenefitCalculationInput): BenefitCalculationResult {
  const subtotal = cents(input.subtotal); const delivery = cents(input.deliveryFee); const offer = input.offer;
  const base = { subtotal: money(subtotal), discountAmount: 0, deliveryDiscount: 0, finalAmount: money(subtotal + delivery), currency: offer.currency };
  if (!offer.isActive) return { ...base, eligible: false, reason: "inactive_offer" };
  if (!scopeMatches(input)) return { ...base, eligible: false, reason: "outside_scope" };
  if (offer.minSubtotal != null && subtotal < cents(offer.minSubtotal)) return { ...base, eligible: false, reason: "minimum_not_met" };
  let discount = 0; let deliveryDiscount = 0;
  if (offer.offerType === "percentage_discount") discount = Math.round(subtotal * (offer.percentage || 0) / 100);
  if (offer.offerType === "fixed_discount") discount = cents(offer.amount);
  if (offer.offerType === "free_shipping") deliveryDiscount = delivery;
  if (offer.offerType === "special_price" && offer.specialPrice != null) discount = Math.max(0, subtotal - cents(offer.specialPrice));
  if (offer.maxDiscount != null) discount = Math.min(discount, cents(offer.maxDiscount));
  discount = Math.min(subtotal, discount); deliveryDiscount = Math.min(delivery, deliveryDiscount);
  return { eligible: true, subtotal: money(subtotal), discountAmount: money(discount), deliveryDiscount: money(deliveryDiscount), finalAmount: money(subtotal + delivery - discount - deliveryDiscount), currency: offer.currency };
}
