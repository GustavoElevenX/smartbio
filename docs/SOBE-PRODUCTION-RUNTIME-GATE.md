# P0-04 — Production Runtime Gate V1

O deploy oficial usa `npm run production:check`, que executa o gate de ambiente antes de lint, TypeScript, testes e build.

| Classificação | Variáveis / regra |
| --- | --- |
| REQUIRED_PRODUCTION | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RATE_LIMIT_SECRET`, `CRON_SECRET`, `CUSTOMER_IDENTITY_HASH_SECRET` |
| REQUIRED_PRODUCTION | `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` — endpoints públicos/IA usam rate limiting distribuído |
| REQUIRED_IF_FEATURE_ENABLED | OpenAI quando `NEXT_PUBLIC_FEATURE_AI=true`; Resend quando notificações estão ativas; Google Maps quando geo-routing está ativo; Stripe somente quando billing está ativo |
| OPTIONAL | Sentry, `EMAIL_REPLY_TO`, `DEFAULT_COUNTRY`, `DEFAULT_TIMEZONE` e flags desativadas |
| DEVELOPMENT_ONLY | `ENABLE_LOCAL_DEV_AUTH`, `NEXT_PUBLIC_ENABLE_LOCAL_DEV_STORE`, providers em memória e flags de teste |

Em produção, URLs públicas, callback e Supabase precisam usar HTTPS. O endpoint `/api/health/readiness` retorna somente estados booleanos e nunca segredos.

Projetos públicos consultam Supabase obrigatoriamente em produção. Fixtures/demo continuam disponíveis apenas quando o store local está explicitamente habilitado fora de produção.
