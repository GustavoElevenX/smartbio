alter table public.ai_setup_sessions
  add column if not exists discovery_plan jsonb;

comment on column public.ai_setup_sessions.discovery_plan is
  'Plano contextual persistido antes das perguntas de descoberta assistida.';
