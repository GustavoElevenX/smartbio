import type { PublishedActivationSnapshot } from "./published-activation.schema";

/** A mesma oferta ativa é usada na página, no claim e no handoff. */
export function selectPublishedOffer(snapshot: PublishedActivationSnapshot) {
  return snapshot.offers.find((offer) => offer.isActive);
}
