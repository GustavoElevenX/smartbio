import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
export function createValidatorSecret(){const secret=randomBytes(32).toString("base64url");return{secret,tokenHash:hash(secret)};}
export async function activateValidator(database:SupabaseClient,secret:string){const tokenHash=hash(secret);const{data,error}=await database.from("redemption_validators").select("*").eq("token_hash",tokenHash).eq("is_active",true).maybeSingle();if(error||!data)throw new Error("validator_invalid");await database.from("redemption_validators").update({last_used_at:new Date().toISOString()}).eq("id",data.id);return data;}
export function validatorCookieValue(validatorId:string){const secret=process.env.CUSTOMER_IDENTITY_HASH_SECRET||"virou-local-identity-secret";return `${validatorId}.${createHash("sha256").update(`${secret}:${validatorId}`).digest("hex")}`;}
export function readValidatorCookie(value:string|undefined){if(!value)return null;const[id,signature]=value.split(".");if(!id||!signature)return null;const expected=validatorCookieValue(id).split(".")[1];const a=Buffer.from(signature);const b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b)?id:null;}
