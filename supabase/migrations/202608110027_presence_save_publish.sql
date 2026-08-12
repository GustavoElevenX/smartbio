create or replace function public.save_presence_page(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_project_id uuid,
  p_expected_version integer,
  p_payload jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  project_row public.projects%rowtype;
  page_row public.presence_pages%rowtype;
  page_data jsonb := coalesce(p_payload->'page','{}'::jsonb);
  section_data jsonb;
  deleted_id jsonb;
  requested_page_id uuid := (page_data->>'id')::uuid;
  next_version integer;
begin
  select * into project_row from public.projects where id = p_project_id for update;
  if not found then raise exception 'project_not_found'; end if;
  if project_row.workspace_id <> p_workspace_id or not exists(select 1 from public.workspace_members where workspace_id = p_workspace_id and user_id = p_actor_id) then raise exception 'workspace_access_denied'; end if;

  select * into page_row from public.presence_pages where id = requested_page_id and project_id = p_project_id for update;
  if found and page_row.version <> p_expected_version then
    raise exception 'presence_page_version_conflict' using errcode = '40001', detail = page_row.version::text;
  end if;
  if not found and p_expected_version <> 0 then raise exception 'presence_page_version_conflict' using errcode = '40001', detail = '0'; end if;
  next_version := case when found then page_row.version + 1 else 1 end;

  if coalesce((page_data->>'isHome')::boolean, false) then
    update public.presence_pages set is_home = false, page_type = case when page_type='home' then 'page' else page_type end
      where project_id = p_project_id and id <> requested_page_id and is_home;
  end if;

  insert into public.presence_pages(id,project_id,page_key,name,page_type,path,title,description,seo_title,seo_description,og_image_asset_id,default_conversion_goal_id,is_home,is_active,is_indexable,version,settings)
  values(requested_page_id,p_project_id,page_data->>'key',page_data->>'name',page_data->>'type',page_data->>'path',page_data->>'title',page_data->>'description',page_data->>'seoTitle',page_data->>'seoDescription',nullif(page_data->>'ogImageAssetId','')::uuid,nullif(page_data->>'defaultConversionGoalId','')::uuid,coalesce((page_data->>'isHome')::boolean,false),coalesce((page_data->>'isActive')::boolean,true),coalesce((page_data->>'isIndexable')::boolean,true),next_version,coalesce(page_data->'settings','{}'::jsonb))
  on conflict(id) do update set page_key=excluded.page_key,name=excluded.name,page_type=excluded.page_type,path=excluded.path,title=excluded.title,description=excluded.description,seo_title=excluded.seo_title,seo_description=excluded.seo_description,og_image_asset_id=excluded.og_image_asset_id,default_conversion_goal_id=excluded.default_conversion_goal_id,is_home=excluded.is_home,is_active=excluded.is_active,is_indexable=excluded.is_indexable,version=excluded.version,settings=excluded.settings
  where public.presence_pages.project_id = p_project_id;

  for section_data in select value from jsonb_array_elements(coalesce(page_data->'sections','[]'::jsonb)) loop
    insert into public.presence_sections(id,page_id,section_key,section_type,anchor,title,eyebrow,description,content,style,settings,section_order,is_active)
    values((section_data->>'id')::uuid,requested_page_id,section_data->>'key',section_data->>'type',section_data->>'anchor',section_data->>'title',section_data->>'eyebrow',section_data->>'description',coalesce(section_data->'content','{}'::jsonb),coalesce(section_data->'style','{}'::jsonb),coalesce(section_data->'settings','{}'::jsonb),coalesce((section_data->>'order')::integer,0),coalesce((section_data->>'isActive')::boolean,true))
    on conflict(id) do update set section_key=excluded.section_key,section_type=excluded.section_type,anchor=excluded.anchor,title=excluded.title,eyebrow=excluded.eyebrow,description=excluded.description,content=excluded.content,style=excluded.style,settings=excluded.settings,section_order=excluded.section_order,is_active=excluded.is_active
    where public.presence_sections.page_id = requested_page_id;
  end loop;

  for deleted_id in select value from jsonb_array_elements(coalesce(p_payload->'deletedSectionIds','[]'::jsonb)) loop
    delete from public.presence_sections where id = (deleted_id#>>'{}')::uuid and page_id = requested_page_id;
  end loop;

  return jsonb_build_object('pageId', requested_page_id, 'version', next_version, 'updatedAt', now());
end;
$$;

grant execute on function public.save_presence_page(uuid,uuid,uuid,integer,jsonb) to authenticated;
