-- First-party acquisition analytics for the SOBE platform itself.
-- This domain is intentionally separate from customer project analytics.
create table public.platform_marketing_visitors (
  id uuid primary key default gen_random_uuid(),
  visitor_key text unique not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  first_referrer text,
  first_landing_path text,
  first_utm_source text,
  first_utm_medium text,
  first_utm_campaign text,
  first_utm_content text,
  first_utm_term text,
  country_code text,
  region text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_marketing_sessions (
  id uuid primary key default gen_random_uuid(),
  session_key text unique not null,
  visitor_id uuid not null references public.platform_marketing_visitors(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  landing_path text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  device_type text not null default 'unknown',
  browser_family text,
  os_family text,
  created_at timestamptz not null default now()
);

create table public.platform_marketing_events (
  id bigint generated always as identity primary key,
  visitor_id uuid references public.platform_marketing_visitors(id) on delete set null,
  session_id uuid references public.platform_marketing_sessions(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  event_name text not null check(event_name in (
    'marketing_page_viewed','marketing_section_viewed','marketing_cta_clicked','pricing_viewed',
    'register_viewed','register_started','register_submitted','account_created','email_confirmed',
    'onboarding_started','onboarding_completed','project_created','presence_page_created',
    'project_published','checkout_started','subscription_started','subscription_cancelled'
  )),
  path text,
  element_key text,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz not null default now(),
  check(jsonb_typeof(metadata)='object' and pg_column_size(metadata)<=8192)
);

create unique index platform_marketing_events_idempotency_idx
  on public.platform_marketing_events(idempotency_key);

create table public.platform_signup_attribution (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  visitor_id uuid references public.platform_marketing_visitors(id) on delete set null,
  signup_session_id uuid references public.platform_marketing_sessions(id) on delete set null,
  first_touch jsonb not null default '{}'::jsonb,
  signup_touch jsonb not null default '{}'::jsonb,
  linked_at timestamptz not null default now()
);

create table public.platform_customer_notes (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid references public.profiles(id) on delete cascade,
  target_workspace_id uuid references public.workspaces(id) on delete cascade,
  admin_user_id uuid not null references public.platform_admins(user_id) on delete restrict,
  note text not null check(length(trim(note)) between 2 and 4000),
  created_at timestamptz not null default now(),
  check(target_user_id is not null or target_workspace_id is not null)
);

create index platform_marketing_events_created_idx on public.platform_marketing_events(created_at desc);
create index platform_marketing_events_name_created_idx on public.platform_marketing_events(event_name,created_at desc);
create index platform_marketing_events_visitor_created_idx on public.platform_marketing_events(visitor_id,created_at);
create index platform_marketing_events_user_created_idx on public.platform_marketing_events(user_id,created_at);
create index platform_marketing_sessions_started_idx on public.platform_marketing_sessions(started_at desc);
create index platform_marketing_sessions_source_idx on public.platform_marketing_sessions(utm_source,utm_medium,started_at desc);
create index platform_signup_attribution_workspace_idx on public.platform_signup_attribution(workspace_id);
create index platform_customer_notes_user_idx on public.platform_customer_notes(target_user_id,created_at desc);
create index platform_customer_notes_workspace_idx on public.platform_customer_notes(target_workspace_id,created_at desc);
create trigger platform_marketing_visitors_updated_at before update on public.platform_marketing_visitors
  for each row execute function public.set_updated_at();

alter table public.platform_marketing_visitors enable row level security;
alter table public.platform_marketing_sessions enable row level security;
alter table public.platform_marketing_events enable row level security;
alter table public.platform_signup_attribution enable row level security;
alter table public.platform_customer_notes enable row level security;
revoke all on public.platform_marketing_visitors,public.platform_marketing_sessions,
  public.platform_marketing_events,public.platform_signup_attribution,public.platform_customer_notes
  from public,anon,authenticated;

create or replace function public.get_platform_growth_overview(period_start timestamptz,period_end timestamptz)
returns jsonb language sql stable security definer set search_path='' as $$
  with period_events as (
    select * from public.platform_marketing_events where created_at>=period_start and created_at<period_end
  )
  select jsonb_build_object(
    'uniqueVisitors',(select count(distinct visitor_id) from period_events where event_name='marketing_page_viewed'),
    'sessions',(select count(distinct session_id) from period_events where event_name='marketing_page_viewed'),
    'ctaClicks',(select count(*) from period_events where event_name='marketing_cta_clicked'),
    'accountsCreated',(select count(distinct user_id) from period_events where event_name='account_created'),
    'workspacesActivated',(select count(distinct workspace_id) from period_events where event_name in ('onboarding_completed','project_created')),
    'projectsCreated',(select count(*) from period_events where event_name='project_created'),
    'pagesCreated',(select count(*) from period_events where event_name='presence_page_created'),
    'projectsPublished',(select count(*) from period_events where event_name='project_published'),
    'paidSubscriptions',(select count(distinct workspace_id) from period_events where event_name='subscription_started'),
    'newVisitors',(select count(*) from public.platform_marketing_visitors where first_seen_at>=period_start and first_seen_at<period_end),
    'returningVisitors',(select count(distinct s.visitor_id) from public.platform_marketing_sessions s where s.started_at>=period_start and s.started_at<period_end and exists(select 1 from public.platform_marketing_visitors v where v.id=s.visitor_id and v.first_seen_at<period_start)),
    'usersTotal',(select count(*) from public.profiles),
    'workspacesTotal',(select count(*) from public.workspaces),
    'projectsTotal',(select count(*) from public.projects),
    'publishedTotal',(select count(*) from public.projects where status='published'),
    'inactiveWorkspaces',(select count(*) from public.workspaces where account_status='suspended'),
    'recentUsers',(select count(*) from public.profiles where last_seen_at>=period_start and last_seen_at<period_end)
  );
$$;

create or replace function public.get_platform_growth_funnel(period_start timestamptz,period_end timestamptz)
returns jsonb language sql stable security definer set search_path='' as $$
  with e as (select * from public.platform_marketing_events where created_at>=period_start and created_at<period_end),
  counts as (
    select 1 step,'visitor' key,'Visitantes' label,count(distinct visitor_id)::bigint total from e where event_name='marketing_page_viewed'
    union all select 2,'cta','CTA',count(distinct visitor_id) from e where event_name='marketing_cta_clicked'
    union all select 3,'account','Cadastro',count(distinct user_id) from e where event_name='account_created'
    union all select 4,'onboarding','Onboarding',count(distinct user_id) from e where event_name='onboarding_completed'
    union all select 5,'project','Projeto criado',count(distinct user_id) from e where event_name='project_created'
    union all select 6,'published','Publicado',count(distinct user_id) from e where event_name='project_published'
    union all select 7,'paid','Pagante',count(distinct user_id) from e where event_name='subscription_started'
  ), sequenced as (
    select *,lag(total) over(order by step) previous from counts
  )
  select coalesce(jsonb_agg(jsonb_build_object('key',key,'label',label,'total',total,'conversion',case when previous is null or previous=0 then null else round(total::numeric*100/previous,1) end) order by step),'[]'::jsonb) from sequenced;
$$;

create or replace function public.get_platform_acquisition_sources(period_start timestamptz,period_end timestamptz)
returns table(source text,medium text,campaign text,visitors bigint,cta_clicks bigint,signups bigint,published bigint,paid bigint,visitor_to_signup numeric,signup_to_paid numeric)
language sql stable security definer set search_path='' as $$
  with flags as (
    select v.id,coalesce(nullif(v.first_utm_source,''),'direct') source,coalesce(nullif(v.first_utm_medium,''),'none') medium,coalesce(nullif(v.first_utm_campaign,''),'—') campaign,
      bool_or(e.event_name='marketing_cta_clicked') cta,bool_or(e.event_name='account_created') signup,
      bool_or(e.event_name='project_published') published,bool_or(e.event_name='subscription_started') paid
    from public.platform_marketing_visitors v join public.platform_marketing_events e on e.visitor_id=v.id
    where e.created_at>=period_start and e.created_at<period_end group by v.id
  )
  select source,medium,campaign,count(*) visitors,count(*) filter(where cta) cta_clicks,count(*) filter(where signup) signups,
    count(*) filter(where published) published,count(*) filter(where paid) paid,
    round(count(*) filter(where signup)::numeric*100/nullif(count(*),0),1),
    round(count(*) filter(where paid)::numeric*100/nullif(count(*) filter(where signup),0),1)
  from flags group by source,medium,campaign order by visitors desc,signups desc;
$$;

create or replace function public.get_platform_marketing_ctas(period_start timestamptz,period_end timestamptz)
returns table(element_key text,utm_content text,clicks bigint,visitors bigint,signups bigint,signup_rate numeric)
language sql stable security definer set search_path='' as $$
  with clicks as (
    select e.element_key,coalesce(s.utm_content,'—') utm_content,e.visitor_id
    from public.platform_marketing_events e left join public.platform_marketing_sessions s on s.id=e.session_id
    where e.event_name='marketing_cta_clicked' and e.created_at>=period_start and e.created_at<period_end
  )
  select c.element_key,c.utm_content,count(*) clicks,count(distinct c.visitor_id) visitors,
    count(distinct c.visitor_id) filter(where exists(select 1 from public.platform_signup_attribution a where a.visitor_id=c.visitor_id)) signups,
    round(count(distinct c.visitor_id) filter(where exists(select 1 from public.platform_signup_attribution a where a.visitor_id=c.visitor_id))::numeric*100/nullif(count(distinct c.visitor_id),0),1)
  from clicks c group by c.element_key,c.utm_content order by clicks desc;
$$;

create or replace function public.get_platform_user_360(target_user uuid,period_start timestamptz,period_end timestamptz)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'profile',(select to_jsonb(p) from public.profiles p where p.id=target_user),
    'attribution',(select jsonb_build_object('firstTouch',a.first_touch,'signupTouch',a.signup_touch,'linkedAt',a.linked_at,'visitorId',a.visitor_id,'signupSessionId',a.signup_session_id,
      'firstSeenAt',v.first_seen_at,'firstLanding',v.first_landing_path,'firstReferrer',v.first_referrer)
      from public.platform_signup_attribution a left join public.platform_marketing_visitors v on v.id=a.visitor_id where a.user_id=target_user),
    'workspaces',(select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'role',wm.role,'plan',pa.plan_key,'planSource',pa.source,'planStatus',pa.status,
      'subscription',case when s.id is null then null else jsonb_build_object('status',s.status,'provider',s.provider,'externalId',s.external_subscription_id,'periodEnd',s.current_period_end,'cancelAtPeriodEnd',s.cancel_at_period_end) end)),'[]'::jsonb)
      from public.workspace_members wm join public.workspaces w on w.id=wm.workspace_id left join public.workspace_plan_assignments pa on pa.workspace_id=w.id left join public.subscriptions s on s.workspace_id=w.id where wm.user_id=target_user),
    'pages',(select coalesce(jsonb_agg(jsonb_build_object('id',pp.id,'pageKey',pp.page_key,'name',pp.name,'projectId',p.id,'project',p.name,'slug',p.slug,'path',pp.path,'home',pp.is_home,'active',pp.is_active,'published',p.status='published','updatedAt',pp.updated_at) order by pp.updated_at desc),'[]'::jsonb)
      from public.workspace_members wm join public.projects p on p.workspace_id=wm.workspace_id join public.presence_pages pp on pp.project_id=p.id where wm.user_id=target_user),
    'usage',(select jsonb_build_object('workspaces',count(distinct wm.workspace_id),'projects',count(distinct p.id),'pages',count(distinct pp.id),'published',count(distinct p.id) filter(where p.status='published'),'sessions',count(distinct vs.id),'opportunities',count(distinct o.id))
      from public.workspace_members wm left join public.projects p on p.workspace_id=wm.workspace_id left join public.presence_pages pp on pp.project_id=p.id left join public.visitor_sessions vs on vs.project_id=p.id and vs.started_at>=period_start and vs.started_at<period_end left join public.commercial_opportunities o on o.workspace_id=wm.workspace_id and o.created_at>=period_start and o.created_at<period_end where wm.user_id=target_user),
    'timeline',(select coalesce(jsonb_agg(jsonb_build_object('name',e.event_name,'createdAt',e.created_at,'path',e.path,'elementKey',e.element_key,'metadata',e.metadata) order by e.created_at desc),'[]'::jsonb) from public.platform_marketing_events e where e.user_id=target_user or e.visitor_id=(select visitor_id from public.platform_signup_attribution where user_id=target_user)),
    'planHistory',(select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc),'[]'::jsonb) from public.workspace_plan_history h where h.workspace_id in(select workspace_id from public.workspace_members where user_id=target_user)),
    'notes',(select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'note',n.note,'adminUserId',n.admin_user_id,'createdAt',n.created_at) order by n.created_at desc),'[]'::jsonb) from public.platform_customer_notes n where n.target_user_id=target_user)
  );
$$;

revoke all on function public.get_platform_growth_overview(timestamptz,timestamptz),
  public.get_platform_growth_funnel(timestamptz,timestamptz),
  public.get_platform_acquisition_sources(timestamptz,timestamptz),
  public.get_platform_marketing_ctas(timestamptz,timestamptz),
  public.get_platform_user_360(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.get_platform_growth_overview(timestamptz,timestamptz),
  public.get_platform_growth_funnel(timestamptz,timestamptz),
  public.get_platform_acquisition_sources(timestamptz,timestamptz),
  public.get_platform_marketing_ctas(timestamptz,timestamptz),
  public.get_platform_user_360(uuid,timestamptz,timestamptz) to service_role;
