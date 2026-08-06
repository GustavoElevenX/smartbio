-- Vinculação idempotente das fontes/drafts do onboarding ao projeto definitivo.
alter table public.ai_setup_sessions
  add column if not exists finalization_summary jsonb not null default '{}'::jsonb;

create or replace function public.attach_ai_setup_sources_to_project(
  p_workspace_id uuid,
  p_session_id uuid,
  p_project_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_count integer := 0;
  fact_count integer := 0;
begin
  if not exists (
    select 1 from public.ai_setup_sessions
    where id = p_session_id and workspace_id = p_workspace_id and created_by = p_actor_id
  ) then raise exception 'setup_session_not_found'; end if;
  if not exists (
    select 1 from public.projects where id = p_project_id and workspace_id = p_workspace_id
  ) then raise exception 'project_not_found'; end if;
  if not exists (
    select 1 from public.workspace_members where workspace_id = p_workspace_id and user_id = p_actor_id
  ) then raise exception 'workspace_access_denied'; end if;

  with attached as (
    update public.business_sources source
    set project_id = p_project_id,
        setup_session_id = p_session_id,
        updated_at = now()
    where source.workspace_id = p_workspace_id
      and source.created_by = p_actor_id
      and (source.project_id is null or source.project_id = p_project_id)
      and (
        source.setup_session_id = p_session_id
        or source.id in (
          select (entry->>'id')::uuid
          from public.ai_setup_sessions session,
               jsonb_array_elements(coalesce(session.sources,'[]'::jsonb)) entry
          where session.id = p_session_id and entry ? 'id'
        )
      )
    returning source.id
  ) select count(*) into source_count from attached;

  with attached_facts as (
    update public.business_source_facts fact
    set project_id = p_project_id
    where fact.source_id in (
      select id from public.business_sources
      where workspace_id = p_workspace_id and project_id = p_project_id and setup_session_id = p_session_id
    ) and (fact.project_id is null or fact.project_id = p_project_id)
    returning fact.id
  ) select count(*) into fact_count from attached_facts;

  update public.ai_setup_sessions
  set project_id = p_project_id,
      finalization_summary = jsonb_build_object('sourcesAttached',source_count,'factsAttached',fact_count,'finalizedAt',now()),
      updated_at = now()
  where id = p_session_id;

  insert into public.commercial_audit_log(
    workspace_id,project_id,actor_id,object_type,object_id,action,after_state
  ) values (
    p_workspace_id,p_project_id,p_actor_id,'ai_setup_session',p_session_id,
    'sources_attached',jsonb_build_object('sources',source_count,'facts',fact_count)
  );
  return jsonb_build_object('sourcesAttached',source_count,'factsAttached',fact_count);
end $$;

revoke all on function public.attach_ai_setup_sources_to_project(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.attach_ai_setup_sources_to_project(uuid,uuid,uuid,uuid) to service_role;
