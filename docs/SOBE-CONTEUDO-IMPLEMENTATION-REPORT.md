# SOBE Conteúdo — relatório de implementação

Data: 03/11/2026. Este relatório separa código, testes locais e integrações externas ainda sem prova real.

## Estado inicial auditado

- Next 16.2.12 / React 19.2.4. Rotas usam `RouteContext` com `params` assíncronos, conforme `node_modules/next/dist/docs/app/api-reference/file-conventions/route.md`.
- `assertProjectAccess` verifica projeto e workspace; `withAuthenticatedActor` fornece o usuário. O modo `memory` existe para desenvolvimento e não é persistência de publicação.
- Biblioteca existente usa `media-private`. Contexto comercial confirmado mora em `project_commercial_contexts`; marca em `brand_profiles`; a IA de texto existente é OpenAI. A quota antiga de IA não foi alterada.
- `vercel.json` tem cron diário de notificações. Cron Vercel Hobby não tem frequência adequada para horário arbitrário. O worker novo usa Supabase Cron, configurado pelo proprietário.
- Na auditoria inicial não havia chaves Cloudflare/Composio nos arquivos locais consultados. A Cloudflare foi configurada posteriormente pelo fundador e testada em desenvolvimento em 03/11/2026. Composio e publicação Instagram continuam sem prova real.

## Decisões de implementação

- O módulo mora em `/app/projects/[projectId]/content` e preserva o pré-vendedor. O editor salva JSON estruturado e versão; exportação JPEG é renderizada no servidor com Sharp em 1080 × 1350. O modo `memory` permite demonstrar rascunho e JPEG localmente, sem persistência durável ou publicação real.
- O roteiro usa OpenAI da plataforma quando configurado, com ledger próprio e caps mensais internos; sem chave, usa um rascunho editável ancorado nos dados do negócio. Nenhum preço ou resultado comercial é acrescentado por fixture.
- Imagens usam FLUX.1 Schnell via REST no backend. Reserva de quota é transação PostgreSQL com advisory lock global. Tentativas falhas também contam para impedir chamadas ilimitadas; a edição permanece disponível.
- O OAuth usa Connect Link da API REST oficial do Composio. Tentativa de instalar `@composio/core` falhou porque o ambiente não resolveu `registry.npmjs.org` (`ENOTFOUND`). O código não depende do SDK. A conta é vinculada a `workspaceId + projectId` e o retorno exige nonce e confirmação remota `ACTIVE`.
- O publicador usa o proxy HTTP autenticado do Composio para chamadas Instagram Graph de containers e `media_publish`. Mídias são materializadas no disparo e recebem URL assinada do bucket privado por 24 h. O status `published` exige ID e permalink remoto; falha ambígua vira `needs_review`, sem retry cego.
- A fila é reclamada com `FOR UPDATE SKIP LOCKED`; índice único impede duas publicações ativas da mesma versão na mesma conta. O worker para quando `SOCIAL_PUBLISHING_ENABLED` está desligado. Supabase Cron deve chamar `/api/internal/social-publications/process` com segredo em Vault. O cron existente de notificações permanece intocado.
- SQL incremental: `supabase/migrations/202611030065_sobe_content_studio.sql`. O banco conectado não foi migrado automaticamente; consulte o guia do fundador.

## Estado verificado

| Fluxo | Evidência local | Estado externo |
| --- | --- | --- |
| Tipos Next/TS | `npm run typecheck` | Independe de terceiros |
| Build de produção | `npx next build --webpack`: 81 páginas estáticas geradas e rotas do módulo registradas | Independe de terceiros |
| Editor e JPEG | Playwright mobile e desktop: criar, editar, salvar e baixar `image/jpeg` | Teste local em modo demonstração |
| Suite unitária | `npx vitest run --maxWorkers=2`: 75 arquivos, 469 testes | Fixtures e mocks; sem serviço externo |
| Brief, cinco fixtures, parser Cloudflare, IDs OAuth | `tests/unit/content-studio.test.ts` | Mocks/fixtures isoladas |
| Fluxo Cloudflare | Teste real local em 03/11/2026: geração HTTP 200, imagem salva no rascunho, prévia JPEG 1080 × 1350 e download confirmado | Validado no ambiente local; ainda repetir em staging após deploy |
| OAuth Composio | Connect Link e verificação implementados | Bloqueado: faltam API key/Auth Config e conta profissional de teste |
| Instagram imediato | Containers, publish e confirmação implementados | Bloqueado: nenhuma publicação real foi autorizada/testada |
| Agendamento | Fila, claim e endpoint privado implementados | Bloqueado: migration e Supabase Cron ainda não ativados |

## Limites conhecidos e próximos gates

- A renderização de texto usa linhas estimadas por caracteres. Cards com textos longos ou caracteres largos devem ser revisados visualmente; um teste de corte tipográfico em vários idiomas ainda não existe.
- `npm run test` com a concorrência padrão esgotou os 5 segundos de um teste preexistente de agendamento; o teste isolado passou (15/15) e a suíte completa passou com `--maxWorkers=2` (469/469). Nenhuma asserção foi removida.
- A conta profissional e o identificador Graph são verificados no momento do disparo. O contrato de OAuth/proxy só poderá ser confirmado contra a conta real de teste. Se o proxy da conta não alcançar o endpoint Graph esperado, ajustar com o schema efetivo do toolkit no painel Composio antes de habilitar publicação pública.
- O worker marca incertezas como `needs_review` e exige reconciliação humana. Não há botão de retry automático para evitar duplicatas. Um operador deve conferir o Instagram antes de qualquer reenvio.
- Os E2E mobile e desktop de criação, edição e exportação JPEG passaram no navegador local. Ainda não há teste de RLS contra uma instância Supabase migrada; execute-o em staging antes de habilitar clientes.
- Em desenvolvimento, uma execução com `NEXT_DIST_DIR` temporário não registrou as rotas aninhadas de imagem e renderização e devolveu HTML 404. O servidor foi reiniciado com o diretório padrão `.next`; as duas rotas voltaram a responder JSON/JPEG, e a geração Cloudflare real foi concluída no rascunho existente. O cliente agora mostra uma mensagem legível se uma API devolver conteúdo que não seja JSON.
- `NEXT_PUBLIC_FEATURE_CONTENT_STUDIO=false` oculta a tela e bloqueia as APIs correspondentes pelo proxy. Segurança real também depende de autenticação, escopo no servidor, RLS e `SOCIAL_PUBLISHING_ENABLED`.
- O plano Vercel Hobby é limitado a uso pessoal não comercial; o fundador deve verificar a hospedagem efetiva e os termos antes de lançar o SaaS.

## Fontes verificadas

- [Cloudflare FLUX.1 Schnell](https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/) e [preços](https://developers.cloudflare.com/workers-ai/platform/pricing/).
- [Composio Connect Link](https://docs.composio.dev/reference/v3/api-reference/connected-accounts/postConnectedAccountsLink), [proxy](https://docs.composio.dev/reference/api-reference/tools/postToolsExecuteProxy) e [Instagram](https://docs.composio.dev/toolkits/instagram).
- [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart), [Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing) e [Vercel Hobby](https://vercel.com/docs/plans/hobby).
