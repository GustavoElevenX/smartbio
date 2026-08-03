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
- Persistência local completa para desenvolvimento sem login e repositório Supabase/RLS para ambientes configurados.

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

Catálogo/pedidos e reservas ficam desligados por padrão. Para executar os seis fluxos manualmente, habilite os dois flags correspondentes em `.env.local`; o Playwright já os habilita no servidor de teste.

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
npm run dev
```

Abra `http://localhost:3000/app`. Sem as chaves do Supabase, autenticação e persistência usam o modo de desenvolvimento local no navegador. Esse modo é intencional para avaliação e não oferece isolamento multiusuário nem sincronização entre dispositivos.

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

## Feature flags

| Flag | Padrão | Escopo |
| --- | --- | --- |
| `NEXT_PUBLIC_FEATURE_QUALIFICATION` | `true` | Pontuação e recomendação |
| `NEXT_PUBLIC_FEATURE_QUOTES` | `true` | Orçamentos e anexos |
| `NEXT_PUBLIC_FEATURE_SCHEDULING` | `true` | Agenda nativa |
| `NEXT_PUBLIC_FEATURE_ROUTING` | `true` | Roteamento determinístico |
| `NEXT_PUBLIC_FEATURE_CATALOG_ORDERS` | `false` | Catálogo, carrinho e pedidos |
| `NEXT_PUBLIC_FEATURE_RESERVATIONS` | `false` | Disponibilidade e reservas |
| `NEXT_PUBLIC_FEATURE_EXTERNAL_PAYMENTS` | `false` | Continuação para pagamento externo |
| `NEXT_PUBLIC_FEATURE_AI_BUSINESS_ANALYSIS` | `false` | Análise do negócio por IA |
| `NEXT_PUBLIC_FEATURE_AI_JOURNEY_COMPOSITION` | `false` | Composição por IA |
| `NEXT_PUBLIC_FEATURE_CALENDAR_SYNC` | `false` | Sincronização de calendário |
| `NEXT_PUBLIC_FEATURE_CHAT` | `false` | Chat nativo |
| `NEXT_PUBLIC_FEATURE_BILLING` | `false` | Cobrança do SaaS |
| `NEXT_PUBLIC_FEATURE_CUSTOM_DOMAINS` | `false` | Domínio customizado |

## Arquitetura

```text
src/
  app/api/public/                 endpoints comerciais públicos
  components/editor/              editor de jornada, blocos e capacidades
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
```

O primeiro E2E pode exigir `npx playwright install chromium`.

## Limites intencionais

- Pagamento é apenas continuação externa; não há captura de cartão nativa.
- Sincronização com Google/Outlook Calendar, chat, billing e domínios customizados permanecem desligados.
- O rate limit do MVP é em memória por instância; produção distribuída deve usar armazenamento compartilhado.
- Alterações de cancelamento/remarcação são solicitações auditáveis, não mutações anônimas diretas.
- O modo local é funcional para desenvolvimento e QA, mas produção deve usar Supabase.
