-- Single commercial offer and activation-based trial for the SOBE launch.
update public.platform_features
set name = 'Ações com IA', unit_label = 'ações/mês'
where feature_key = 'ai_generations_month';

update public.platform_features
set name = 'Remover marca SOBE'
where feature_key = 'remove_virou_branding';

insert into public.plan_catalog(
  plan_key,name,description,is_active,is_public,sort_order,billing_interval,display_price,currency,settings
) values (
  'trial','Período de teste','7 dias grátis iniciados após a primeira estrutura',true,false,5,null,0,'BRL',
  '{"starts_after_first_structure":true,"retention_days":30,"branding_required":true}'::jsonb
)
on conflict(plan_key) do update set
  name=excluded.name,description=excluded.description,is_active=excluded.is_active,is_public=excluded.is_public,
  sort_order=excluded.sort_order,billing_interval=excluded.billing_interval,display_price=excluded.display_price,
  currency=excluded.currency,settings=excluded.settings;

update public.plan_catalog set
  name='SOBE Pro',description='Uma estrutura digital preparada para gerar ações e oportunidades.',
  is_active=true,is_public=true,sort_order=10,billing_interval='month',display_price=69.90,currency='BRL',
  settings='{"launch_price":true,"public_limits":["1 negócio","5 páginas","3 membros","50 ações com IA/mês"]}'::jsonb
where plan_key='pro';

update public.plan_catalog set is_active=false,is_public=false where plan_key in ('free','business');

insert into public.plan_entitlements(plan_key,feature_key,enabled,limit_value)
select 'trial',feature_key,feature_key in (
  'projects','presence','presence_pages','conversion_goals','entry_points','journey','opportunities',
  'analytics_basic','qualification','ai_business_analysis','ai_journey','ai_presence',
  'ai_structure_suggestions','ai_page_edits','ai_generations_month','media_storage_mb','team_members'
),
  case feature_key
    when 'projects' then 1 when 'presence_pages' then 1 when 'team_members' then 1
    when 'ai_generations_month' then 10 when 'media_storage_mb' then 100 else null end
from public.platform_features
on conflict(plan_key,feature_key) do update set enabled=excluded.enabled,limit_value=excluded.limit_value;

insert into public.plan_entitlements(plan_key,feature_key,enabled,limit_value)
select 'pro',feature_key,feature_key <> 'custom_domain',
  case feature_key
    when 'projects' then 1 when 'presence_pages' then 5 when 'team_members' then 3
    when 'ai_generations_month' then 50 when 'media_storage_mb' then 100 else null end
from public.platform_features
on conflict(plan_key,feature_key) do update set enabled=excluded.enabled,limit_value=excluded.limit_value;

update public.plan_entitlements
set enabled=false
where plan_key='trial' and feature_key='remove_virou_branding';

update public.workspace_plan_assignments
set plan_key='trial',source='system',status='active',starts_at=now(),ends_at=null,
    reason='migrated_to_activation_based_trial',updated_at=now()
where plan_key='free';

drop trigger if exists workspace_default_plan on public.workspaces;
drop function if exists public.ensure_free_plan_assignment();
create or replace function public.ensure_trial_plan_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.workspace_plan_assignments(workspace_id,plan_key,source,status,starts_at,ends_at,reason)
  values(new.id,'trial','system','active',now(),null,'trial_waiting_for_first_structure')
  on conflict do nothing;
  return new;
end $$;
create trigger workspace_default_plan after insert on public.workspaces
for each row execute function public.ensure_trial_plan_assignment();
