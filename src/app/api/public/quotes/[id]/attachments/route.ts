import { features } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { publicRateLimitIdentifier } from "@/server/rate-limit/public-identifier";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rate = await consumeRateLimit("public-quote-attachment", publicRateLimitIdentifier(request, { objectId: id }), rateLimitRules.publicAttachmentUpload, { failClosed: true });
  const respond = <T extends Response>(response: T) => applyRateLimitHeaders(response, rate);
  if (!rate.allowed) return respond(apiError("Limite de uploads atingido.", 429, "rate_limited"));
  if (!features.nativeQuotes) return respond(apiError("Envio de mídia está desativado.", 404, "feature_disabled"));
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size <= 0 || file.size > 5_242_880) return respond(apiError("Envie PNG, JPG ou WebP de até 5 MB.", 400, "invalid_file"));
  const supabase = createServiceClient();
  if (!supabase) return respond(apiSuccess({ accepted: true, persisted: false, name: file.name, size: file.size }, 202));
  const { data: quote } = await supabase.from("quote_requests").select("id,project_id").eq("id", id).maybeSingle();
  if (!quote) return respond(apiError("Solicitação de orçamento não encontrada.", 404, "quote_not_found"));
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${quote.project_id}/quotes/${quote.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("commercial-media").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) { console.error("quote_attachment_upload_failed", { quoteId: id, code: uploadError.message }); return respond(apiError("Não foi possível enviar a imagem.", 400, "upload_failed")); }
  const { data: attachment, error } = await supabase.from("quote_attachments").insert({ quote_request_id: quote.id, storage_path: path, original_filename: file.name, mime_type: file.type, file_size: file.size }).select("id,storage_path,original_filename,mime_type,file_size").single();
  if (error) return respond(apiError("Não foi possível vincular a imagem ao orçamento.", 400, "attachment_failed"));
  const { data: signed } = await supabase.storage.from("commercial-media").createSignedUrl(path, 900);
  return respond(apiSuccess({ attachment: { ...attachment, signedUrl: signed?.signedUrl } }, 201));
}
