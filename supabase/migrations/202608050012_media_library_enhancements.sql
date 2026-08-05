-- Evolução da biblioteca existente; originais e rascunhos ficam privados.
alter table public.media_assets
  add column if not exists alt_text text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists duration_seconds numeric check (duration_seconds is null or duration_seconds >= 0),
  add column if not exists status text not null default 'ready',
  add column if not exists updated_at timestamptz not null default now();

alter table public.media_assets drop constraint if exists media_assets_asset_type_check;
alter table public.media_assets add constraint media_assets_asset_type_check check (asset_type in ('logo','favicon','image','video','background','product','service','accommodation','portfolio','testimonial','document_preview'));

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'media_assets_status_check' and conrelid = 'public.media_assets'::regclass) then
    alter table public.media_assets add constraint media_assets_status_check check (status in ('processing','ready','failed','published'));
  end if;
end $$;

create index if not exists media_assets_project_created_idx on public.media_assets(project_id, created_at desc) where project_id is not null;
create index if not exists media_assets_project_type_idx on public.media_assets(project_id, asset_type, status) where project_id is not null;
create index if not exists media_assets_tags_idx on public.media_assets using gin(tags);

drop trigger if exists media_assets_set_updated_at on public.media_assets;
create trigger media_assets_set_updated_at before update on public.media_assets for each row execute function public.set_updated_at();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('media-private','media-private',false,20971520,array['image/png','image/jpeg','image/webp','image/svg+xml','video/mp4','video/webm']),
       ('media-public','media-public',true,20971520,array['image/png','image/jpeg','image/webp','image/svg+xml','video/mp4','video/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media private member read" on storage.objects;
drop policy if exists "media private member insert" on storage.objects;
drop policy if exists "media private member update" on storage.objects;
drop policy if exists "media private member delete" on storage.objects;
drop policy if exists "media public published read" on storage.objects;
create policy "media private member read" on storage.objects for select to authenticated using (bucket_id = 'media-private' and public.is_workspace_member((storage.foldername(name))[1]::uuid));
create policy "media private member insert" on storage.objects for insert to authenticated with check (bucket_id = 'media-private' and public.is_workspace_member((storage.foldername(name))[1]::uuid));
create policy "media private member update" on storage.objects for update to authenticated using (bucket_id = 'media-private' and public.is_workspace_member((storage.foldername(name))[1]::uuid));
create policy "media private member delete" on storage.objects for delete to authenticated using (bucket_id = 'media-private' and public.is_workspace_member((storage.foldername(name))[1]::uuid));
create policy "media public published read" on storage.objects for select to anon, authenticated using (bucket_id = 'media-public');
