# PAYMENT_GATEWAY_PENDING

PENDENTE:

1. Escolher gateway.
2. Implementar o adapter `BillingProvider`.
3. Criar checkout.
4. Criar customer portal, se existir.
5. Validar assinatura de webhook.
6. Garantir idempotência financeira.
7. Mapear produtos e preços do provedor.
8. Mapear ciclo de assinatura para `workspace_plan_assignments`.
9. Definir falha/past due e período de graça.
10. Implementar cancelamento.
11. Executar testes de sandbox.

O gateway informa estado financeiro. A autorização continua sendo decidida por Plan + Entitlements + Overrides + Usage.
