create table if not exists public.ai_site_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  expected_version integer not null check (expected_version >= 0),
  target text not null check (target in ('site', 'page')),
  page_id uuid references public.presence_pages(id) on delete cascade,
  payload jsonb not null,
  selected_operation_ids jsonb,
  status text not null default 'pending' check (status in ('pending', 'applied', 'dismissed', 'outdated')),
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_site_proposals_project_created_idx
  on public.ai_site_proposals(project_id, created_at desc);

alter table public.ai_site_proposals enable row level security;

create policy "workspace members can read site proposals"
  on public.ai_site_proposals for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can create site proposals"
  on public.ai_site_proposals for insert
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

create policy "workspace members can update site proposals"
  on public.ai_site_proposals for update
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

insert into public.platform_features(feature_key, name, description, category, feature_type, unit_label) values
  ('presence_sections_per_page', 'Seções por página', 'Limite operacional de seções em cada página.', 'presence', 'limit', 'seções'),
  ('catalog_large', 'Catálogo grande', 'Busca, filtros e paginação para catálogos extensos.', 'commercial', 'boolean', null),
  ('ai_structure_suggestions', 'Estrutura por IA', 'Propostas confirmáveis para a estrutura do site.', 'ai', 'boolean', null),
  ('ai_page_edits', 'Edição de página por IA', 'Propostas confirmáveis para páginas e seções.', 'ai', 'boolean', null)
on conflict(feature_key) do nothing;

insert into public.plan_entitlements (plan_key, feature_key, enabled, limit_value)
select pc.plan_key, feature.key, feature.enabled, feature.limit_value
from public.plan_catalog pc
cross join (values
  ('presence_sections_per_page', true, 20),
  ('catalog_large', true, null::integer),
  ('ai_structure_suggestions', true, null::integer),
  ('ai_page_edits', true, null::integer)
) as feature(key, enabled, limit_value)
where pc.is_active = true
on conflict (plan_key, feature_key) do nothing;
