-- Provider-independent plans, workspace assignments and entitlement overrides.
alter table public.workspaces add column if not exists plan text not null default 'free';
comment on column public.workspaces.plan is 'DEPRECATED compatibility cache. Never use for authorization; use workspace_plan_assignments.';

create table public.platform_features (
 feature_key text primary key,name text not null,description text,category text not null,
 feature_type text not null check(feature_type in ('boolean','limit')),unit_label text,
 is_active boolean not null default true,is_public boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.plan_catalog (
 plan_key text primary key,name text not null,description text,is_active boolean not null default true,is_public boolean not null default false,
 sort_order integer not null default 0,billing_interval text check(billing_interval is null or billing_interval in ('month','year')),
 display_price numeric(14,2),currency text default 'BRL',settings jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.plan_entitlements (
 plan_key text not null references public.plan_catalog(plan_key) on delete cascade,
 feature_key text not null references public.platform_features(feature_key) on delete cascade,
 enabled boolean not null default false,limit_value bigint,settings jsonb not null default '{}'::jsonb,
 primary key(plan_key,feature_key)
);
create table public.workspace_plan_assignments (
 workspace_id uuid primary key references public.workspaces(id) on delete cascade,
 plan_key text not null references public.plan_catalog(plan_key),source text not null check(source in ('system','manual','billing')),
 status text not null default 'active' check(status in ('active','suspended','expired')),starts_at timestamptz not null default now(),ends_at timestamptz,
 reason text,changed_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.workspace_entitlement_overrides (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 feature_key text not null references public.platform_features(feature_key),enabled_override boolean,limit_override bigint,
 starts_at timestamptz not null default now(),expires_at timestamptz,reason text not null,created_by uuid references public.profiles(id) on delete set null,
 revoked_at timestamptz,revoked_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),
 check(enabled_override is not null or limit_override is not null)
);
create table public.workspace_plan_history (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 previous_plan_key text,new_plan_key text not null,source text not null,reason text,actor_user_id uuid,created_at timestamptz not null default now()
);
create index workspace_plan_assignments_plan_status_idx on public.workspace_plan_assignments(plan_key,status);
create index entitlement_overrides_active_idx on public.workspace_entitlement_overrides(workspace_id,feature_key,expires_at) where revoked_at is null;
create trigger platform_features_updated_at before update on public.platform_features for each row execute function public.set_updated_at();
create trigger plan_catalog_updated_at before update on public.plan_catalog for each row execute function public.set_updated_at();
create trigger workspace_plan_assignments_updated_at before update on public.workspace_plan_assignments for each row execute function public.set_updated_at();

insert into public.platform_features(feature_key,name,category,feature_type,unit_label) values
 ('projects','Negócios','core','limit','negócios'),('presence','Presence','presence','boolean',null),('presence_pages','Páginas','presence','limit','páginas'),
 ('multi_page','Multi-page','presence','boolean',null),('conversion_goals','Objetivos','conversion','boolean',null),('entry_points','Entradas','conversion','boolean',null),
 ('journey','Journey','conversion','boolean',null),('opportunities','Oportunidades','conversion','boolean',null),('analytics_basic','Analytics básico','analytics','boolean',null),
 ('analytics_advanced','Analytics avançado','analytics','boolean',null),('activations','Ativações','activation','boolean',null),('active_activations','Ativações ativas','activation','limit','ativações'),
 ('benefit_claims','Benefícios','activation','boolean',null),('benefit_validators','Validadores','activation','boolean',null),('customer_history_import','Histórico de clientes','activation','boolean',null),
 ('qualification','Qualificação','commercial','boolean',null),('quotes','Orçamentos','commercial','boolean',null),('scheduling','Agendamentos','commercial','boolean',null),
 ('catalog_orders','Pedidos','commercial','boolean',null),('reservations','Reservas','commercial','boolean',null),('routing','Roteamento','routing','boolean',null),
 ('geo_routing','Geo routing','routing','boolean',null),('multi_unit','Múltiplas unidades','routing','boolean',null),('ai_business_analysis','Análise por IA','ai','boolean',null),
 ('ai_journey','Journey por IA','ai','boolean',null),('ai_presence','Presence por IA','ai','boolean',null),('ai_activation','Ativação por IA','ai','boolean',null),
 ('ai_optimization','Otimização por IA','ai','boolean',null),('ai_generations_month','Gerações de IA','ai','limit','gerações/mês'),
 ('media_storage_mb','Armazenamento','media','limit','MB'),('team_members','Membros','workspace','limit','membros'),('custom_domain','Domínio próprio','presence','boolean',null),
 ('remove_virou_branding','Remover marca Virou','presence','boolean',null)
on conflict(feature_key) do nothing;
insert into public.plan_catalog(plan_key,name,description,is_public,sort_order) values
 ('free','Free','Para começar com a Virou',true,10),('pro','Pro','Mais recursos para crescer',true,20),('business','Business','Operação completa',false,30)
on conflict(plan_key) do nothing;

insert into public.plan_entitlements(plan_key,feature_key,enabled,limit_value)
select p.plan_key,f.feature_key,
 case when p.plan_key='free' then f.feature_key in ('projects','presence','presence_pages','conversion_goals','entry_points','journey','opportunities','analytics_basic') else true end,
 case when f.feature_key='projects' then case p.plan_key when 'free' then 1 when 'pro' then 3 else null end
      when f.feature_key='presence_pages' then case p.plan_key when 'free' then 1 when 'pro' then 10 else null end
      when f.feature_key='active_activations' then case p.plan_key when 'free' then 0 when 'pro' then 5 else null end
      when f.feature_key='team_members' then case p.plan_key when 'free' then 1 when 'pro' then 3 else null end
      when f.feature_key='ai_generations_month' then case p.plan_key when 'free' then 5 when 'pro' then 100 else null end else null end
from public.plan_catalog p cross join public.platform_features f on conflict(plan_key,feature_key) do nothing;

insert into public.workspace_plan_assignments(workspace_id,plan_key,source,status)
select w.id,coalesce(case when s.plan_key in ('free','pro','business') then s.plan_key end,case when w.plan in ('free','pro','business') then w.plan end,'free'),'system','active'
from public.workspaces w left join public.subscriptions s on s.workspace_id=w.id on conflict(workspace_id) do nothing;

create or replace function public.ensure_free_plan_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.workspace_plan_assignments(workspace_id,plan_key,source,status) values(new.id,'free','system','active') on conflict do nothing; return new; end $$;
create trigger workspace_default_plan after insert on public.workspaces for each row execute function public.ensure_free_plan_assignment();

alter table public.platform_features enable row level security; alter table public.plan_catalog enable row level security;
alter table public.plan_entitlements enable row level security; alter table public.workspace_plan_assignments enable row level security;
alter table public.workspace_entitlement_overrides enable row level security; alter table public.workspace_plan_history enable row level security;
create policy "public features read" on public.platform_features for select to authenticated using(is_public and is_active);
create policy "public plans read" on public.plan_catalog for select to authenticated using(is_public and is_active);
create policy "public plan entitlements read" on public.plan_entitlements for select to authenticated using(exists(select 1 from public.plan_catalog p where p.plan_key=plan_entitlements.plan_key and p.is_public));
create policy "assignment member read" on public.workspace_plan_assignments for select to authenticated using(public.is_workspace_member(workspace_id));
create policy "override member read" on public.workspace_entitlement_overrides for select to authenticated using(public.is_workspace_member(workspace_id));
create policy "plan history owner read" on public.workspace_plan_history for select to authenticated using(public.is_workspace_owner(workspace_id));
revoke all on public.platform_features,public.plan_catalog,public.plan_entitlements,public.workspace_plan_assignments,public.workspace_entitlement_overrides,public.workspace_plan_history from anon;
