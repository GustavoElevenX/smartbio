create or replace function public.resolve_workspace_entitlement(
  p_workspace_id uuid,
  p_feature_key text
) returns table(enabled boolean, limit_value bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(override_row.enabled_override, entitlement.enabled, false) as enabled,
    coalesce(override_row.limit_override, entitlement.limit_value) as limit_value
  from public.workspace_plan_assignments assignment
  left join public.plan_entitlements entitlement
    on entitlement.plan_key = assignment.plan_key
   and entitlement.feature_key = p_feature_key
  left join lateral (
    select o.enabled_override, o.limit_override
    from public.workspace_entitlement_overrides o
    where o.workspace_id = p_workspace_id
      and o.feature_key = p_feature_key
      and o.revoked_at is null
      and o.starts_at <= now()
      and (o.expires_at is null or o.expires_at > now())
    order by o.created_at desc
    limit 1
  ) override_row on true
  where assignment.workspace_id = p_workspace_id
    and assignment.status = 'active'
    and (assignment.ends_at is null or assignment.ends_at > now());
$$;

revoke all on function public.resolve_workspace_entitlement(uuid,text) from public, anon, authenticated;

create or replace function public.enforce_presence_page_entitlements() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace uuid;
  page_entitlement record;
  branding_entitlement record;
  used_pages bigint;
begin
  select workspace_id into target_workspace from public.projects where id = new.project_id;
  select * into page_entitlement from public.resolve_workspace_entitlement(target_workspace, 'presence_pages');
  if not coalesce(page_entitlement.enabled, false) then raise exception 'entitlement_required:presence_pages'; end if;
  if tg_op = 'INSERT' and page_entitlement.limit_value is not null then
    select count(*) into used_pages from public.presence_pages p join public.projects pr on pr.id = p.project_id where pr.workspace_id = target_workspace;
    if used_pages >= page_entitlement.limit_value then raise exception 'plan_limit_reached:presence_pages'; end if;
  end if;
  if coalesce((new.settings->'footer'->>'showVirouBranding')::boolean, true) = false then
    select * into branding_entitlement from public.resolve_workspace_entitlement(target_workspace, 'remove_virou_branding');
    if not coalesce(branding_entitlement.enabled, false) then raise exception 'entitlement_required:remove_virou_branding'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_presence_section_entitlements() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace uuid;
  section_entitlement record;
  used_sections bigint;
begin
  select pr.workspace_id into target_workspace from public.presence_pages p join public.projects pr on pr.id = p.project_id where p.id = new.page_id;
  select * into section_entitlement from public.resolve_workspace_entitlement(target_workspace, 'presence_sections_per_page');
  if not coalesce(section_entitlement.enabled, false) then raise exception 'entitlement_required:presence_sections_per_page'; end if;
  if tg_op = 'INSERT' and section_entitlement.limit_value is not null then
    select count(*) into used_sections from public.presence_sections where page_id = new.page_id;
    if used_sections >= section_entitlement.limit_value then raise exception 'plan_limit_reached:presence_sections_per_page'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists presence_pages_entitlement_guard on public.presence_pages;
create trigger presence_pages_entitlement_guard before insert or update on public.presence_pages for each row execute function public.enforce_presence_page_entitlements();
drop trigger if exists presence_sections_entitlement_guard on public.presence_sections;
create trigger presence_sections_entitlement_guard before insert or update on public.presence_sections for each row execute function public.enforce_presence_section_entitlements();

create or replace function public.save_presence_site_draft(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_project_id uuid,
  p_pages jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  page_input jsonb;
  results jsonb := '[]'::jsonb;
  saved jsonb;
begin
  if jsonb_typeof(p_pages) <> 'array' then raise exception 'invalid_presence_pages'; end if;
  if not coalesce((select enabled from public.resolve_workspace_entitlement(p_workspace_id, 'ai_page_edits')), false) then raise exception 'entitlement_required:ai_page_edits'; end if;
  for page_input in select value from jsonb_array_elements(p_pages) loop
    saved := public.save_presence_page(
      p_workspace_id,
      p_actor_id,
      p_project_id,
      coalesce((page_input->>'expectedVersion')::integer, 0),
      jsonb_build_object(
        'page', page_input->'page',
        'deletedSectionIds', coalesce(page_input->'deletedSectionIds', '[]'::jsonb)
      )
    );
    results := results || jsonb_build_array(saved);
  end loop;
  return jsonb_build_object('pages', results);
end;
$$;

grant execute on function public.save_presence_site_draft(uuid,uuid,uuid,jsonb) to authenticated;
