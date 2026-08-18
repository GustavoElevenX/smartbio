import { billingErrorResponse, processStripeWebhook } from "@/server/billing/billing-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature)
    return Response.json(
      { ok: false, error: { code: "missing_signature", message: "Assinatura Stripe ausente." } },
      { status: 400 },
    );
  const payload = await request.text();
  try {
    const result = await processStripeWebhook(payload, signature);
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return billingErrorResponse(error);
  }
}
