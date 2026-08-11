export function sourceFromReferrer(referrer?: string) {
  if (!referrer) return "direct";
  try { return new URL(referrer).hostname.replace(/^www\./, "") || "referral"; } catch { return "referral"; }
}
