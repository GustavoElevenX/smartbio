# SmartBio

SmartBio transforma o link da bio em uma jornada guiada: entende a intenção do visitante, faz perguntas curtas, recomenda o melhor próximo passo, captura leads e mede onde as pessoas avançam ou abandonam.

O nome e a identidade do SaaS são provisórios. Nome, URL, favicon e feature flags ficam centralizados em variáveis e constantes para permitir rebranding.

## O que está implementado

- Landing page e interface de planos.
- Cadastro, login, recuperação de senha e criação automática de workspace com Supabase Auth.
- Modo local persistente para avaliação sem credenciais externas.
- Onboarding em oito momentos: identificação, descrição, objetivo, destino, marca, direção visual, geração e preview.
- Upload de PNG/JPG/WebP/SVG, validação de assinatura/tamanho, sanitização de SVG e extração real de cores.
- Paletas Fiel, Equilibrada e Ousada, funções semânticas e ajuste automático de foreground por contraste.
- Compositor determinístico exclusivo, `AIExperienceComposer` opcional e orquestrador com fallback por regras.
- Editor em lista com preview mobile, autosave, desfazer/refazer, reordenação, duplicação, exclusão e destinos condicionais.
- Modos Rápido e Avançado; Brand Studio com logo, cores, tipografia, formas, cards, botões, densidade e movimento.
- Publicação por slug, sessão anônima, retorno de etapa, respostas persistidas, UTMs e compartilhamento.
- Formulários nativos, honeypot, rate limit, leads, observações, status e exportação CSV.
- WhatsApp profundo com mensagem contextual e número diferente por opção.
- Analytics de jornada, funil, origem, filtros e exportação CSV.
- Demos distintas: `/casadesucosmix` e `/vertice`.
- Migrations PostgreSQL, RLS, storage policies, triggers, RPCs de publicação/restauração e seed real.
- Estados vazios, loading, erro global, 404, projeto inexistente/indisponível e confirmações destrutivas.
- Testes unitários e E2E.

## Stack

- Next.js (App Router), React e TypeScript.
- Tailwind CSS 4 e estrutura compatível com shadcn/ui (`components.json`).
- Supabase: PostgreSQL, Auth, Storage e RLS.
- React Hook Form/Zod disponíveis para formulários e schemas; Zod protege os endpoints públicos.
- Recharts, Framer Motion, Lucide Icons e date-fns.
- Vitest e Playwright.

## Pré-requisitos

- Node.js 22 ou superior.
- npm 10 ou superior.
- Projeto Supabase e Supabase CLI para persistência em nuvem.

## Setup local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`. Sem chaves Supabase, o app ativa o modo local persistente no navegador e já inclui as duas demos, leads e analytics. Esse fallback existe para desenvolvimento e demonstração; não deve ser usado como banco de produção.

## Supabase

1. Crie um projeto no Supabase.
2. Copie URL, chave anônima e service role para `.env.local`.
3. Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no client ou com prefixo `NEXT_PUBLIC_`.
4. Vincule o projeto e aplique o schema:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Para ambiente local com a CLI:

```bash
npx supabase start
npx supabase db reset
```

O trigger `handle_new_user` cria profile, workspace, membership owner e subscription Free. O seed procura o primeiro workspace; por isso, em uma instalação remota, crie ao menos um usuário antes de executar `supabase/seed.sql` manualmente.

### Segurança

- Projetos, marca, etapas, opções e formulários só têm leitura anônima quando o projeto está publicado.
- Leads, sessões e analytics brutos nunca têm leitura pública.
- Escritas públicas passam por `/api/events` e `/api/leads`, com Zod, limite de payload, rate limit e honeypot.
- Workspaces usam membership `owner`/`member`; exclusão de projeto/workspace exige owner.
- O bucket `media` valida tamanho e MIME e organiza arquivos por workspace.
- SVG é sanitizado no navegador e no endpoint de análise; scripts, handlers e referências externas são removidos.

## Migrations e seed

Arquivos:

- `supabase/migrations/202608030001_initial_schema.sql`: tabelas, índices, triggers, RLS, criação automática de workspace e storage.
- `supabase/migrations/202608030002_publishing_functions.sql`: snapshots atômicos de publicação e restauração.
- `supabase/seed.sql`: Casa de Sucos Mix e Vértice B2B.

As tabelas principais são `profiles`, `workspaces`, `workspace_members`, `projects`, `media_assets`, `brand_profiles`, `project_versions`, `journey_steps`, `design_overrides`, `step_options`, `form_definitions`, `form_fields`, `visitor_sessions`, `analytics_events`, `leads`, `chat_sessions`, `chat_messages`, `knowledge_entries` e `subscriptions`.

## Variáveis de ambiente

Veja `.env.example`.

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | URL canônica do app |
| `NEXT_PUBLIC_APP_NAME` | Nome exibido |
| `NEXT_PUBLIC_SUPABASE_URL` | Endpoint público Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anônima sujeita a RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Escrita segura nos endpoints server-only |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | Compositor de IA opcional |
| `EMAIL_*` | Provider abstrato de e-mail |
| `RATE_LIMIT_SECRET`, `ENCRYPTION_KEY` | Infraestrutura futura distribuída/criptografia |
| `NEXT_PUBLIC_FEATURE_*` | Feature flags por ambiente |

## Comandos

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run start
```

O primeiro `npm run test:e2e` pode exigir:

```bash
npx playwright install chromium
```

## Arquitetura

```text
src/
  app/                         rotas, metadata e endpoints
  components/
    dashboard/                 editor, marca, analytics, leads e settings
    marketing/                 landing e navegação
    public-experience/         renderizador mobile-first da jornada
    ui/                        primitives reutilizáveis
  data/                        demos executáveis
  features/
    analytics/                 cálculo de funil
    auth/                      experiência de autenticação
    brand-intelligence/        extração, contraste e sanitização
    composition/               compositores e orquestrador
    onboarding/                geração guiada
    whatsapp/                  mensagem e deep link
  lib/                         store, Supabase, schemas e utilitários
  server/services/             e-mail e rate limit
  types/                       contratos do domínio
supabase/                      migrations e seed
tests/                         unitários e E2E
```

A lógica de negócio fica em features/services; componentes cuidam de interação e apresentação. A rota pública usa componentes leves e carrega mídia sob demanda. Componentes são reutilizados internamente, mas o compositor varia hierarquia, conteúdo, design tokens, formas, tipografia e direção visual por projeto — não há galeria de templates de nicho.

## Publicação

Em produção com Supabase, use a RPC `publish_project(uuid)`: ela valida etapas, cria snapshot em `project_versions`, marca o projeto como publicado e retorna a versão pública. Em uma plataforma com CDN, invalide o cache da rota após a RPC. `restore_project_version(uuid)` restaura configurações como rascunho.

Deploy sugerido:

1. Configure as variáveis no provedor.
2. Execute `supabase db push`.
3. Rode `npm run lint && npm run typecheck && npm run test && npm run build`.
4. Publique o app Next.js em um runtime Node 22+.

## Testes

Os unitários cobrem slug, contraste, sanitização de SVG, WhatsApp contextual, schemas/honeypot, composição determinística e cálculo de funil. Os E2E cobrem cadastro/onboarding e as jornadas Vértice e Casa de Sucos.

## Limitações atuais

- O adaptador local (`localStorage`) é completo para demonstração, mas não oferece isolamento multiusuário ou sincronização entre dispositivos. Produção deve usar Supabase.
- A autenticação usa Supabase quando configurado; no modo local é uma sessão de desenvolvimento, não um mecanismo seguro.
- Os endpoints já persistem eventos e leads no Supabase, mas o CRUD completo do dashboard ainda usa o adaptador local no modo de demonstração. A camada SQL/RLS está pronta para substituir esse adaptador por repositórios remotos.
- Billing, domínio customizado, chat nativo e geração por IA permanecem atrás de feature flags e não têm integração externa ativa.
- E-mails usam `ConsoleEmailProvider` até configurar um provider.
- Agenda e checkout usam links externos.
- A versão atual não implementa cache distribuído nem rate limit distribuído; o limitador do MVP é em memória por instância.
- A inferência de estilo visual é baseada em sinais de imagem e regras; não redesenha nem distorce a logo.

## Roadmap preparado

- Domínios customizados e billing.
- Webhooks e integrações.
- WhatsApp Cloud API, agenda e checkout nativos.
- Chat IA com base de FAQ (`knowledge_entries`).
- Equipe avançada, multiunidades, A/B tests e lead scoring.
- Pixels e conversão server-side.
- White label, agências e multilíngue.
- Recomendações orientadas por histórico real de conversão.

## Rebranding

Altere `NEXT_PUBLIC_APP_NAME`, metadata em `src/app/layout.tsx`, `src/components/ui/brand.tsx`, favicon em `src/app/favicon.ico` e domínio em `NEXT_PUBLIC_APP_URL`. Tokens globais do SaaS ficam em `src/app/globals.css`; os tokens das páginas públicas pertencem a cada projeto.
