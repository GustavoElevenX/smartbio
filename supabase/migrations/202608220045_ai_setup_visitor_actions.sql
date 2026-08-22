alter table public.ai_setup_sessions
  add column if not exists visitor_actions jsonb not null default '[]'::jsonb,
  add column if not exists actions_confirmed boolean not null default false;
