# Task: Observabilidade — logs estruturados de erro (P1)

Projeto SOBE (Next.js 16 modificado, Tailwind v4, React 19, TS). Leia `AGENTS.md` antes de codar.

## Objetivo
Quando um usuário relatar "deu erro", conseguir rastrear o que aconteceu — sem criar plataforma própria e sem expor segredos.

## Estado atual (já existe — NÃO recriar)
- `src/server/http/with-authenticated-actor.ts` já gera/propaga `requestId` (`x-request-id`) e loga `authenticated_route_failed` em erros 500.
- 13 arquivos usam `console.error` ad-hoc (ex.: `billing-service.ts`, `src/app/api/public/bookings/route.ts`).
- `src/app/error.tsx` é o error boundary do client (sem report).
- NÃO há Sentry nem dependência de observabilidade. Deploy alvo: Vercel (logs agregados pela própria Vercel).

## O que implementar (mínimo e seguro)
1. Um helper único de log estruturado, ex.: `src/server/observability/log.ts`, que emite JSON em linha única com: `timestamp`, `level`, `event`, `requestId` (quando houver), `route` (pathname), `release` (commit SHA quando disponível), e contexto seguro (`workspaceId`/`userId` apenas quando disponíveis). NUNCA logar segredos/tokens/dados de cartão/conteúdo de lead.
2. Propagação consistente de `requestId` nas rotas públicas (`bookings`, `availability`, `orders`, `quotes`, `reservations` e derivadas), usando o mesmo padrão de header `x-request-id`.
3. Usar o helper nos pontos de erro das categorias exigidas: IA (`src/app/api/ai/**`), publicação (`src/server/publishing/**`), billing (`src/server/billing/**`, já parcial), scheduling (`src/app/api/public/bookings/**`, já parcial) e rotas autenticadas.
4. `src/app/error.tsx`: manter a UX atual; apenas expor o `requestId`/`digest` de forma visível para o usuário reportar no suporte.
5. `release`: ler de `VERCEL_GIT_COMMIT_SHA` (fallback: `NEXT_PUBLIC_APP_VERSION` ou `dev`). Não inventar valores.

## Proibido
- NÃO adicionar Sentry nem dependências novas (não há DSN disponível).
- NÃO criar plataforma própria de observabilidade — apenas logs estruturados para o sink existente.
- NÃO logar segredos, tokens, números de cartão ou dados sensíveis de leads/visitantes.
- NÃO alterar lógica de negócio, billing, scheduling ou RLS.
- NÃO mudar status codes nem mensagens devolvidas ao client.

## Critérios de aceite (verificação)
1. `npm run lint` passa.
2. `npm run typecheck` passa.
3. `npm run build` passa.
4. `npm test` (suíte) passa.
5. Grep no caminho de log NÃO revela `STRIPE_API_KEY`/`SUPABASE_SERVICE_ROLE_KEY`/`OPENAI_API_KEY` (sem vazamento de segredo).

## Relatório esperado
Listar arquivos criados/alterados, o formato final do log, e como verificou cada critério.
