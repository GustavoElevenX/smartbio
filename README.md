# SmartBio

SmartBio é uma camada de conversão para o link da bio. Ela entende como o negócio vende, compõe uma jornada guiada e conduz o visitante até uma ação comercial concreta: qualificação, orçamento, agendamento, pedido, reserva ou roteamento.

Não é uma lista genérica de links e não tenta substituir o sistema operacional de cada vertical. A experiência coleta contexto, calcula o que pode ser calculado com segurança, registra a solicitação e entrega ao negócio um objeto comercial acionável.

## O que está implementado

- Onboarding em oito etapas: negócio, oferta, objetivo, confirmação, capacidade, conclusão, marca e revisão.
- `BusinessCapabilityProfile` derivado por regras estruturadas; análise por IA é opcional, validada por Zod e sempre tem fallback determinístico.
- Registro de capacidades com flags independentes: qualificação, orçamento, agenda, catálogo/pedido, reserva, roteamento e pagamento externo.
- Compositor separado em entendimento do negócio, planejamento de capacidades, jornada e sistema visual.
- Runtime público com estado versionado em `sessionStorage`, retorno de etapa, carrinho, datas, hóspedes, horário, anexos e contexto comercial.
- Registro extensível de blocos, incluindo upload de mídia, quantidade, estimativa, serviço, recurso, calendário, slots, carrinho, disponibilidade, unidades reserváveis, rota, política e sinal.
- Motores puros e testáveis para pontuação, orçamento, disponibilidade, conflitos, carrinho, reservas e roteamento.
- Editor com autosave híbrido, preview, undo/redo, painel “Como esta experiência converte” e edição validada de blocos.
- APIs públicas com Zod, honeypot, rate limit, idempotência, recálculo no servidor e service role restrita ao servidor.
- Operação comercial para acompanhar e atualizar orçamento, pedido, agendamento e reserva.
- Leads enriquecidos com pontuação, faixa, motivo, ação comercial, objeto relacionado, valor, data e linha do tempo.
- Analytics com período real, origem, funil e eventos específicos de cada capacidade.
- Persistência local opcional para desenvolvimento sem login e repositório Supabase/RLS para ambientes configurados.
- Central de Dados Comerciais para serviços, orçamento, agenda, catálogo, reservas, unidades, destinos, políticas e integridade.
- Fontes privadas (PDF, imagem, CSV, texto e site), revisão de fatos extraídos e aplicação confirmada.
- IA granular por campo, etapa e visual, com snapshot, diff e proteção dos fatos comerciais confirmados.
- Biblioteca privada de mídia com publicação controlada, detecção de uso e exclusão segura.
- Multiunidades com geocodificação, horário, raio, Haversine, consentimento explícito e destino por unidade.
- Notificações in-app/e-mail com outbox assíncrona, lock concorrente, retry, dead letter e reconciliação.
- Workspace ativo persistido em cookie HTTP-only, seletor com role/plano e isolamento dos caches do client.
- Tabelas normalizadas como fonte operacional; `publishedPayload` é o snapshot imutável servido ao público.

## Experiências de aceitação

O modo local inclui seis fixtures publicadas:

| Fluxo | URL | Resultado |
| --- | --- | --- |
| Limpeza com fotos | `/limpabem` | Estimativa e pedido de orçamento |
| Serviço B2B | `/vertice` | Qualificação, recomendação e agenda |
| Delivery | `/casadesucosmix` | Catálogo, carrinho e pedido |
| Clínica | `/clinica-aurora` | Consulta de horário e agendamento |
| Hospedagem | `/chales-serra-clara` | Disponibilidade, valor e solicitação de reserva |
| Multiunidade | `/rede-movimento` | Roteamento para a unidade adequada |

Os fluxos comerciais, geo routing e multiunidades ficam habilitados no `.env.example`. Recursos pós-MVP, como calendar sync, chat, billing e domínios customizados, permanecem desligados.

## Stack e pré-requisitos

- Next.js 16 App Router, React 19, TypeScript e Tailwind CSS 4.
- Supabase PostgreSQL/Auth/Storage/RLS.
- Zod, Recharts, Framer Motion e Lucide.
- Vitest e Playwright.
- Node.js 22 ou superior e npm 10 ou superior.

## Setup local sem login

```bash
npm install
copy .env.example .env.local
# Em .env.local, habilite somente para desenvolvimento:
# ENABLE_LOCAL_DEV_AUTH=true
# NEXT_PUBLIC_ENABLE_LOCAL_DEV_STORE=true
npm run dev
```

Abra `http://localhost:3000/app`. Sem as chaves do Supabase, autenticação e persistência só usam o modo local quando as duas flags acima estiverem explicitamente habilitadas. As flags são sempre ignoradas em produção. Esse modo é intencional para avaliação e não oferece isolamento multiusuário nem sincronização entre dispositivos.

## Supabase

1. Crie um projeto e configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
2. Nunca use a service role em código client ou em variável `NEXT_PUBLIC_*`.
3. Aplique as migrações na ordem e depois o seed.

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Para Supabase local:

```bash
npx supabase start
npx supabase db reset
```

O seed usa o primeiro workspace disponível; crie ao menos um usuário antes de executá-lo manualmente em um projeto remoto.

### Migrações

- `202608030001_initial_schema.sql`: núcleo, índices, RLS, auth e bucket de marca.
- `202608030002_publishing_functions.sql`: publicação e restauração por snapshot.
- `202608030003_conversion_core.sql`: perfil de negócio, capacidades, blocos, eventos e lead comercial.
- `202608030004_quotes.sql`: definições, regras, solicitações e anexos privados de orçamento.
- `202608030005_scheduling.sql`: serviços, recursos, disponibilidade, agenda e mudanças solicitadas.
- `202608030006_catalog_orders.sql`: categorias, itens, pedidos e itens recalculados no servidor.
- `202608030007_reservations.sql`: unidades, bloqueios, reservas e proteção transacional de capacidade.
- `202608030008_routing_integrations_audit.sql`: roteamento, integrações e auditoria de status.
- `202608050009_ai_setup.sql`: sessões, mensagens, execuções e requisitos do onboarding por IA.
- `202608050010_launch_security_and_service_offerings.sql`: reparo idempotente de workspace, serviços genéricos e rate limit distribuído.
- `202608050011_business_sources.sql`: fontes privadas, fatos, evidências e aplicação transacional.
- `202608050012_media_library_enhancements.sql`: metadados, usos e publicação segura de mídia.
- `202608050013_business_locations_geo_routing.sql`: unidades, coordenadas, horários, raios e destinos.
- `202608050014_notifications.sql`: notificações, preferências e entregas idempotentes.
- `202608050015_project_policies_and_readiness.sql`: políticas comerciais, metadados de verificação e prontidão.
- `202608060016_attach_sources_and_ai_drafts.sql`: vínculo transacional e idempotente das fontes do onboarding ao projeto.
- `202608060017_transactional_commercial_data.sql`: save comercial único, schemas profundos e concorrência otimista.
- `202608060018_notification_outbox.sql`: outbox, claim com `skip locked`, retry e dead letter.
- `202608060019_active_workspace_support.sql`: último workspace no perfil e plano do workspace.

As escritas anônimas nas tabelas comerciais são revogadas. Os endpoints usam service role no servidor; o dashboard usa a sessão autenticada e RLS por membership. Agendamentos e reservas usam idempotência e travas transacionais para evitar dupla alocação.

## APIs públicas

- `GET /api/public/projects/:slug/experience`
- `POST /api/public/quotes`
- `POST /api/public/quotes/:id/attachments`
- `POST /api/public/availability`
- `POST /api/public/bookings`
- `POST /api/public/bookings/:id/cancel-request`
- `POST /api/public/bookings/:id/reschedule-request`
- `GET /api/public/catalog/:projectId`
- `POST /api/public/orders`
- `POST /api/public/reservations/availability`
- `POST /api/public/reservations`
- `POST /api/public/reservations/:id/cancel-request`
- `POST /api/public/routing/resolve`
- `POST /api/public/routing/nearest`

## Feature flags

| Flag | Padrão | Escopo |
| --- | --- | --- |
| `NEXT_PUBLIC_FEATURE_QUALIFICATION` | `true` | Pontuação e recomendação |
| `NEXT_PUBLIC_FEATURE_QUOTES` | `true` | Orçamentos e anexos |
| `NEXT_PUBLIC_FEATURE_SCHEDULING` | `true` | Agenda nativa |
| `NEXT_PUBLIC_FEATURE_ROUTING` | `true` | Roteamento determinístico |
| `NEXT_PUBLIC_FEATURE_GEO_ROUTING` | `true` | CEP, geolocalização e cálculo por unidade |
| `NEXT_PUBLIC_FEATURE_MULTI_UNIT` | `true` | Cadastro e seleção entre várias unidades |
| `NEXT_PUBLIC_FEATURE_CATALOG_ORDERS` | `true` | Catálogo, carrinho e pedidos |
| `NEXT_PUBLIC_FEATURE_RESERVATIONS` | `true` | Disponibilidade e reservas |
| `NEXT_PUBLIC_FEATURE_EXTERNAL_PAYMENTS` | `true` | Continuação para pagamento externo |
| `NEXT_PUBLIC_FEATURE_AI_BUSINESS_ANALYSIS` | `true` | Análise do negócio por IA |
| `NEXT_PUBLIC_FEATURE_AI_JOURNEY_COMPOSITION` | `true` | Composição por IA |
| `NEXT_PUBLIC_FEATURE_AI_SOURCE_IMPORT` | `true` | Extração assistida de fontes privadas |
| `NEXT_PUBLIC_FEATURE_AI_BRAND_ANALYSIS` | `true` | Análise de marca por IA |
| `NEXT_PUBLIC_FEATURE_NOTIFICATIONS` | `true` | Sino, página, preferências e e-mail |
| `NEXT_PUBLIC_FEATURE_CALENDAR_SYNC` | `false` | Sincronização de calendário |
| `NEXT_PUBLIC_FEATURE_CHAT` | `false` | Chat nativo |
| `NEXT_PUBLIC_FEATURE_BILLING` | `false` | Cobrança do SaaS |
| `NEXT_PUBLIC_FEATURE_CUSTOM_DOMAINS` | `false` | Domínio customizado |

## Arquitetura

```text
src/
  app/api/public/                 endpoints comerciais públicos
  components/commercial-data/    fonte de verdade operacional
  components/editor/              editor de jornada, blocos e capacidades
  components/media-library/       biblioteca e picker de mídia
  components/notifications/       sino, lista e preferências
  components/public-experience/   runtime e registro de renderers
  features/business-understanding/
  features/capabilities/
  features/composition/
  features/qualification/
  features/quotes/
  features/scheduling/
  features/catalog/
  features/reservations/
  features/routing/
  server/business-sources/        parsing, evidências e aplicação
  server/media/                   upload, transformação e publicação
  server/notifications/           persistência e entregas
  server/publishing/              prontidão, snapshots e publicação
  server/rate-limit/              memória local e Upstash em produção
  lib/repositories/               adaptadores local/remoto do dashboard
  server/repositories/            leitura pública segura
supabase/migrations/
tests/unit/
tests/e2e/
```

## Comandos de validação

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run data:backfill:dry
npm run data:check-consistency
```

`npm run data:backfill` importa somente projetos antigos sem steps normalizados e nunca sobrescreve um agregado já existente. O modo `:dry` apenas relata candidatos. O consistency check compara contagens normalizadas, cache de compatibilidade e versões publicadas; divergências são somente relatadas.

## Worker de notificações

Configure `CRON_SECRET` e execute `POST /api/internal/notifications/process` com `Authorization: Bearer $CRON_SECRET`. O `vercel.json` agenda o worker a cada cinco minutos. Se o plano da hospedagem não aceitar essa frequência, use um cron externo autenticado ou Supabase Cron com o mesmo endpoint. As APIs públicas apenas persistem a operação e enfileiram o evento; o envio pelo Resend acontece no worker.

O primeiro E2E pode exigir `npx playwright install chromium`.

## Limites intencionais

- Pagamento é apenas continuação externa; não há captura de cartão nativa.
- Sincronização com Google/Outlook Calendar, chat, billing e domínios customizados permanecem desligados.
- O rate limit usa memória somente em desenvolvimento e exige Upstash nas APIs de IA em produção.
- Alterações de cancelamento/remarcação são solicitações auditáveis, não mutações anônimas diretas.
- O modo local é funcional para desenvolvimento e QA, mas produção deve usar Supabase.

## Configuração de produção

Antes do deploy, configure Supabase (URL, anon key e service role), confirmação de e-mail, OpenAI, Upstash, Resend e Google Maps. Mantenha `ENABLE_LOCAL_DEV_AUTH=false` e `NEXT_PUBLIC_ENABLE_LOCAL_DEV_STORE=false`. Aplique todas as migrations, valide o e-mail remetente no Resend, restrinja as chaves do Google Maps e execute os comandos de validação acima no mesmo commit que será publicado.
