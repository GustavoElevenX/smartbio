# SOBE Conteúdo — guia operacional do fundador

Use uma instância de teste e uma conta Instagram **Business ou Creator de teste** antes de liberar clientes. As chaves são da SOBE, nunca dos assinantes. Não envie segredos por chat, issue ou captura de tela.

## O que você precisa ter

| Serviço | Para quê | Cobrança/limite |
| --- | --- | --- |
| Supabase do projeto | Guardar rascunhos, imagens privadas e fila | Confira a quota atual da sua conta |
| Cloudflare Workers AI Free | Uma foto IA inicial por carrossel | [10.000 Neurons/dia gratuitos, reinício 00:00 UTC](https://developers.cloudflare.com/workers-ai/platform/pricing/); isso **não** equivale a 10.000 imagens |
| Composio | Autorização Instagram centralizada | Confira a [página de preços](https://composio.dev/pricing) e limites da sua conta; não ative plano pago sem decidir |
| Instagram Business/Creator de teste | Autorizar e comprovar uma publicação | Conta Personal não é aceita pelo [toolkit](https://docs.composio.dev/toolkits/instagram) |
| Hospedagem HTTPS da SOBE | Receber retorno OAuth e servir publicador | Verifique plano e termos; [Vercel Hobby é pessoal/não comercial](https://vercel.com/docs/plans/hobby) |

## Ordem exata de ativação

### 1. Banco Supabase

1. Abra [Supabase Dashboard](https://supabase.com/dashboard) → projeto da SOBE → **SQL Editor**. Use primeiro o projeto de staging.
2. Abra `supabase/migrations/202611030065_sobe_content_studio.sql` no repositório, copie o conteúdo e execute no SQL Editor. Se usa Supabase CLI, aplique essa migration pela rotina de deploy de migrations do projeto. Não execute duas vezes manualmente.
3. Em **Database → Tables**, confirme as tabelas `content_posts`, `content_assets`, `content_ai_usage`, `social_connections` e `social_publications`. Em **Authentication → Policies**, confirme RLS habilitado nessas cinco tabelas.
4. Em **Storage**, confirme que o bucket existente `media-private` está privado. Não torne a biblioteca pública.
5. Verifique com um usuário de outro workspace que não consegue abrir conteúdos do primeiro. Depois rode `npm run test:integration:rls` no ambiente de staging preparado.

### 2. Cloudflare para imagens

1. Abra [Cloudflare Dashboard](https://dash.cloudflare.com) → selecione a conta → **Workers & Pages → Workers AI**. Confira que a conta está no plano Free e que o modelo `@cf/black-forest-labs/flux-1-schnell` aparece/disponível. Verifique os [termos do modelo](https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/) para seu uso comercial.
2. Na página Workers AI, clique **Use REST API**. Em **Get Account ID**, copie o Account ID; ele vai em `CLOUDFLARE_ACCOUNT_ID`.
3. Na mesma tela, clique **Create a Workers AI API Token → Create API Token → Copy API Token**. Ele vai em `CLOUDFLARE_API_TOKEN`. Se criar token personalizado em vez do modelo pronto, a [instrução oficial](https://developers.cloudflare.com/workers-ai/get-started/rest-api/) exige **Workers AI - Read** e **Workers AI - Edit**.
4. Em `.env.local` para staging/local e em **Vercel → projeto → Settings → Environment Variables** para deploy, coloque `CONTENT_IMAGE_PROVIDER=cloudflare`, Account ID e token. Deixe `CONTENT_IMAGE_MAX_PER_WORKSPACE_PER_DAY=3`, `CONTENT_IMAGE_MAX_PER_POST=3`, `CONTENT_IMAGE_GLOBAL_DAILY_CAP=20` até medir custo. Nunca use `NEXT_PUBLIC_` no token.
5. Faça redeploy. Em um negócio de teste, **Conteúdo → Criar → Gerar carrossel**. Confira que o primeiro card recebe uma imagem, que o arquivo aparece em `media-private`, e que `content_ai_usage` registra `completed`. Se der quota, o editor ainda deve permitir salvar/exportar com imagens próprias. No painel Workers AI, confira Neurons consumidos. Isso é o teste real obrigatório para declarar a integração ativa.

### 3. Composio e Instagram

1. Abra [Composio Dashboard](https://dashboard.composio.dev). Selecione/crie um projeto da **SOBE**. Em **Auth Configs**, escolha o toolkit **Instagram** e crie/use a configuração **Composio-managed OAuth**. Mantenha os escopos padrão compatíveis. Copie o **Auth Config ID** em `COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID`.
2. Em **Settings / API Keys** do projeto, crie uma API key restrita ao projeto com acesso necessário a Connected Accounts e Tools/Proxy. Copie em `COMPOSIO_API_KEY`. Confira no [painel de preços](https://composio.dev/pricing) se a modalidade escolhida cabe no beta gratuito.
3. Configure no projeto Composio as URLs de retorno permitidas para o domínio HTTPS real da SOBE, conforme a tela da sua Auth Config. O código gera `/app/projects/{projectId}/content?tab=instagram&state={nonce}`; o domínio precisa corresponder ao deploy. Se o projeto Composio tiver **OAuth callback verifier**, configure-o somente depois de implementar o fluxo específico de `completeAuth`; o retorno padrão deste MVP pressupõe que essa opção está desligada.
4. Em staging, abra **Conteúdo → Instagram → Conectar Instagram**. Autorize uma conta Business/Creator de teste no seletor Facebook/Instagram. Ao voltar, o status deve se tornar **Conectado** só após consulta remota. Se permanecer pendente, confira permissões da conta/Meta no painel Composio; o callback isolado não prova conexão.
5. Verifique que o ID da conta no painel Composio pertence ao `composio_user_id` desse projeto e que outra empresa não consegue selecioná-lo. O cliente final só vê o botão de autorização, nunca sua API key.
6. Configure `SOCIAL_PUBLISHING_ENABLED=true` **somente em staging**, depois de revisar o item 4. Crie e aprove carrossel de 2–5 cards; leia a confirmação com conta, legenda e número de cards; clique **Publicar agora**. Confirme um link real em **Calendário** e no Instagram de teste. Sem permalink e mídia efetiva, não declare sucesso. Se aparecer `needs_review`, confira a conta manualmente antes de tentar de novo, para evitar duplicidade.

### 4. Agendamento Supabase Cron

1. Gere um segredo aleatório longo, exclusivo para a fila. Coloque **o mesmo valor** em `SOCIAL_PUBLISHING_CRON_SECRET` nas variáveis do deploy (Vercel → projeto → Settings → Environment Variables) e no **Supabase → Database → Vault → New secret**, com nome `sobe_social_cron_secret`. Não grave o valor literal em SQL ou git.
2. Abra **Supabase → Integrations → Cron → Jobs → Create job**. Nome: `sobe-social-publications`; agenda: `* * * * *` (cada minuto). Escolha **SQL snippet** e cole o SQL abaixo, substituindo apenas `https://SEU-DOMINIO` pelo domínio HTTPS público da SOBE, sem barra final. O trecho lê o segredo do Vault em tempo de execução.

```sql
select net.http_post(
  url := 'https://SEU-DOMINIO/api/internal/social-publications/process',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'sobe_social_cron_secret' limit 1
    )
  ),
  body := '{}'::jsonb
);
```

3. Se o painel informar que `pg_net`/Cron não está ativo, habilite **Database → Extensions → pg_net** e **Integrations → Cron** conforme [guia Supabase](https://supabase.com/docs/guides/cron/quickstart). Salve o job e confirme que está **Active**. Não adicione cron frequente ao `vercel.json`: [Vercel Hobby permite só diário](https://vercel.com/docs/cron-jobs/usage-and-pricing).
4. Agende um post de teste para 5–10 minutos adiante. Feche o navegador. Depois do horário, abra **Integrations → Cron → Jobs → sobe-social-publications → Runs** e veja execução bem-sucedida. No **Database → Tables → social_publications**, confira `published`, `external_media_id`, `external_permalink`, `published_at`; abra o link no Instagram. Se ficar `queued`, verifique URL, Vault e resposta do endpoint. Se `needs_review`, confira a conta antes de reprocessar.
5. Em produção, só ative `SOCIAL_PUBLISHING_ENABLED=true` depois de repetir o teste real em staging e confirmar termos/quota da hospedagem. O cron diário de notificações existente não precisa de mudança.

### 5. Variáveis e deploy

Edite `.env.local` apenas para desenvolvimento; produção usa **Vercel → projeto → Settings → Environment Variables** (Production e Preview conforme ambiente). Após cada alteração, **Deployments → Redeploy**. Não adicione segredos a `.env.example`, que contém apenas nomes e valores vazios. O parser fica em `src/lib/env/server.ts`.

| Variável | Valor/ação |
| --- | --- |
| `NEXT_PUBLIC_FEATURE_CONTENT_STUDIO` | `true` para mostrar o módulo; `false` oculta a tela e bloqueia as APIs do módulo. Autorização e RLS continuam obrigatórias |
| `OPENAI_API_KEY` | Chave já usada pela IA de texto da SOBE; tem custo próprio, distinto da Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Painel Cloudflare, etapa 2 |
| `CONTENT_IMAGE_MAX_PER_WORKSPACE_PER_DAY`, `CONTENT_IMAGE_MAX_PER_POST`, `CONTENT_IMAGE_GLOBAL_DAILY_CAP` | Limites internos 3, 3, 20 inicialmente |
| `CONTENT_COPY_MAX_PER_WORKSPACE_PER_MONTH`, `CONTENT_COPY_GLOBAL_MONTHLY_CAP` | Limites internos de chamadas OpenAI 10 por workspace/mês e 100 globais/mês inicialmente; separados da quota anterior |
| `COMPOSIO_API_KEY`, `COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID` | Painel Composio, etapa 3 |
| `SOCIAL_PUBLISHING_ENABLED` | `false` até teste autorizado, depois `true` |
| `SOCIAL_PUBLISHING_CRON_SECRET` | Mesmo segredo do Vault, etapa 4 |

## Quando algo falhar

- **“Configure o Supabase”**: confira URL e Service Role Key existentes e aplique a migration. Não use a chave `anon` no servidor.
- **“Geração de imagem por IA aguardando configuração”**: Account ID/token faltam. Você ainda pode editar e usar templates/fotos do negócio.
- **“Serviço de conteúdo indisponível” ou prévia quebrada no desenvolvimento local**: pare o servidor local e inicie novamente com `npx next dev --webpack`, usando o diretório padrão `.next`; atualize a página e abra o rascunho em **Meus conteúdos**. O roteiro já criado permanece salvo.
- **Quota esgotada**: Cloudflare Free reinicia à 00:00 UTC; limites internos também são diários. Não altere o plano para Paid automaticamente.
- **Instagram pendente**: confirme conta Business/Creator, permissões no seletor Facebook, Auth Config e retorno HTTPS. [Composio alerta que o token fica vinculado à conta selecionada](https://docs.composio.dev/kb/guide/toolkits-instagram); para trocar conta, reconecte.
- **`needs_review`**: o provedor pode ter recebido a publicação apesar de uma falha de rede. Consulte Instagram e Composio antes de reenviar. Não há retry automático propositalmente.
- **Reagendar**: no Calendário, cancele o item ainda `queued`; abra o mesmo conteúdo, escolha o novo horário, aprove a versão atual se necessário e confirme novamente. Depois que o processamento começa, o cancelamento local não desfaz um post enviado.
- **Cron não dispara**: confira job Active, histórico no Supabase, `pg_net`, segredo Vault, URL HTTPS e variável de deploy. O endpoint exige `Authorization: Bearer` com o segredo.

## Arquivos entregues e prova final

- Interface: `src/app/app/projects/[projectId]/content/page.tsx`, `src/components/content-studio/content-studio.tsx`.
- APIs e serviços: `src/app/api/projects/[projectId]/content/`, `src/app/api/projects/[projectId]/social/instagram/`, `src/app/api/internal/social-publications/process/`, `src/server/content-studio/`.
- Banco: `supabase/migrations/202611030065_sobe_content_studio.sql`.
- Testes: `tests/unit/content-studio.test.ts` e os comandos `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- Critério de aceite externo: a imagem Cloudflare real já foi gerada, salva e baixada no ambiente local em 03/11/2026; repita o teste em staging. Ainda faltam **um permalink Instagram real** e **um agendamento realizado com navegador fechado** no ambiente de teste. Registre os resultados em `docs/SOBE-CONTEUDO-IMPLEMENTATION-REPORT.md` antes de liberar clientes.
