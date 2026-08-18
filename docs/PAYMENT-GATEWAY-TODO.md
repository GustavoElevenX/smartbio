# Stripe Billing — estado da integração

Concluído no código:

- adapter tipado `StripeBillingProvider` com API `2026-06-24.dahlia`;
- Checkout embedded, Customer por workspace e proteção idempotente contra duplicação;
- status, cancelamento no fim do ciclo, reativação, SetupIntent/Payment Element e faturas;
- webhook assinado, idempotente e reconciliado pelo snapshot atual da Subscription;
- sincronização `subscriptions` → `workspace_plan_assignments`;
- permissões owner/member/support, rate limit, analytics e readiness de produção;
- documentação operacional em `docs/STRIPE-BILLING.md`.

Pendente por depender do ambiente:

- aplicar a migration no Supabase de cada ambiente;
- configurar as credenciais runtime na Vercel;
- cadastrar o webhook somente depois de conhecida a URL pública real;
- validar o fluxo completo no sandbox com um workspace real;
- habilitar e revisar Smart Retries/estado final de Revenue Recovery antes do go-live.

O gateway informa estado financeiro. A autorização continua sendo decidida por Plan + Entitlements + Overrides + Usage.
