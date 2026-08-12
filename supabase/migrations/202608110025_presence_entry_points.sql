alter table public.entry_points
  add column surface_mode text not null default 'presence' check (surface_mode in ('presence','landing','conversion_direct')),
  add column presence_page_id uuid references public.presence_pages(id) on delete set null;

alter table public.entry_points drop constraint if exists entry_points_check;
alter table public.entry_points add constraint entry_points_surface_destination_check check (
  (surface_mode in ('presence','landing') and (presence_page_id is not null or conversion_goal_id is not null or target_step_id is not null))
  or (surface_mode = 'conversion_direct' and (conversion_goal_id is not null or target_step_id is not null))
);

create index entry_points_presence_page_idx on public.entry_points(presence_page_id);
create index entry_points_surface_mode_idx on public.entry_points(project_id, surface_mode) where is_active;
