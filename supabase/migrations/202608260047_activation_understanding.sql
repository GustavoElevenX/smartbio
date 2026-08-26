alter table public.ai_setup_sessions
  add column if not exists activation_understanding jsonb;

comment on column public.ai_setup_sessions.activation_understanding is
  'Entendimento contextual persistido que origina ações, ofertas, destino e DiscoveryPlan da Activation.';
