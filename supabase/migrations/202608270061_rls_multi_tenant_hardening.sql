-- P0-03: harden tenant mutation checks without changing the existing role model.
-- Workspace membership remains the read boundary; support grants are scoped and expiring.

create or replace function public.is_workspace_writer(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = target_workspace
        and wm.user_id = auth.uid()
    )
    or public.has_active_platform_support_access(target_workspace, 'write');
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'workspaces','workspace_members','projects','media_assets','project_versions',
    'visitor_sessions','analytics_events','leads','commercial_opportunities',
    'subscriptions','platform_support_sessions','platform_support_grants'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

-- SECURITY DEFINER helpers are callable only by authenticated sessions.  The
-- public/anon grants needed by published policies are explicit and limited to
-- the publication predicate.
revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.is_workspace_owner(uuid) from public, anon;
revoke all on function public.project_workspace(uuid) from public, anon;
revoke all on function public.is_project_public(uuid) from public;
revoke all on function public.has_active_platform_support_access(uuid, text) from public, anon;
revoke all on function public.is_workspace_writer(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid), public.is_workspace_owner(uuid), public.project_workspace(uuid), public.is_workspace_writer(uuid) to authenticated;
grant execute on function public.is_project_public(uuid) to anon, authenticated;
grant execute on function public.has_active_platform_support_access(uuid, text) to authenticated;

-- Existing policies intentionally expose read access to a support session with
-- can_read=true.  These restrictive policies prevent that read grant from
-- becoming an implicit write grant when a table's legacy policy is FOR ALL.
create policy "p0_03_projects_writer_insert"
  on public.projects as restrictive for insert to authenticated
  with check (public.is_workspace_writer(workspace_id));
create policy "p0_03_projects_writer_update"
  on public.projects as restrictive for update to authenticated
  using (public.is_workspace_writer(workspace_id))
  with check (public.is_workspace_writer(workspace_id));

create policy "p0_03_media_writer_insert" on public.media_assets as restrictive
  for insert to authenticated with check (public.is_workspace_writer(workspace_id));
create policy "p0_03_media_writer_update" on public.media_assets as restrictive
  for update to authenticated using (public.is_workspace_writer(workspace_id))
  with check (public.is_workspace_writer(workspace_id));
create policy "p0_03_media_writer_delete" on public.media_assets as restrictive
  for delete to authenticated using (public.is_workspace_writer(workspace_id));

create policy "p0_03_leads_writer_update" on public.leads as restrictive
  for update to authenticated using (public.is_workspace_writer(workspace_id))
  with check (public.is_workspace_writer(workspace_id));

create policy "p0_03_opportunities_writer_insert" on public.commercial_opportunities as restrictive
  for insert to authenticated
  with check (public.is_workspace_writer(workspace_id) and public.project_workspace(project_id) = workspace_id);
create policy "p0_03_opportunities_writer_update" on public.commercial_opportunities as restrictive
  for update to authenticated using (public.is_workspace_writer(workspace_id))
  with check (public.is_workspace_writer(workspace_id) and public.project_workspace(project_id) = workspace_id);
create policy "p0_03_opportunities_writer_delete" on public.commercial_opportunities as restrictive
  for delete to authenticated using (public.is_workspace_writer(workspace_id));

create policy "p0_03_project_versions_writer_insert" on public.project_versions as restrictive
  for insert to authenticated
  with check (public.is_workspace_writer(public.project_workspace(project_id)) and created_by = auth.uid());

create policy "p0_03_media_storage_writer_insert" on storage.objects as restrictive
  for insert to authenticated
  with check (
    bucket_id in ('media', 'media-private', 'business-sources')
    and public.is_workspace_writer((storage.foldername(name))[1]::uuid)
  );
create policy "p0_03_media_storage_writer_update" on storage.objects as restrictive
  for update to authenticated
  using (
    bucket_id in ('media', 'media-private', 'business-sources')
    and public.is_workspace_writer((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id in ('media', 'media-private', 'business-sources')
    and public.is_workspace_writer((storage.foldername(name))[1]::uuid)
  );
create policy "p0_03_media_storage_writer_delete" on storage.objects as restrictive
  for delete to authenticated
  using (
    bucket_id in ('media', 'media-private', 'business-sources')
    and public.is_workspace_writer((storage.foldername(name))[1]::uuid)
  );

-- Private operational data must never be readable by anon, even if a future
-- permissive policy is added accidentally.
revoke all on public.workspaces, public.workspace_members, public.media_assets,
  public.project_versions, public.visitor_sessions, public.analytics_events,
  public.leads, public.chat_sessions, public.chat_messages, public.knowledge_entries,
  public.subscriptions, public.quote_requests, public.quote_attachments,
  public.order_requests, public.order_request_items, public.reservations,
  public.reservation_change_requests, public.project_integrations,
  public.commercial_audit_log, public.ai_setup_sessions, public.ai_setup_messages,
  public.ai_generation_runs, public.project_data_requirements, public.business_sources,
  public.business_source_facts, public.notifications, public.notification_preferences,
  public.notification_deliveries, public.notification_outbox,
  public.commercial_opportunities, public.opportunity_timeline,
  public.optimization_suggestions, public.presence_pages, public.presence_sections,
  public.conversion_activations, public.activation_offers, public.activation_placements,
  public.activation_entry_points, public.activation_locations, public.customer_identities,
  public.customer_identity_evidence, public.customer_import_batches,
  public.redemption_validators, public.benefit_claims, public.benefit_redemptions,
  public.activation_handoffs, public.workspace_invitations,
  public.workspace_plan_assignments, public.workspace_entitlement_overrides,
  public.workspace_plan_history, public.ai_site_proposals,
  public.project_member_product_state, public.optimization_experiments,
  public.workspace_optimization_policies, public.subscription_cancellation_feedback,
  public.project_commercial_contexts, public.project_commercial_context_proposals
from anon;

comment on function public.is_workspace_writer(uuid) is
  'P0-03 mutation boundary: workspace members or active support grants with can_write=true.';

-- Publishing is a write operation.  Keep the existing member-level product
-- permission, but make support authorization honor can_write explicitly.
create or replace function public.publish_project(target_project uuid)
returns public.projects
language plpgsql
security invoker
set search_path = ''
as $$
declare result public.projects; next_version integer; snapshot jsonb; target_workspace uuid;
begin
  select p.workspace_id into target_workspace from public.projects p where p.id = target_project;
  if target_workspace is null or not public.is_workspace_writer(target_workspace) then raise exception 'access denied'; end if;
  if not exists(select 1 from public.journey_steps where project_id = target_project and is_active) then raise exception 'project needs at least one active step'; end if;
  select coalesce(max(version_number), 0) + 1 into next_version from public.project_versions where project_id = target_project;
  select jsonb_build_object('project', to_jsonb(p), 'brand', (select to_jsonb(b) from public.brand_profiles b where b.project_id = p.id), 'steps', (select coalesce(jsonb_agg(to_jsonb(s) order by s.step_order), '[]'::jsonb) from public.journey_steps s where s.project_id = p.id), 'options', (select coalesce(jsonb_agg(to_jsonb(o) order by o.option_order), '[]'::jsonb) from public.step_options o join public.journey_steps s on s.id = o.step_id where s.project_id = p.id)) into snapshot from public.projects p where p.id = target_project;
  insert into public.project_versions(project_id, version_number, snapshot, created_by) values (target_project, next_version, snapshot, auth.uid());
  update public.projects set status = 'published', published_at = now() where id = target_project returning * into result;
  return result;
end;
$$;

create or replace function public.restore_project_version(target_version uuid)
returns public.projects
language plpgsql
security invoker
set search_path = ''
as $$
declare version_row public.project_versions; result public.projects; target_workspace uuid;
begin
  select * into version_row from public.project_versions where id = target_version;
  select p.workspace_id into target_workspace from public.projects p where p.id = version_row.project_id;
  if version_row.id is null or target_workspace is null or not public.is_workspace_writer(target_workspace) then raise exception 'access denied'; end if;
  update public.projects set name = version_row.snapshot->'project'->>'name', description = version_row.snapshot->'project'->>'description', theme = coalesce(version_row.snapshot->'project'->'theme', '{}'::jsonb), settings = coalesce(version_row.snapshot->'project'->'settings', '{}'::jsonb), status = 'draft' where id = version_row.project_id returning * into result;
  return result;
end;
$$;
grant execute on function public.publish_project(uuid), public.restore_project_version(uuid) to authenticated;
