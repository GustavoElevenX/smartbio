alter table public.ai_setup_sessions
  add column if not exists commercial_architecture jsonb,
  add column if not exists architecture_reviewed boolean not null default false,
  add column if not exists architecture_edited boolean not null default false;

comment on column public.ai_setup_sessions.commercial_architecture is
  'Arquitetura comercial context-first que origina ações legadas, capabilities e jornadas da primeira Sobe.';

comment on column public.ai_setup_sessions.architecture_reviewed is
  'Indica confirmação global da interpretação comercial, sem seleção manual de capabilities.';

alter table public.platform_marketing_events
  drop constraint if exists platform_marketing_events_event_name_check;
alter table public.platform_marketing_events
  add constraint platform_marketing_events_event_name_check check(event_name in (
    'marketing_page_viewed','marketing_section_viewed','marketing_cta_clicked','pricing_viewed',
    'register_viewed','register_started','register_submitted','account_created','email_confirmed',
    'onboarding_started','onboarding_stage_completed','commercial_architecture_generated',
    'commercial_architecture_confirmed','commercial_architecture_edited','commercial_architecture_regenerated',
    'onboarding_blocking_question_answered','onboarding_completed','project_created','presence_page_created',
    'first_structure_generated','first_public_preview_opened','publish_readiness_viewed',
    'first_project_published','project_published','first_traffic_received','first_opportunity_generated',
    'first_conversion_confirmed','dashboard_viewed','analytics_viewed','optimization_viewed','paywall_viewed',
    'trial_started','trial_expired','checkout_started','subscription_started','subscription_cancelled'
  ));
