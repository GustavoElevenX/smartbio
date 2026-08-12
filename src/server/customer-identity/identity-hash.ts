import "server-only";
import { createHmac } from "node:crypto";
export function identityLookupHash(projectId: string, normalizedValue: string, secret = process.env.CUSTOMER_IDENTITY_HASH_SECRET) { if (!secret) { if (process.env.NODE_ENV === "production") throw new Error("CUSTOMER_IDENTITY_HASH_SECRET não configurado."); secret = "virou-local-identity-secret"; } return createHmac("sha256", secret).update(`${projectId}:${normalizedValue}`).digest("hex"); }
