-- Sobe launch hardening and Conversion Intelligence foundation.
-- Additive only: version identity, product lifecycle, operational overview and learning loop.

alter table public.projects
  add column if not exists published_version_id uuid references public.project_versions(id) on delete set null;

alter table public.visitor_sessions
  add column if not exists project_version_id uuid references public.project_versions(id) on delete set null;

alter table public.analytics_events
  add column if not exists project_version_id uuid references public.project_versions(id) on delete set null;
alter table public.analytics_events
  add column if not exists idempotency_key text;

alter table public.commercial_opportunities
  add column if not exists project_version_id uuid references public.project_versions(id) on delete set null;

create index if not exists visitor_sessions_project_version_started_idx
  on public.visitor_sessions(project_id, project_version_id, started_at desc);
create index if not exists analytics_events_project_version_created_idx
  on public.analytics_events(project_id, project_version_id, created_at desc);
create unique index if not exists analytics_events_project_idempotency_idx
  on public.analytics_events(project_id, idempotency_key) where idempotency_key is not null;
create index if not exists opportunities_project_version_created_idx
  on public.commercial_opportunities(project_id, project_version_id, created_at desc);
create index if not exists projects_published_version_idx
  on public.projects(published_version_id) where published_version_id is not null;

create table if not exists public.project_member_product_state (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_overview_seen_at timestamptz,
  last_analytics_seen_at timestamptz,
  last_optimization_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, user_id)
);
create index if not exists project_member_state_workspace_user_idx
  on public.project_member_product_state(workspace_id, user_id);
alter table public.project_member_product_state enable row level security;
create policy "product state own member select" on public.project_member_product_state
  for select to authenticated
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy "product state own member insert" on public.project_member_product_state
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
    and public.project_workspace(project_id) = workspace_id
  );
create policy "product state own member update" on public.project_member_product_state
  for update to authenticated
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
    and public.project_workspace(project_id) = workspace_id
  );

create table if not exists public.optimization_experiments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  suggestion_id uuid references public.optimization_suggestions(id) on delete set null,
  source_suggestion_key text not null,
  suggestion_kind text not null,
  change_type text not null check(change_type in (
    'shorten_journey','reorder_step','remove_optional_field','change_cta_copy',
    'move_primary_cta','change_goal_priority','change_entry_surface','simplify_choice_set'
  )),
  proposed_change jsonb not null default '{}'::jsonb,
  target_metric text not null,
  baseline_version_id uuid references public.project_versions(id) on delete set null,
  candidate_version_id uuid references public.project_versions(id) on delete set null,
  status text not null default 'proposed' check(status in (
    'proposed','approved','published','collecting','evaluated','dismissed','rolled_back','confounded'
  )),
  risk_level text not null default 'medium' check(risk_level in ('low','medium','high')),
  evaluation_method text not null default 'observational_before_after_v1'
    check(evaluation_method = 'observational_before_after_v1'),
  baseline_window_start timestamptz,
  baseline_window_end timestamptz,
  candidate_window_start timestamptz,
  candidate_window_end timestamptz,
  baseline_metrics jsonb not null default '{}'::jsonb,
  candidate_metrics jsonb not null default '{}'::jsonb,
  delta_metrics jsonb not null default '{}'::jsonb,
  result text check(result in ('positive','negative','neutral','insufficient')),
  applied_at timestamptz,
  evaluated_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists optimization_experiments_project_status_idx
  on public.optimization_experiments(project_id, status, created_at desc);
create unique index if not exists optimization_experiments_project_source_key_idx
  on public.optimization_experiments(project_id, source_suggestion_key)
  where status not in ('dismissed','rolled_back');
create index if not exists optimization_experiments_candidate_version_idx
  on public.optimization_experiments(candidate_version_id)
  where candidate_version_id is not null;
alter table public.optimization_experiments enable row level security;
create policy "optimization experiments workspace members" on public.optimization_experiments
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "optimization experiments workspace insert" on public.optimization_experiments
  for insert to authenticated with check (
    public.is_workspace_member(workspace_id)
    and public.project_workspace(project_id) = workspace_id
    and created_by = auth.uid()
  );
create policy "optimization experiments workspace update" on public.optimization_experiments
  for update to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id) and public.project_workspace(project_id) = workspace_id);

create table if not exists public.workspace_optimization_policies (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  mode text not null default 'manual' check(mode in ('manual','auto_low_risk')),
  auto_low_risk_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.workspace_optimization_policies enable row level security;
create policy "optimization policy member read" on public.workspace_optimization_policies
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "optimization policy owner write" on public.workspace_optimization_policies
  for all to authenticated using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create table if not exists public.subscription_cancellation_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text check(reason in (
    'not_using','no_traffic','no_result','too_expensive','alternative','missing_feature','other'
  )),
  comment text check(comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists cancellation_feedback_workspace_created_idx
  on public.subscription_cancellation_feedback(workspace_id, created_at desc);
alter table public.subscription_cancellation_feedback enable row level security;
create policy "cancellation feedback owner insert" on public.subscription_cancellation_feedback
  for insert to authenticated with check (user_id = auth.uid() and public.is_workspace_owner(workspace_id));
create policy "cancellation feedback owner read" on public.subscription_cancellation_feedback
  for select to authenticated using (public.is_workspace_owner(workspace_id));

-- Product lifecycle events remain first-party platform events and never contain lead PII.
alter table public.platform_marketing_events
  drop constraint if exists platform_marketing_events_event_name_check;
alter table public.platform_marketing_events
  add constraint platform_marketing_events_event_name_check check(event_name in (
    'marketing_page_viewed','marketing_section_viewed','marketing_cta_clicked','pricing_viewed',
    'register_viewed','register_started','register_submitted','account_created','email_confirmed',
    'onboarding_started','onboarding_stage_completed','onboarding_completed','project_created',
    'presence_page_created','first_structure_generated','first_public_preview_opened',
    'publish_readiness_viewed','first_project_published','project_published','first_traffic_received',
    'first_opportunity_generated','first_conversion_confirmed','dashboard_viewed','analytics_viewed',
    'optimization_viewed','paywall_viewed','trial_started','trial_expired','checkout_started',
    'subscription_started','subscription_cancelled'
  ));

-- Server-first overview. The service role calls this after authenticating the actor.
create or replace function public.get_workspace_operational_overview(
  target_workspace uuid,
  target_user uuid,
  observed_at timestamptz default now()
) returns jsonb
language sql stable security definer set search_path = '' as $$
  with project_set as (
    select p.id,p.name,p.slug,p.status,p.published_at,p.updated_at,
      coalesce(s.last_overview_seen_at, observed_at - interval '7 days') period_start,
      s.last_overview_seen_at
    from public.projects p
    left join public.project_member_product_state s
      on s.project_id=p.id and s.user_id=target_user
    where p.workspace_id=target_workspace and p.status <> 'archived'
  ), event_flags as (
    select ps.id project_id,e.session_id,
      bool_or(e.event_name in ('page_view','presence_page_viewed','session_started')) attention,
      bool_or(e.event_name in ('conversion_goal_selected','conversion_goal_resolved')) intention,
      bool_or(e.event_name in (
        'form_submitted','quote_submitted','booking_submitted','order_submitted',
        'reservation_submitted','route_resolved','whatsapp_clicked','external_link_clicked'
      )) action,
      bool_or(e.event_name in ('whatsapp_clicked','external_link_clicked')) external_action
    from project_set ps
    join public.analytics_events e on e.project_id=ps.id
      and e.created_at >= ps.period_start and e.created_at < observed_at
    group by ps.id,e.session_id
  ), event_totals as (
    select project_id,
      count(*) filter(where attention) sessions,
      count(*) filter(where intention) intentions,
      count(*) filter(where action) actions,
      count(*) filter(where external_action) external_actions
    from event_flags group by project_id
  ), opportunity_totals as (
    select ps.id project_id,count(o.id) opportunities,
      count(o.id) filter(where o.status='converted') conversions,
      coalesce(sum(o.confirmed_value) filter(where o.status='converted'),0) confirmed_value
    from project_set ps left join public.commercial_opportunities o
      on o.project_id=ps.id and o.created_at >= ps.period_start and o.created_at < observed_at
    group by ps.id
  ), rows as (
    select ps.*,
      coalesce(et.sessions,0) sessions,coalesce(et.intentions,0) intentions,
      coalesce(et.actions,0) actions,coalesce(et.external_actions,0) external_actions,
      coalesce(ot.opportunities,0) opportunities,coalesce(ot.conversions,0) conversions,
      coalesce(ot.confirmed_value,0) confirmed_value
    from project_set ps left join event_totals et on et.project_id=ps.id
    left join opportunity_totals ot on ot.project_id=ps.id
  )
  select jsonb_build_object(
    'periodStart',coalesce(min(period_start),observed_at-interval '7 days'),
    'periodEnd',observed_at,
    'hasPreviousVisit',bool_or(last_overview_seen_at is not null),
    'totals',jsonb_build_object(
      'sessions',coalesce(sum(sessions),0),'intentions',coalesce(sum(intentions),0),
      'actions',coalesce(sum(actions),0),'externalActions',coalesce(sum(external_actions),0),
      'opportunities',coalesce(sum(opportunities),0),'conversions',coalesce(sum(conversions),0),
      'confirmedValue',coalesce(sum(confirmed_value),0)
    ),
    'projects',coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'name',name,'slug',slug,'status',status,'publishedAt',published_at,
      'updatedAt',updated_at,'sessions',sessions,'intentions',intentions,'actions',actions,
      'externalActions',external_actions,'opportunities',opportunities,'conversions',conversions,
      'confirmedValue',confirmed_value
    ) order by updated_at desc),'[]'::jsonb)
  ) from rows;
$$;
revoke all on function public.get_workspace_operational_overview(uuid,uuid,timestamptz)
  from public,anon,authenticated;
grant execute on function public.get_workspace_operational_overview(uuid,uuid,timestamptz)
  to service_role;

-- Link approved experiments to the exact version that was subsequently published.
create or replace function public.link_published_optimization_experiments(
  target_project uuid,
  target_version uuid,
  published_at timestamptz
) returns integer
language plpgsql security definer set search_path = '' as $$
declare linked integer;
begin
  update public.optimization_experiments
  set candidate_version_id=target_version,status='collecting',applied_at=coalesce(applied_at,published_at),
      candidate_window_start=published_at,updated_at=now()
  where project_id=target_project and status in ('approved','published') and candidate_version_id is null;
  get diagnostics linked = row_count;
  return linked;
end $$;
revoke all on function public.link_published_optimization_experiments(uuid,uuid,timestamptz)
  from public,anon,authenticated;
grant execute on function public.link_published_optimization_experiments(uuid,uuid,timestamptz)
  to service_role;

comment on column public.visitor_sessions.project_version_id is
  'Immutable published experience version resolved by the server when the session starts.';
comment on table public.optimization_experiments is
  'Non-PII observational ledger: structured change, published versions and observed outcome.';
comment on column public.optimization_experiments.evaluation_method is
  'Descriptive before/after only; never a causal or statistical A/B claim.';
