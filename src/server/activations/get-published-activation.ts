import "server-only";
import type{SupabaseClient}from"@supabase/supabase-js";
import{publishedActivationSnapshotSchema,type PublishedActivationSnapshot}from"@/features/activations/published-activation.schema";
import { publishedActivationStatus } from "@/features/activations/published-activation-status";
export interface PublishedActivationResult{snapshot:PublishedActivationSnapshot;status:"scheduled"|"active"|"paused"|"ended"}
export async function getPublishedActivation(database:SupabaseClient,projectId:string,activationId:string,now=new Date()):Promise<PublishedActivationResult|null>{const{data,error}=await database.from("conversion_activations").select("id,project_id,status,published_at,published_snapshot").eq("project_id",projectId).eq("id",activationId).maybeSingle();if(error)throw error;if(!data?.published_at)return null;const parsed=publishedActivationSnapshotSchema.safeParse(data.published_snapshot);if(!parsed.success)throw new Error("invalid_published_activation_snapshot");return{snapshot:parsed.data,status:publishedActivationStatus(data.status,parsed.data,now)};}
