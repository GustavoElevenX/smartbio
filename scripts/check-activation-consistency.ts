import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("[activation-consistency] ignorado: Supabase não configurado.");
  process.exit(0);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const failures: string[] = [];
const [{ data: activations, error: activationError }, { data: offers, error: offerError }, { data: placements, error: placementError }, { data: claims, error: claimError }, { data: redemptions, error: redemptionError }] = await Promise.all([
  db.from("conversion_activations").select("id,project_id,status,published_at"),
  db.from("activation_offers").select("id,activation_id"),
  db.from("activation_placements").select("id,activation_id"),
  db.from("benefit_claims").select("id,project_id,activation_id,code,status,redeemed_at"),
  db.from("benefit_redemptions").select("id,claim_id,project_id,activation_id"),
]);
for (const error of [activationError, offerError, placementError, claimError, redemptionError]) if (error) failures.push(error.message);
const activationIds = new Set((activations || []).map((row) => row.id));
for (const row of offers || []) if (!activationIds.has(row.activation_id)) failures.push(`offer órfã: ${row.id}`);
for (const row of placements || []) if (!activationIds.has(row.activation_id)) failures.push(`placement órfão: ${row.id}`);
for (const row of activations || []) if (["active", "scheduled", "paused", "ended"].includes(row.status) && !row.published_at) failures.push(`ativação publicada sem snapshot: ${row.id}`);
const claimCodes = new Set<string>();
for (const row of claims || []) { const key = `${row.project_id}:${row.code}`; if (claimCodes.has(key)) failures.push(`claim duplicado: ${key}`); claimCodes.add(key); if (!activationIds.has(row.activation_id)) failures.push(`claim sem ativação: ${row.id}`); }
const redemptionClaims = new Set<string>();
for (const row of redemptions || []) { if (redemptionClaims.has(row.claim_id)) failures.push(`resgate duplicado: ${row.claim_id}`); redemptionClaims.add(row.claim_id); const claim = (claims || []).find((item) => item.id === row.claim_id); if (!claim || claim.project_id !== row.project_id || claim.activation_id !== row.activation_id) failures.push(`atribuição de resgate inconsistente: ${row.id}`); }
if (failures.length) { console.error(`[activation-consistency] ${failures.length} inconsistência(s):\n${failures.join("\n")}`); process.exit(1); }
console.log(`[activation-consistency] ok: ${activations?.length || 0} ativações, ${claims?.length || 0} claims e ${redemptions?.length || 0} resgates.`);
