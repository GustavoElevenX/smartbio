import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { projectAggregateSelect, projectFromNormalizedRow } from "@/server/repositories/public-project-repository";
import type { Project } from "@/types";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { createServiceClient } from "@/lib/supabase/server";

export async function loadProjectAggregateWithClient(
  supabase: SupabaseClient,
  input: { workspaceId: string; projectId?: string; slug?: string },
): Promise<Project | null> {
  let query = supabase.from("projects").select(projectAggregateSelect).eq("workspace_id", input.workspaceId);
  query = input.projectId ? query.eq("id", input.projectId) : query.eq("slug", input.slug || "");
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("Não foi possível carregar o agregado normalizado do projeto.");
  return data ? projectFromNormalizedRow(data as unknown as Record<string, unknown>) : null;
}

export async function loadProjectAggregate(
  actor: AuthenticatedActor,
  projectId: string,
): Promise<Project | null> {
  if (actor.persistence === "memory") return null;
  const supabase = createServiceClient();
  if (!supabase) return null;
  const tables = [
    ["projects", "id,workspace_id,name,slug,description,status,primary_goal,category,theme,settings,published_at,created_at,updated_at"],
    ["brand_profiles", "primary_logo_asset_id,light_logo_asset_id,dark_logo_asset_id,favicon_asset_id,extracted_colors,active_palette,palette_variations,design_system,brand_personality,analysis_metadata"],
    ["business_profiles", "signals"],
    ["project_capabilities", "capability_key,enabled,source,settings"],
    ["project_data_requirements", "id,requirement_key,label,capability_key,status,severity,value,origin,source_id,field_metadata,reason"],
    ["conversion_goals", "id,name,description,goal_kind,target_step_id,destination_label,is_primary,is_active,goal_order,created_at,updated_at"],
    ["entry_points", "id,entry_key,name,conversion_goal_id,target_step_id,surface_mode,presence_page_id,channel,utm_source,utm_medium,utm_campaign,utm_content,utm_term,is_active,created_at,updated_at"],
    ["presence_pages", "id,page_key,name,page_type,path,title,description,seo_title,seo_description,og_image_asset_id,default_conversion_goal_id,is_home,is_active,is_indexable,version,settings,created_at,updated_at,presence_sections(id,section_key,section_type,anchor,title,eyebrow,description,content,style,settings,section_order,is_active,created_at,updated_at)"],
    ["media_assets", "id,workspace_id,project_id,storage_path,original_filename,mime_type,file_size,width,height,duration_seconds,asset_type,status,alt_text,tags,metadata,created_at,updated_at"],
    ["service_offerings", "id,name,slug,description,short_description,service_mode,price_mode,price,min_price,max_price,currency,image_asset_id,destination_id,external_url,is_featured,is_active,service_order,settings"],
    ["quote_definitions", "id,name,currency,base_price,is_active,settings,quote_questions(id,field_key,label,field_type,required,options,question_order,settings),quote_rules(id,field_key,operator,expected_value,operation,price_delta,min_delta,max_delta,rule_order)"],
    ["schedulable_services", "id,service_offering_id,name,duration_minutes,buffer_before_minutes,buffer_after_minutes,confirmation_mode,is_active,settings"],
    ["resources", "id,name,resource_type,is_active"],
    ["availability_rules", "id,resource_id,weekday,starts_at,ends_at,timezone"],
    ["availability_exceptions", "id,resource_id,starts_at,ends_at,is_available,reason"],
    ["catalog_categories", "id,name,category_order,is_active"],
    ["catalog_items", "id,category_id,name,description,image_asset_id,price,currency,is_available,variants,metadata"],
    ["reservable_units", "id,name,description,capacity_adults,capacity_children,quantity,base_price,currency,is_active,media_asset_ids,amenities"],
    ["reservation_blocks", "id,unit_id,starts_on,ends_on,quantity,reason"],
    ["routing_destinations", "id,label,channel,value,is_active,settings"],
    ["routing_rules", "id,destination_id,conditions,priority,is_active"],
    ["business_locations", "id,name,address_line,address_number,address_extra,neighborhood,city,state,postal_code,country_code,latitude,longitude,geocoding_status,geocoding_provider,geocoded_at,phone,whatsapp,external_url,timezone,opening_hours,service_radius_km,delivery_radius_km,supports_delivery,supports_pickup,supports_in_person,priority,is_active,routing_destination_id,settings"],
    ["project_policies", "id,policy_type,title,content,is_active,settings"],
    ["journey_steps", "id,type,title,description,step_order,is_active,settings,content_blocks(id,block_type,block_order,content,settings),step_options!step_options_step_id_fkey(id,label,description,icon,value,option_order,action_type,target_step_id,conversion_goal_id,action_payload),form_definitions(form_fields(id,label,field_key,field_type,placeholder,required,field_order,options))"],
  ] as const;
  const results = await Promise.all(tables.map(([table, columns]) => {
    let query = supabase.from(table).select(columns);
    query = table === "projects"
      ? query.eq("id", projectId).eq("workspace_id", actor.workspaceId)
      : query.eq("project_id", projectId);
    return query;
  }));
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(`Não foi possível carregar o agregado normalizado: ${failed.error.message}`);
  const base = results[0].data?.[0] as unknown as Record<string, unknown> | undefined;
  if (!base) return null;
  const row: Record<string, unknown> = { ...base };
  tables.slice(1).forEach(([table], index) => { row[table] = results[index + 1].data || []; });
  return projectFromNormalizedRow(row);
}

export async function loadWorkspaceProjectAggregates(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select(projectAggregateSelect)
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar os projetos do workspace ativo.");
  return (data || [])
    .map((row) => projectFromNormalizedRow(row as unknown as Record<string, unknown>))
    .filter((project): project is Project => Boolean(project));
}
