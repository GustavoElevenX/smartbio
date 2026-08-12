import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
export function normalizePhone(phone: string, country: string = "BR") { const parsed = parsePhoneNumberFromString(phone.trim(), country.toUpperCase() as CountryCode); if (!parsed?.isValid()) throw new Error("Telefone inválido."); return parsed.number; }
export function normalizeEmail(email: string) { const normalized = email.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("E-mail inválido."); return normalized; }
export function maskPhone(phone: string) { const digits = phone.replace(/\D/g, ""); return `•••• ${digits.slice(-4)}`; }
