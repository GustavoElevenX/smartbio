import "server-only";
import { randomInt } from "node:crypto";
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateClaimCode(length = 7) { return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join(""); }
