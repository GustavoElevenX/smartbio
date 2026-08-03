-- Operações atômicas de publicação e restauração.
create or replace function public.publish_project(target_project uuid)
returns public.projects language plpgsql security invoker set search_path = '' as $$
declare result public.projects; next_version integer; snapshot jsonb;
begin
  if not public.is_workspace_member(public.project_workspace(target_project)) then raise exception 'access denied'; end if;
  if not exists(select 1 from public.journey_steps where project_id = target_project and is_active) then raise exception 'project needs at least one active step'; end if;
  select coalesce(max(version_number), 0) + 1 into next_version from public.project_versions where project_id = target_project;
  select jsonb_build_object('project', to_jsonb(p), 'brand', (select to_jsonb(b) from public.brand_profiles b where b.project_id = p.id), 'steps', (select coalesce(jsonb_agg(to_jsonb(s) order by s.step_order), '[]'::jsonb) from public.journey_steps s where s.project_id = p.id), 'options', (select coalesce(jsonb_agg(to_jsonb(o) order by o.option_order), '[]'::jsonb) from public.step_options o join public.journey_steps s on s.id = o.step_id where s.project_id = p.id)) into snapshot from public.projects p where p.id = target_project;
  insert into public.project_versions(project_id, version_number, snapshot, created_by) values (target_project, next_version, snapshot, auth.uid());
  update public.projects set status = 'published', published_at = now() where id = target_project returning * into result;
  return result;
end;
$$;

create or replace function public.restore_project_version(target_version uuid)
returns public.projects language plpgsql security invoker set search_path = '' as $$
declare version_row public.project_versions; result public.projects;
begin
  select * into version_row from public.project_versions where id = target_version;
  if version_row.id is null or not public.is_workspace_member(public.project_workspace(version_row.project_id)) then raise exception 'access denied'; end if;
  update public.projects set name = version_row.snapshot->'project'->>'name', description = version_row.snapshot->'project'->>'description', theme = coalesce(version_row.snapshot->'project'->'theme', '{}'::jsonb), settings = coalesce(version_row.snapshot->'project'->'settings', '{}'::jsonb), status = 'draft' where id = version_row.project_id returning * into result;
  return result;
end;
$$;

grant execute on function public.publish_project(uuid), public.restore_project_version(uuid) to authenticated;
