# Stripe Billing na SOBE

Para a validação final de release, use também [`SOBE-STRIPE-LAUNCH-CHECKLIST.md`](./SOBE-STRIPE-LAUNCH-CHECKLIST.md). Testes locais não substituem a aprovação do sandbox real.

## Arquitetura

A Stripe é a fonte financeira (Customer, Subscription, invoices e formas de pagamento). `subscriptions` mantém o espelho financeiro. `workspace_plan_assignments` continua sendo a única fonte de autorização de recursos.

A cobrança é por workspace e usa uma única oferta: SOBE Pro, R$ 69,90 por mês. O trial de 7 dias permanece sem cartão e é controlado pela SOBE; não existe trial na Subscription Stripe.

## Variáveis

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: chave publicável usada apenas pelo Stripe.js no browser.
- `STRIPE_API_KEY`: chave server-side; prefira uma Restricted API Key `rk_`.
- `STRIPE_WEBHOOK_SECRET`: signing secret do endpoint.
- `STRIPE_PRO_PRICE_ID`: Price mensal ativo do SOBE Pro.
- `STRIPE_PRO_PRODUCT_ID`: Product ativo do SOBE Pro.
- `NEXT_PUBLIC_FEATURE_BILLING`: habilita a experiência de cobrança.

Em produção, a feature flag exige todas as variáveis. O gerador `.env.vercel` copia valores fornecidos pelo operador e nunca inventa credenciais Stripe.

## Fluxos

- Checkout: `POST /api/billing/checkout` cria ou reutiliza o Customer do workspace, impede assinatura duplicada e entrega apenas o `client_secret` de uma Checkout Session embedded.
- Status: `GET /api/billing/status` reconcilia o snapshot atual e retorna um DTO próprio com plano, período, cartão mascarado e faturas recentes.
- Cancelamento: `POST /api/billing/cancel` agenda `cancel_at_period_end`; o Pro permanece ativo até o fim do ciclo.
- Reativação: `POST /api/billing/reactivate` remove o cancelamento da mesma Subscription.
- Cartão: `POST /api/billing/setup-intent` inicia o Payment Element e `POST /api/billing/payment-method` valida o método anexado ao Customer antes de defini-lo como padrão.
- Webhook: `POST /api/billing/stripe/webhook` lê o body bruto, valida `Stripe-Signature`, registra idempotência e recupera o snapshot atual da Subscription para tolerar eventos fora de ordem.

Eventos tratados: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed`.

## Estados e entitlements

- `active`: Pro ativo.
- `past_due`: Pro mantido durante a recuperação e alerta na UI.
- `incomplete`: não concede Pro e bloqueia um segundo checkout enquanto recuperável.
- `unpaid`, `canceled`, `incomplete_expired` e `paused`: assignment Pro expirado, sem apagar dados ou reiniciar trial.
- `cancel_at_period_end=true`: Pro continua ativo até a Subscription encerrar de fato.

## Padrões de UI de cobrança

A tela de cobrança é uma superfície operacional: prioriza leitura rápida de plano, estado financeiro, próxima ação e histórico. O plano ocupa um único palco navy dominante; detalhes de cartão e faturas ficam em superfícies claras secundárias, evitando uma grade de cards equivalentes.

- Azul Sobe é reservado às ações financeiras primárias. Verde comunica sucesso, âmbar sinaliza `past_due` ou cancelamento agendado e vermelho identifica falha ou ação destrutiva; essas cores semânticas não são substituídas pelo gradiente da marca.
- Texto secundário sobre superfícies claras usa `#596879` ou contraste superior. Controles interativos têm área mínima de 44px, foco visível e rótulos em português, inclusive o fechamento de diálogos.
- Carregamento e erro são estados neutros e explícitos: dados de trial, plano, cartão ou renovação só aparecem depois que entitlements e status financeiro terminam de carregar. Sucesso e erro usam mensagens visualmente distintas; erros usam `role="alert"`.
- `past_due` e `cancel_at_period_end` recebem avisos contextuais visíveis, e a badge do plano descreve cancelamento agendado em vez de aparentar assinatura simplesmente ativa. Faturas abertas ou vencidas mostram o valor devido; faturas pagas mostram o valor pago.
- Ações de owner usam Checkout embedded e Payment Element sem retirar o usuário da SOBE. Members e support veem o mesmo resumo em modo de consulta, acompanhado de explicação sobre as ações exclusivas do owner.
- No desktop, resumo, ações e histórico aproveitam a largura disponível; em telas estreitas, conteúdo e ações empilham, mantendo valores, estados e links legíveis sem rolagem horizontal.

## Sandbox

1. Configure chaves de teste e aplique as migrations Supabase.
2. Rode `stripe listen --forward-to localhost:3000/api/billing/stripe/webhook` e configure o signing secret emitido apenas no ambiente local.
3. Abra `/app/settings/billing` como owner e conclua o Checkout embedded com cartão de teste Stripe.
4. Verifique `subscriptions`, `workspace_plan_assignments` e `billing_webhook_events`.
5. Teste 3DS, falha de pagamento, cancelamento, reativação e troca de cartão apenas com recursos de sandbox.

## Go-live

1. Crie Product/Price LIVE equivalentes sem reutilizar IDs de teste.
2. Crie uma Restricted API Key LIVE com o mínimo de permissões descrito abaixo.
3. Faça deploy e cadastre a URL pública real `/api/billing/stripe/webhook` no Workbench/Dashboard; não use URL inventada.
4. Assine apenas os seis eventos tratados e grave o signing secret na Vercel.
5. Habilite Smart Retries e e-mails de falha em Billing → Revenue Recovery; defina explicitamente o estado final depois de todas as tentativas.
6. Rode o checklist sandbox novamente em um ambiente de teste antes de aceitar cobranças LIVE.

Permissões mínimas da Restricted API Key para as chamadas server-side atuais: escrita em Customers, Checkout Sessions, Subscriptions e Setup Intents; leitura em Checkout Sessions, Subscriptions, Payment Methods e Invoices. O runtime usa os IDs configurados de Product/Price e não chama diretamente os endpoints de Products ou Prices.

## Troubleshooting

- Webhook 400: confirme que o signing secret pertence exatamente ao endpoint/ambiente e que nenhum proxy altera o body bruto.
- Checkout indisponível: confira as cinco variáveis Stripe e a feature flag.
- 403 em runtime: revise as permissões da Restricted API Key pelos request logs da Stripe.
- Plano desatualizado: confira eventos falhos em `billing_webhook_events`; uma nova entrega pode reivindicar eventos falhos ou travados.

Segredos nunca devem ser enviados ao client, logs, analytics ou arquivos versionados.
