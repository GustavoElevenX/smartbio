import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

export interface AIUsageRecord {
  workspaceId: string;
  projectId?: string;
  setupSessionId?: string;
  operation: string;
  provider: string;
  model: string;
  promptVersion: string;
  status: "started" | "completed" | "failed";
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  errorCode?: string;
}

const localUsage: AIUsageRecord[] = [];

export function getLocalAIUsage() {
  return [...localUsage];
}

export async function recordAIUsage(record: AIUsageRecord) {
  localUsage.push(record);
  const supabase = createServiceClient();
  if (!supabase) return;
  const { error } = await supabase.from("ai_generation_runs").insert({
    workspace_id: record.workspaceId,
    project_id: record.projectId || null,
    setup_session_id: record.setupSessionId || null,
    operation: record.operation,
    provider: record.provider,
    model: record.model,
    prompt_version: record.promptVersion,
    status: record.status,
    input_summary: record.inputSummary || {},
    output_summary: record.outputSummary || {},
    input_tokens: record.inputTokens || null,
    output_tokens: record.outputTokens || null,
    duration_ms: record.durationMs || null,
    error_code: record.errorCode || null,
  });
  if (error && process.env.NODE_ENV !== "test") console.warn("[ai-usage]", error.message);
}
