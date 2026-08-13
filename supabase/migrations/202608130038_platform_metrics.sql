-- Aggregated platform read models; callable only by service_role.
create or replace function public.get_platform_overview_metrics(period_start timestamptz,period_end timestamptz)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'usersTotal',(select count(*) from public.profiles),'usersNew',(select count(*) from public.profiles where created_at>=period_start and created_at<period_end),
  'workspacesTotal',(select count(*) from public.workspaces),'workspacesNew',(select count(*) from public.workspaces where created_at>=period_start and created_at<period_end),
  'projectsTotal',(select count(*) from public.projects),'projectsPublished',(select count(*) from public.projects where status='published'),
  'presencePagesTotal',(select count(*) from public.presence_pages),'activationsActive',(select count(*) from public.conversion_activations where status in ('active','scheduled') and published_at is not null and (ends_at is null or ends_at>now())),
  'visitorSessions',(select count(*) from public.visitor_sessions where started_at>=period_start and started_at<period_end),
  'opportunities',(select count(*) from public.commercial_opportunities where created_at>=period_start and created_at<period_end),
  'conversions',(select count(*) from public.commercial_opportunities where status='converted' and converted_at>=period_start and converted_at<period_end),
  'conversionsWithKnownValue',(select count(*) from public.commercial_opportunities where status='converted' and confirmed_value is not null and converted_at>=period_start and converted_at<period_end),
  'confirmedValue',(select coalesce(sum(confirmed_value),0) from public.commercial_opportunities where status='converted' and converted_at>=period_start and converted_at<period_end),
  'planDistribution',(select coalesce(jsonb_object_agg(plan_key,total),'{}'::jsonb) from (select plan_key,count(*) total from public.workspace_plan_assignments where status='active' group by plan_key) p)
 );
$$;
revoke all on function public.get_platform_overview_metrics(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.get_platform_overview_metrics(timestamptz,timestamptz) to service_role;

create or replace function public.get_platform_activation_funnel(period_start timestamptz,period_end timestamptz)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'registered',(select count(*) from public.workspaces where created_at<period_end),
  'createdProject',(select count(distinct workspace_id) from public.projects where created_at<period_end),
  'published',(select count(distinct workspace_id) from public.projects where published_at is not null and published_at<period_end),
  'receivedTraffic',(select count(distinct p.workspace_id) from public.visitor_sessions s join public.projects p on p.id=s.project_id where s.started_at>=period_start and s.started_at<period_end),
  'generatedOpportunity',(select count(distinct workspace_id) from public.commercial_opportunities where created_at>=period_start and created_at<period_end),
  'confirmedConversion',(select count(distinct workspace_id) from public.commercial_opportunities where status='converted' and converted_at>=period_start and converted_at<period_end)
 );
$$;
revoke all on function public.get_platform_activation_funnel(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.get_platform_activation_funnel(timestamptz,timestamptz) to service_role;

create or replace function public.get_platform_workspace_health(period_start timestamptz,period_end timestamptz)
returns table(
 workspace_id uuid,last_activity_at timestamptz,projects bigint,published_projects bigint,
 sessions_30d bigint,opportunities_30d bigint,conversions_30d bigint,health_state text
) language sql stable security definer set search_path='' as $$
 with aggregated as (
  select w.id workspace_id,
   greatest(w.updated_at,p.last_activity_at,a.last_activity_at) last_activity_at,
   coalesce(p.projects,0) projects,coalesce(p.published_projects,0) published_projects,
   coalesce(p.sessions_30d,0) sessions_30d,coalesce(o.opportunities_30d,0) opportunities_30d,
   coalesce(o.conversions_30d,0) conversions_30d
  from public.workspaces w
  left join lateral(select max(p.updated_at) last_activity_at,count(*) projects,
   count(*) filter(where p.status='published') published_projects,
   (select count(*) from public.visitor_sessions s where s.project_id in(select p2.id from public.projects p2 where p2.workspace_id=w.id)
     and s.started_at>=period_start and s.started_at<period_end) sessions_30d
   from public.projects p where p.workspace_id=w.id) p on true
  left join lateral(select max(a.updated_at) last_activity_at from public.conversion_activations a where a.workspace_id=w.id) a on true
  left join lateral(select count(*) filter(where o.created_at>=period_start and o.created_at<period_end) opportunities_30d,
   count(*) filter(where o.status='converted' and o.converted_at>=period_start and o.converted_at<period_end) conversions_30d
   from public.commercial_opportunities o where o.workspace_id=w.id) o on true
 ) select *,case
   when last_activity_at<period_start then 'inactive'
   when projects=0 then 'not_activated'
   when published_projects>0 and sessions_30d=0 then 'published_no_traffic'
   when sessions_30d>0 and opportunities_30d=0 then 'traffic_no_opportunity'
   when conversions_30d>0 then 'confirming_conversions'
   else 'generating_opportunities' end health_state from aggregated;
$$;
revoke all on function public.get_platform_workspace_health(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.get_platform_workspace_health(timestamptz,timestamptz) to service_role;

create or replace function public.get_platform_workspace_detail_metrics(target_workspace uuid,period_start timestamptz,period_end timestamptz)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'pages',(select count(*) from public.presence_pages pp join public.projects p on p.id=pp.project_id where p.workspace_id=target_workspace),
  'activations',(select count(*) from public.conversion_activations where workspace_id=target_workspace),
  'activeActivations',(select count(*) from public.conversion_activations where workspace_id=target_workspace and status in ('active','scheduled') and published_at is not null and (ends_at is null or ends_at>now())),
  'opportunities30d',(select count(*) from public.commercial_opportunities where workspace_id=target_workspace and created_at>=period_start and created_at<period_end),
  'conversions30d',(select count(*) from public.commercial_opportunities where workspace_id=target_workspace and status='converted' and converted_at>=period_start and converted_at<period_end),
  'confirmedValue30d',(select coalesce(sum(confirmed_value),0) from public.commercial_opportunities where workspace_id=target_workspace and status='converted' and converted_at>=period_start and converted_at<period_end),
  'lastActivityAt',(select greatest(w.updated_at,(select max(p.updated_at) from public.projects p where p.workspace_id=w.id),(select max(a.updated_at) from public.conversion_activations a where a.workspace_id=w.id)) from public.workspaces w where w.id=target_workspace)
 );
$$;
revoke all on function public.get_platform_workspace_detail_metrics(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.get_platform_workspace_detail_metrics(uuid,timestamptz,timestamptz) to service_role;
