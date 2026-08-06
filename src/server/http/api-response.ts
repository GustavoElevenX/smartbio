import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { publicRequestIp } from "@/server/rate-limit/public-identifier";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function apiError(message: string, status = 400, code = "invalid_request") {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export function validationError(error: ZodError) {
  return NextResponse.json({ ok: false, error: { code: "validation_error", message: "Revise os dados enviados.", fields: error.flatten().fieldErrors } }, { status: 400 });
}

export function requestIp(request: Request) {
  return publicRequestIp(request);
}
