alter table public.ai_setup_sessions
  add column if not exists answer_contexts jsonb not null default '[]'::jsonb,
  add column if not exists answer_context_audit jsonb;

comment on column public.ai_setup_sessions.answer_contexts is
  'Respostas livres interpretadas com texto integral, fatos explícitos, evidência, origem e vínculos contextuais usados na criação guiada.';

comment on column public.ai_setup_sessions.answer_context_audit is
  'Auditoria da cobertura das respostas confirmadas na primeira versão, sem descarte silencioso.';
