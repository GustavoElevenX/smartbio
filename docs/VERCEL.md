# Publicação na Vercel

## 1. Gerar o arquivo de importação

Com o `.env` local contendo as chaves reais do Supabase e, opcionalmente, da OpenAI:

```bash
npm run vercel:env:generate
```

O comando cria `.env.vercel`, que é ignorado pelo Git e contém apenas pares válidos `CHAVE=VALOR`. Ele:

- remove `NODE_ENV`, valores vazios e endereços `localhost`;
- preserva as chaves existentes do Supabase e da OpenAI;
- gera segredos aleatórios fortes quando necessário;
- desativa mapas e e-mail automaticamente enquanto os respectivos provedores não estiverem configurados;
- preserva os segredos gerados se o comando for executado novamente.

Na Vercel, abra **Settings → Environment Variables**, importe `.env.vercel` e marque **Production**, **Preview** e **Development**. Nunca importe `.env` ou `.env.example`.

## 2. Configuração do projeto

- Framework Preset: **Next.js**
- Root Directory: diretório raiz do repositório
- Install Command: `npm install`
- Build Command: `npm run build`
- Node.js: `22.x`
- Ative **Automatically expose System Environment Variables**. Assim a aplicação usa `VERCEL_PROJECT_PRODUCTION_URL` sem exigir que o domínio exista antes do primeiro deploy.

No plano Hobby, o processamento de notificações está agendado uma vez por dia. Planos pagos podem voltar a usar uma frequência maior em `vercel.json`.

## 3. Supabase Auth

Depois do primeiro deploy, copie o domínio exibido pela Vercel. No Supabase, abra **Authentication → URL Configuration** e configure:

- Site URL: `https://seu-dominio`
- Redirect URL: `https://seu-dominio/auth/callback`

Ao adicionar um domínio próprio, atualize essas duas URLs. Você também pode cadastrar `NEXT_PUBLIC_APP_URL` e `NEXT_PUBLIC_PUBLIC_BASE_URL` com o domínio definitivo e redeployar.

## 4. Serviços opcionais

- **Upstash Redis:** recomendado para limites de uso distribuídos. Ao cadastrar `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`, a aplicação passa a usá-lo automaticamente.
- **Resend:** exige `RESEND_API_KEY` e `EMAIL_FROM`; depois, ative `NEXT_PUBLIC_FEATURE_NOTIFICATIONS=true` e use `EMAIL_PROVIDER=resend`.
- **Google Maps:** exige `GOOGLE_MAPS_SERVER_API_KEY` e `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`; depois, ative `NEXT_PUBLIC_FEATURE_GEO_ROUTING=true`.

Alterações em variáveis só entram em vigor em um novo deploy.
