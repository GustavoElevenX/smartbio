-- Memória semântica canônica por projeto. Não é fonte operacional nem payload público.
create table public.project_commercial_contexts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version > 0),
  revision integer not null default 1 check (revision > 0),
  context jsonb not null default '{}'::jsonb,
  source_coverage jsonb not null default '{}'::jsonb,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  last_analyzed_at timestamptz,
  last_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_commercial_context_proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  base_revision integer not null check (base_revision > 0),
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  reason text not null,
  evidence jsonb not null default '[]'::jsonb,
  proposed_context jsonb not null,
  affected_intent_ids jsonb not null default '[]'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_commercial_contexts_updated_idx on public.project_commercial_contexts(project_id, updated_at desc);
create index project_commercial_context_proposals_pending_idx on public.project_commercial_context_proposals(project_id, created_at desc) where status = 'pending';

create trigger project_commercial_contexts_set_updated_at before update on public.project_commercial_contexts for each row execute function public.set_updated_at();
create trigger project_commercial_context_proposals_set_updated_at before update on public.project_commercial_context_proposals for each row execute function public.set_updated_at();

alter table public.project_commercial_contexts enable row level security;
alter table public.project_commercial_context_proposals enable row level security;

create policy "commercial context member all" on public.project_commercial_contexts for all to authenticated
  using (public.is_workspace_member(public.project_workspace(project_id)))
  with check (public.is_workspace_member(public.project_workspace(project_id)));

create policy "commercial context proposals member all" on public.project_commercial_context_proposals for all to authenticated
  using (public.is_workspace_member(public.project_workspace(project_id)))
  with check (public.is_workspace_member(public.project_workspace(project_id)));

grant select, insert, update on public.project_commercial_contexts, public.project_commercial_context_proposals to authenticated;
revoke all on public.project_commercial_contexts, public.project_commercial_context_proposals from anon;

comment on table public.project_commercial_contexts is 'Memória comercial semântica privada, durável e versionada por projeto.';
comment on column public.project_commercial_contexts.context is 'Fatos, relações, decisões e hipóteses estruturadas; não contém chain-of-thought nem duplica entidades operacionais como fonte de verdade.';
comment on table public.project_commercial_context_proposals is 'Divergências e atualizações propostas que exigem decisão explícita antes de alterar contexto confirmado.';

create or replace function public.save_project_commercial_context(
  p_workspace_id uuid,
  p_project_id uuid,
  p_actor_id uuid,
  p_expected_revision integer,
  p_schema_version integer,
  p_revision integer,
  p_context jsonb,
  p_source_coverage jsonb,
  p_confidence numeric,
  p_last_analyzed_at timestamptz,
  p_last_confirmed_at timestamptz,
  p_action text
) returns public.project_commercial_contexts
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous public.project_commercial_contexts%rowtype;
  saved public.project_commercial_contexts%rowtype;
begin
  if not exists (select 1 from public.projects where id = p_project_id and workspace_id = p_workspace_id) then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;
  select * into previous from public.project_commercial_contexts where project_id = p_project_id for update;
  if coalesce(previous.revision, 0) <> p_expected_revision or p_revision <> p_expected_revision + 1 then
    raise exception 'commercial_context_revision_conflict' using errcode = '40001';
  end if;
  insert into public.project_commercial_contexts(project_id,schema_version,revision,context,source_coverage,confidence,last_analyzed_at,last_confirmed_at)
  values(p_project_id,p_schema_version,p_revision,p_context,p_source_coverage,p_confidence,p_last_analyzed_at,p_last_confirmed_at)
  on conflict(project_id) do update set
    schema_version=excluded.schema_version,
    revision=excluded.revision,
    context=excluded.context,
    source_coverage=excluded.source_coverage,
    confidence=excluded.confidence,
    last_analyzed_at=excluded.last_analyzed_at,
    last_confirmed_at=excluded.last_confirmed_at,
    updated_at=now()
  returning * into saved;
  insert into public.commercial_audit_log(workspace_id,project_id,actor_id,object_type,object_id,action,before_state,after_state)
  values(p_workspace_id,p_project_id,p_actor_id,'project_commercial_context',saved.id,p_action,previous.context,p_context);
  return saved;
end $$;

revoke all on function public.save_project_commercial_context(uuid,uuid,uuid,integer,integer,integer,jsonb,jsonb,numeric,timestamptz,timestamptz,text) from public, anon, authenticated;
grant execute on function public.save_project_commercial_context(uuid,uuid,uuid,integer,integer,integer,jsonb,jsonb,numeric,timestamptz,timestamptz,text) to service_role;
