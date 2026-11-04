# Motor Visual da SOBE — guia operacional do fundador

## Atualização de direção de arte (04/11/2026)

O motor aceita produtos, serviços, experiências, cursos e outros assuntos sem regras por segmento. A especificação executável agora define também meio visual (fotografia, ilustração, gráfico ou mistura), área/escala/foco da imagem, zona/escala do texto, tratamento e motivo visual. O usuário pode registrar um ajuste visual para a próxima geração. O arquivo do Carrossell foi analisado em modo leitura; veja `docs/ANALISE-CARROSSELL-MOTOR-VISUAL.md` para o diagnóstico e os limites da integração atual.

O fluxo agora salva uma especificação de direção criativa antes do PNG: objetivo, conceito, produto, estilo, composição, tipografia, distribuição, paleta, fotografia, marca e restrições. Com `OPENAI_API_KEY`, a IA propõe três direções distintas; sem a chave, o modo de demonstração usa três direções determinísticas. A foto continua sendo gerada por Cloudflare Workers AI e o texto permanece editável no estúdio. As seis estratégias novas são Full Bleed, Editorial, Product Hero, Minimal Premium, Promotional e Lifestyle. Composição final: SVG e Sharp.

Para a direção de arte, geração premium e auditoria visual do PNG final, configure `OPENAI_API_KEY`, `OPENAI_MODEL` e, opcionalmente, `OPENAI_VISION_MODEL` no servidor/Vercel. A auditoria verifica correspondência do produto, legibilidade, contraste, marca, margens, hierarquia, alinhamento, densidade, cortes e cores do Design Kit. Para geração básica de baixo custo, configure Cloudflare. Sem qualquer provedor de imagens, escolha uma foto existente; a aprovação de composições fotográficas com produto anunciado exige foto. Sem OpenAI, continuam as validações determinísticas, mas a auditoria visual por visão não roda. Compare a embalagem final com o produto vendido antes de publicar.

O caso de teste Casa de Sucos Mix está em `artifacts/visual-engine/`: três PNGs 1080 × 1350 e as fotografias de teste. O produto foi declarado como suco de laranja em embalagem de 1 litro; nenhum preço, ingrediente ou benefício foi criado. Essas imagens são material de teste interno e não devem aparecer em páginas públicas.

## O que foi entregue

O menu **Artes com IA** abre um estúdio web dentro de cada negócio. A SOBE monta automaticamente um Design Kit com o nome, as cores e o logo cadastrados. O usuário escolhe um formato e pode deixar todos os campos de texto em branco: o contexto do negócio preenche o primeiro rascunho. Cada criação salva três alternativas. Há seis formatos (destaque do site, oferta, card vertical, post quadrado, story e prévia de link), seis composições, edição de texto/foto/layout, prévia idêntica ao PNG baixado, aprovação e aplicação ao destaque de uma página em rascunho.

O modo básico usa SVG e Sharp no servidor e não consome uma chamada de IA. A opção **Gerar imagem com IA** já está conectada ao Workers AI da Cloudflare. A IA produz só a fotografia de apoio; o texto, o preço, o botão e a marca são desenhados pela SOBE, para evitar letras inventadas na imagem. A arte aprovada é salva na biblioteca privada de mídia. O Design Kit e a arte aprovada ficam ligados ao negócio e são usados nas próximas criações. A primeira alternativa pode reaproveitar a composição e a foto aprovadas; as demais exploram outras composições. O modelo FLUX.1 schnell usado aqui recebe texto, não a imagem da referência como entrada: a reutilização é feita pelos dados de estilo e pelo arquivo de foto salvo.

## 1. Banco de dados — obrigatório para negócios reais

O código está pronto, mas o banco remoto precisa receber as migrações. No repositório, as duas últimas são:

1. `supabase/migrations/202611030065_sobe_content_studio.sql` — módulo Conteúdo anterior, inclusive a tabela de uso de IA.
2. `supabase/migrations/202611030066_sobe_visual_engine.sql` — Design Kit, artes, cota compartilhada e permissões por workspace.

**A ordem importa.** Se a 065 já estiver aplicada, execute apenas a 066. Se não souber, use o procedimento com `db push --dry-run`: ele mostra as migrações pendentes sem alterar o banco.

### Caminho recomendado, mantendo o histórico de migrações

1. Abra [Supabase Dashboard](https://supabase.com/dashboard) e selecione **o projeto de staging** da SOBE.
2. Na página do projeto, abra **Project Settings → General** e copie o **Project ID** (também chamado *project ref*).
3. No terminal, dentro da pasta raiz da SOBE, execute `npx supabase login` e conclua o login no navegador.
4. Execute `npx supabase link --project-ref SEU_PROJECT_ID` substituindo apenas o trecho em maiúsculas pelo ID copiado.
5. Execute `npx supabase db push --dry-run --remote`. Leia a lista: confirme que ela inclui a 066 e, se necessário, a 065. Se aparecerem migrações antigas inesperadas ou mensagem de histórico divergente, pare e reconcilie o histórico antes de aplicar.
6. Execute `npx supabase db push --remote`. Esse comando aplica somente as migrações pendentes e registra o histórico no Supabase.
7. No Dashboard, abra **Database → Table Editor**. Confirme que existem `visual_design_kits`, `visual_artworks` e `visual_ai_usage`.
8. Abra **Storage** e confirme que existe o bucket privado `media-private` (ele é criado por uma migração antiga da SOBE). Não mude o bucket para público.

O comando `db push --remote` e o uso de `--dry-run` seguem a [documentação atual do Supabase](https://supabase.com/docs/guides/local-development/cli-workflows). Evite colar migrações avulsas no SQL Editor quando o projeto usa histórico de migrações: o [Supabase alerta](https://supabase.com/docs/guides/deployment/database-migrations) que isso não registra a migração e pode quebrar o próximo `db push`.

## 2. Geração de imagem premium e alternativa de baixo custo

Para imagem de padrão publicitário, configure no servidor e na Vercel:

```dotenv
OPENAI_API_KEY=...
VISUAL_IMAGE_PROVIDER=openai
VISUAL_IMAGE_MODEL=gpt-image-2.5-sunburst
VISUAL_IMAGE_QUALITY=xhigh
```

O modo `auto` prioriza OpenAI quando a chave existe e usa Cloudflare caso contrário. `max` é a qualidade mais alta, com maior custo; `high` reduz custo. Estas variáveis afetam apenas o Motor Visual. A geração premium aceita uma foto selecionada na arte como referência para preservar a embalagem real. Para produtos com formato, rótulo ou marca específicos, suba uma foto do produto antes de gerar. Sem referência, inspecione o resultado antes de publicar.

### Cloudflare Workers AI — alternativa básica para a foto gerada por IA

O modo de templates funciona sem Cloudflare. Para ativar o botão **Gerar imagem com IA**:

1. Entre em [Cloudflare Dashboard](https://dash.cloudflare.com/) com a conta da SOBE.
2. Abra **Workers AI** no menu da conta e clique em **Use REST API**.
3. Clique em **Create a Workers AI API Token**. Confira as permissões sugeridas para Workers AI, clique em **Create API Token**, depois em **Copy API Token**. Guarde a cópia em um gerenciador de senhas; não cole o token em chat nem em repositório.
4. Na mesma tela, copie o **Account ID** em **Get Account ID**. Ele é diferente do token.
5. Na raiz do projeto, abra `.env.local` e confira estas linhas, uma vez cada:

   ```dotenv
   CONTENT_IMAGE_PROVIDER=cloudflare
   CLOUDFLARE_ACCOUNT_ID=COLE_O_ACCOUNT_ID
   CLOUDFLARE_API_TOKEN=COLE_O_TOKEN
   CONTENT_IMAGE_MAX_PER_WORKSPACE_PER_DAY=3
   CONTENT_IMAGE_MAX_PER_POST=3
   CONTENT_IMAGE_GLOBAL_DAILY_CAP=20
   ```

6. Reinicie `npm run dev` depois de mudar `.env.local`.

**Não use `NEXT_PUBLIC_` em `CLOUDFLARE_API_TOKEN`.** A chave é lida apenas no servidor. O mesmo conjunto de limites é usado por Conteúdo e Artes; a migração 066 faz as duas telas compartilharem o limite global e por workspace. Os números acima são limites da SOBE, não uma garantia de custo da Cloudflare. A [documentação oficial do REST API](https://developers.cloudflare.com/workers-ai/get-started/rest-api/) mostra a localização do token e do Account ID; a [página de preços](https://developers.cloudflare.com/workers-ai/platform/pricing/) mostra a franquia vigente e o uso em **Workers AI**. Consulte essa tela antes de aumentar os limites.

Se `.env.local` já contém essas linhas, **não duplique**. Troque apenas valores vencidos. A captura de tela compartilhada anteriormente mostrou credenciais; por segurança, gere novos tokens/chaves nos painéis dos serviços expostos e atualize `.env.local` e Vercel. Isso vale especialmente para chaves secretas, nunca para campos públicos de identificação.

## 3. Vercel — ativar no deploy

1. Abra [Vercel Dashboard](https://vercel.com/dashboard), selecione o time correto e clique no projeto da SOBE.
2. Vá em **Settings → Environment Variables**.
3. Adicione ou edite as seis variáveis do bloco acima. Cole Account ID e token nos campos **Value** correspondentes. Marque **Preview** para staging e **Production** somente quando a migração tiver sido aplicada ao banco de produção. Use **Secret** para o token, se a interface oferecer tipo de variável.
4. Confirme que as variáveis de Supabase já utilizadas pela SOBE também existem nesse ambiente: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. A service role é secreta e jamais recebe `NEXT_PUBLIC_`.
5. Vá em **Deployments** e faça um novo deploy da versão com o Motor Visual. Alterações nas variáveis só passam a valer em deploys novos, conforme a [documentação da Vercel](https://vercel.com/docs/environment-variables).

## 4. Como validar cada integração

### Design Kit e templates sem IA

1. No staging, entre na SOBE e abra um negócio que já tenha nome, descrição e, se possível, marca configurada.
2. No menu lateral, clique **Artes com IA**. Confirme que aparecem cinco cores no Design Kit e que não foi solicitado um questionário.
3. Em **Formato**, escolha **Destaque do site**. Deixe os outros campos vazios e clique **Gerar três alternativas grátis**.
4. Confirme três miniaturas diferentes. Escolha uma, edite o título e clique **Salvar e regenerar**.
5. Clique **Baixar PNG**. Abra o arquivo e confira texto, cores e dimensões. Para destaque: 1600 × 900 px.
6. Clique **Aprovar esta arte**. Confirme que ela também aparece em **Mídia**. Gere outro conjunto e confira se a primeira alternativa preserva a direção aprovada.

### Cloudflare

1. Na arte escolhida, clique **Gerar imagem com IA**.
2. Confirme que a foto aparece por trás da composição, sem texto desenhado pela IA. Revise antes de aprovar.
3. Abra **Cloudflare → Workers AI** e confira o incremento de uso na conta correta. Se a tela da SOBE disser “aguardando configuração”, confira Account ID/token no ambiente onde a SOBE está rodando e reinicie ou faça novo deploy.
4. A cota interna reinicia às 00:00 UTC. Se a Cloudflare exceder a própria franquia, a chamada pode falhar mesmo antes da cota da SOBE.

### Aplicação no site

1. Aprove uma arte em um negócio que tenha uma página com seção de destaque (*hero*).
2. Em **Aplicar no destaque da página**, escolha a página e clique **Aplicar no rascunho**.
3. Clique **Abrir editor do site**. Confira a imagem no destaque e revise a versão móvel.
4. Publique somente depois da revisão. A aplicação no Motor Visual altera o **rascunho**, não publica automaticamente.

## 5. Estado dos testes nesta entrega

- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npx vitest run --maxWorkers=2`: 76 arquivos e 473 testes passaram.
- `npx next build --webpack`: passou, incluindo as novas páginas e rotas.
- Playwright em servidor de demonstração isolado: 2 testes passaram (celular e desktop) para criar alternativas, editar, aprovar e exportar PNG.

**Ainda não foi validado com o novo esquema remoto:** a criação de registros reais no Supabase, upload da arte aprovada no Storage, a chamada de Cloudflare pelo novo endpoint e a aplicação em uma página real. A migração 066 não foi executada no banco remoto nesta tarefa. O teste de demonstração usa armazenamento em memória e não prova essas integrações externas. A geração Cloudflare do módulo Conteúdo anterior foi verificada em outra etapa; isso não substitui o teste do novo fluxo.

## Arquivos do Motor Visual

- Interface: `src/components/visual-engine/visual-studio.tsx`, `src/app/app/projects/[projectId]/visuals/page.tsx`, link em `src/components/dashboard/dashboard-shell.tsx`.
- Contratos e planejamento: `src/features/visual-engine/schema.ts`, `src/features/visual-engine/visual-planner.ts`.
- Serviço e renderização: `src/server/visual-engine/visual-service.ts`, `src/server/visual-engine/render-art.ts`.
- API autenticada: `src/app/api/projects/[projectId]/visuals/route.ts`, `src/app/api/projects/[projectId]/visuals/kit/route.ts`, `src/app/api/projects/[projectId]/visuals/[artworkId]/route.ts`, `src/app/api/projects/[projectId]/visuals/[artworkId]/render/route.ts`, `src/app/api/projects/[projectId]/visuals/[artworkId]/approve/route.ts`, `src/app/api/projects/[projectId]/visuals/[artworkId]/image/route.ts`, `src/app/api/projects/[projectId]/visuals/[artworkId]/apply/route.ts`.
- Banco: `supabase/migrations/202611030066_sobe_visual_engine.sql`.
- Testes: `tests/unit/visual-engine.test.ts`, `tests/e2e/visual-engine.spec.ts`.

Os arquivos do pacote Carrossell foram usados como referência de pesquisa em `.tmp/carrossell-reference/`; nenhum módulo extraído foi importado pela aplicação ou copiado para produção.
