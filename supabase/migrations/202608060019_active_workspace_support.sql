-- Fallback persistente para o workspace mais recente; o cookie continua sendo a seleção da sessão.
alter table public.profiles
  add column if not exists last_workspace_id uuid references public.workspaces(id) on delete set null;

alter table public.workspaces
  add column if not exists plan text not null default 'free';

create index if not exists profiles_last_workspace_idx on public.profiles(last_workspace_id)
  where last_workspace_id is not null;
