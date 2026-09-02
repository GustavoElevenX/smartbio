# Task: Termos de Uso + Política de Privacidade (P1)

Projeto SOBE — plataforma de bio/link inteligente que transforma atenção em ação.
Stack: Next.js 16 (versão modificada — leia `node_modules/next/dist/docs/` se for escrever código de roteamento), Tailwind v4, React 19, TypeScript.
IMPORTANTE: leia `AGENTS.md` no repositório antes de codar.

## Objetivo
Criar páginas públicas de Termos de Uso (`/terms`) e Política de Privacidade (`/privacy`) em pt-BR, coerentes com o produto, e linká-las nos pontos de consentimento e rodapé. Manter conciso — NÃO transformar em projeto jurídico gigante.

## Produto (contexto para escrever conteúdo real)
A SOBE ajuda negócios a transformar atenção de redes sociais em uma estrutura digital (bio/link) com jornadas guiadas que levam o visitante à próxima ação (agendar, pedir, qualificar, reservar, comprar). O dono do negócio cria um "projeto", passa por onboarding (ativação guiada por IA/OpenAI), publica uma página pública. Visitantes anônimos geram leads (nome/contato) e oportunidades. Há cobrança (SOBE Pro, Stripe) e agendamento nativo. Leia `PRODUCT.md` e `README.md` se precisar de mais contexto.

## O que implementar

### 1. Página `/terms`
Arquivo sugerido: `src/app/(marketing)/terms/page.tsx` (mesmo padrão de `/pricing`, que fica em `src/app/(marketing)/pricing/page.tsx`).
Conteúdo mínimo coerente: uso do serviço, conta, dados do negócio, conteúdo publicado, cobrança (referência ao SOBE Pro), limitação de responsabilidade, contato. Sem dados falsos (não citar CNPJ/endereço inventados — usar contato por e-mail/suporte genérico).

### 2. Página `/privacy`
Arquivo sugerido: `src/app/(marketing)/privacy/page.tsx`.
Conteúdo mínimo: dados coletados (conta/negócio do usuário; dados de leads de visitantes), finalidade, processamento por IA (OpenAI), retenção, compartilhamento (Supabase, Stripe, provedores de infra), direitos do titular (LGPD mínimo), e canal para solicitar exclusão/portabilidade de dados (e-mail de contato). Coerente e não exaustivo.

### 3. Links reais no consentimento do cadastro
Em `src/app/(auth)/layout.tsx`, linha 18, o texto "Ao continuar, você concorda com os termos e a política de privacidade." deve virar links: "termos" → `/terms` e "política de privacidade" → `/privacy` (usar `Link` do next/link, mantendo o estilo atual).

### 4. Links no rodapé de marketing
- `src/components/marketing/header.tsx` — componente `MarketingFooter` (linha ~23): adicionar links "Termos" e "Privacidade" ao lado dos existentes ("Preço", "Abrir painel").
- `src/components/marketing/virou-landing.tsx` — `<footer>` (linha ~324): adicionar links "Termos" e "Privacidade" junto ao "© 2026 SOBE".

## Comportamento proibido
- NÃO quebrar fluxos de auth/login/register/onboarding.
- NÃO alterar billing, scheduling, RLS, supabase ou arquitetura comercial.
- NÃO escrever conteúdo jurídico gigante; manter páginas objetivas.
- NÃO usar conteúdo placeholder (lorem ipsum) — escrever texto real em pt-BR.
- NÃO mudar o design system (marca SOBE: navy `#07172f`, azul `#0054fc`, mint `#02e5cd`; reutilizar MarketingHeader/MarketingFooter para consistência visual).

## Critérios de aceite (verificação)
1. `npm run lint` passa.
2. `npm run typecheck` passa.
3. `npm run build` passa.
4. Rotas `/terms` e `/privacy` renderizam com status 200.
5. Links de consentimento (auth layout) e rodapés apontam para `/terms` e `/privacy` corretamente.

## Relatório esperado do Codex
Ao terminar, liste: arquivos criados/alterados, e como verificou cada critério de aceite.
