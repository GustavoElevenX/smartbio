# Relatório de lançamento e Conversion Intelligence

Data: 24 de agosto de 2026.

## 1. Resumo executivo

**IMPLEMENTADO:** fechamento server-first do dashboard, URLs públicas reais, QR local, presets de entrada/campanha, attribution imutável por versão publicada, analytics por entrada e versão, lifecycle de Activation/Usage/WTP, funil administrativo, resumo de valor antes do upgrade, feedback de cancelamento e learning loop observacional manual.

A mudança preserva o modelo Stripe → subscription snapshot → plan assignment/entitlements, preview sem analytics e confirmação manual de conversão/valor. O produto não fabrica resultado: estados sem evidência mostram zero ou insuficiência, e aprendizados exibidos vêm somente de experimentos avaliados.

## 2. Migrations criadas

`202608240046_conversion_intelligence.sql` é aditiva e contém:

- `projects.published_version_id`: identidade da versão que está pública.
- `visitor_sessions.project_version_id`: versão congelada no início da sessão.
- `analytics_events.project_version_id` e `idempotency_key`: inheritance e deduplicação.
- `commercial_opportunities.project_version_id`: attribution comercial herdada da sessão.
- `project_member_product_state`: última visualização de overview, analytics e otimização por membro/projeto.
- `optimization_experiments`: mudança estruturada, baseline/candidate version, janelas, métricas, delta, método observacional e resultado.
- `workspace_optimization_policies`: modo manual como default; auto low-risk permanece sem executor/publicação automática.
- `subscription_cancellation_feedback`: motivo e comentário opcional, separado de dados financeiros.
- índices compostos/únicos, RLS nas novas tabelas e expansão validada dos eventos first-party.
- RPC server-only `get_workspace_operational_overview` e RPC de vínculo experimento → candidate version.

## 3. Fluxos implementados

### Dashboard e Usage

- Página `/app` é um Server Component que recebe um DTO sem PII do serviço/RPC.
- “Desde sua última visita”, seis métricas, próxima melhor ação determinística, Performance Copilot, negócios, funil e aprendizados calculados.
- URLs usam o domínio configurado; nenhum `smart.bio` é exibido.
- Visualizações autenticadas alimentam `project_member_product_state` e lifecycle idempotente.

### Entradas e dogfood

- Presets: Bio/Story/Reel do Instagram, TikTok, YouTube, LinkedIn, anúncio, QR e outro.
- UTM source/medium/content/term com campanha preservada e editável.
- Painel por origem apresenta sessões, intenções, ações, oportunidades, conversões e valor confirmado.
- QR SVG gerado no client pela biblioteca local `qrcode`; nenhuma chamada a `api.qrserver.com`.

### Versionamento e conversão

- Publicação cria snapshot recuperável, salva o ID/numero da versão e liga experimentos aprovados.
- Nova sessão resolve a versão publicada no servidor; o client não escolhe version ID.
- Eventos e oportunidades herdam a versão da sessão.
- Conversão só gera evento na transição real de estado, evitando dupla contagem.
- Analytics compara intention/action/opportunity/conversion rate e valor confirmado por sessão entre versões, sempre com suficiência explícita.
- Backfill seguro propaga somente versão já conhecida na sessão; histórico desconhecido permanece `null`.

### Conversion Intelligence

- Thresholds centralizados e regras determinísticas para `goal_dropoff`, `entry_underperformance`, `journey_friction`, `presence_cta` e `presence_structure`.
- Mudanças propostas são JSON estruturado com before/after, métrica e risco.
- Fluxo manual: sugestão → proposta revisável → aprovação → próxima publicação → candidate version → coleta → avaliação server-side.
- Método `observational_before_after_v1`; linguagem causal não é usada.
- `destination_friction` ficou explicitamente desativado nesta versão: não há uma regra robusta que controle mix de destino, disponibilidade e volume comparável sem confundir resultado.
- `redirect_control` não foi implementado. Inseri-lo agora exigiria nova semântica pública e de oportunidade, com risco de quebrar o modelo atual; a recomendação é projetá-lo como capability isolada em entrega futura.
- Não existe executor de auto-publicação. `manual` é o default e mudanças de risco médio/alto continuam humanas.

### Activation e WTP

- Eventos de onboarding, primeira estrutura/preview/revisão/publicação/tráfego/oportunidade/conversão, superfícies de produto, trial/paywall/checkout/subscription.
- Admin `/admin/product` mostra qualidade de activation, tempos medianos, usage e exposição a valor antes do pagamento.
- Billing mostra resumo real dos últimos sete dias antes do upgrade.
- Cancelamento coleta feedback opcional e mantém a política de fim do período.
- O runbook Stripe aponta para o checklist final executável/manual.

## 4. Arquivos principais alterados

- `supabase/migrations/202608240046_conversion_intelligence.sql`
- `src/server/dashboard/overview-service.ts`
- `src/components/dashboard/overview.tsx`
- `src/app/api/events/route.ts`
- `src/server/publishing/publish-project.ts`
- `src/server/analytics/conversion-analytics.ts`
- `src/app/api/projects/[projectId]/optimization/route.ts`
- `src/server/optimization/experiment-evaluation.ts`
- `src/features/optimization/*`
- `src/features/entry-points/presets.ts`
- `src/components/entry-points/*`
- `src/server/product-metrics/admin-product-metrics.ts`
- `src/components/entitlements/billing-settings-real.tsx`
- `docs/SOBE-PRODUCT-METRICS.md`
- `docs/SOBE-FOUNDER-DOGFOOD.md`
- `docs/SOBE-STRIPE-LAUNCH-CHECKLIST.md`

## 5. Testes executados

**TESTADO:**

- `npm run lint`: passou, zero warnings.
- `npm run typecheck`: passou.
- `npm run test`: 41 arquivos e 202 testes passaram.
- `npm run test:e2e`: 34 testes passaram em mobile e desktop Chrome.
- `npm run build`: passou no Next.js 16.2.12, 74 páginas estáticas geradas.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilidades após atualização não destrutiva de `nanoid`.
- `git diff --check`: sem erro de whitespace.
- Browser local em viewport nativo: dashboard abriu, hierarquia/estados vazios foram verificados e o console ficou sem erros.

## 6. Testes não executados

**PENDENTE DE AMBIENTE:**

- `npm run test:integration`: `NOT_RUN_ENV_MISSING` para URL Supabase, service-role key e user ID exclusivos de integração.
- Stripe sandbox real: não executado, pois não foram fornecidas credenciais/test account/webhook de sandbox.
- Backfill real: não executado; o dry-run retornou `NOT_RUN_MIGRATION_MISSING` porque a migration nova ainda não foi aplicada ao banco configurado.
- Comparação com tráfego real de duas versões: depende de publicação e janela de dados reais.

## 7. Pendências de ambiente

- Aplicar a migration aditiva no Supabase alvo e executar o dry-run antes do backfill real.
- Fornecer `INTEGRATION_TEST_SUPABASE_URL`, `INTEGRATION_TEST_SUPABASE_SERVICE_ROLE_KEY` e `INTEGRATION_TEST_USER_ID` para a suíte real.
- Completar `RATE_LIMIT_SECRET`, `CRON_SECRET`, `CUSTOMER_IDENTITY_HASH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, chaves Google Maps e URLs HTTPS. Por isso `production:env` e `production:check` encerraram com código 1.
- Executar `docs/SOBE-STRIPE-LAUNCH-CHECKLIST.md` com sandbox e depois live controlado.

## 8. Riscos conhecidos

- O teste de integração real está preparado, mas a execução/validação no Supabase alvo ainda falta; não há claim de aprovação de RLS em runtime real.
- Avaliação before/after é observacional e pode conter sazonalidade, mix de canal ou mudança de oferta.
- Eventos históricos sem versão conhecida permanecem fora do corte por versão, por decisão de integridade.
- O ambiente local usa fixtures apenas em modo de desenvolvimento; a superfície de produção usa repositórios/RPC server-first.
- O Node local é 24.19.0, enquanto `package.json` requer 22.x; os comandos passaram, mas produção deve usar Node 22.

## 9. Como usar a Sobe como dogfood

Siga `docs/SOBE-FOUNDER-DOGFOOD.md`: criar Sobe como tenant comum, configurar metas verdadeiras, publicar, criar uma URL por canal, revisar attribution e nunca editar analytics para melhorar resultados.

## 10. Como confirmar as quatro perguntas

- **Activation:** admin Product, funil `account_created → first_structure_generated → first_project_published` e medianas.
- **Usage:** retorno posterior à publicação, workspace ativo, dashboard/analytics e engagement com otimização.
- **Conversion:** Analytics por entrada e versão, com taxas e valor confirmado por sessão.
- **WTP:** trial → paywall → checkout → paid, separado por exposição a tráfego/oportunidade/conversão.

As fórmulas canônicas estão em `docs/SOBE-PRODUCT-METRICS.md`.

## Verificação visual

- Conceito aceito: `C:/Users/lgust/.codex/generated_images/01a03577-7694-7711-af38-08609dced749/exec-c6228ef2-2b6b-4834-bef1-af3cef969969.png`.
- Screenshot final: `C:/Users/lgust/.codex/visualizations/2026/08/24/01a03577-7694-7711-af38-08609dced749/dashboard-final.png`.
- Comparação visual: mesma grade de seis métricas, faixa azul, próximo passo escuro, Copilot lado a lado, tabela operacional e funil/aprendizado. A implementação manteve o shell real do produto e mostrou negócios locais no estado de desenvolvimento.
- Diff de copy intencional: “Últimos 7 dias” aparece quando não existe visita anterior; depois muda para “Desde sua última visita”. O CTA e o próximo passo são resolvidos pelo estado real, não copiados do conceito.
