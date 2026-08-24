# Checklist Stripe para lançamento

Este checklist complementa `STRIPE-BILLING.md`. Marque somente com credenciais reais do ambiente. Unit/E2E com mock não aprovam sandbox.

## Automatizado

- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] Confirmar testes de início do trial após primeira estrutura, trial sem cartão e expiração.
- [ ] Confirmar testes de entitlement: público bloqueado no trial expirado e restaurado após upgrade.
- [ ] Confirmar owner-only para checkout, cancelamento, reativação e forma de pagamento.
- [ ] Confirmar cancelamento no fim do período e política `past_due`.
- [ ] Confirmar validação de motivo/comentário de cancelamento.

## Sandbox real

- [ ] Configurar chaves test da Stripe somente no servidor e publishable key no client.
- [ ] Configurar endpoint e secret de webhook conforme `STRIPE-BILLING.md`.
- [ ] Criar conta comum; concluir primeira estrutura; comprovar que o trial iniciou sem cartão.
- [ ] Abrir Checkout incorporado como owner e concluir com cartão de teste.
- [ ] Confirmar webhook, snapshot de subscription, plan assignment e entitlements Pro.
- [ ] Abrir página pública e executar uma ação permitida pelo Pro.
- [ ] Atualizar forma de pagamento pelo SetupIntent.
- [ ] Forçar/usar evento `past_due` e verificar a política do produto.
- [ ] Agendar cancelamento e confirmar acesso Pro até `current_period_end`.
- [ ] Reativar antes do fim do período e confirmar remoção de `cancel_at_period_end`.
- [ ] Tentar as mesmas ações como member e confirmar bloqueio.
- [ ] Verificar que fatura/Checkout não expõem secrets em HTML, logs ou respostas.
- [ ] Verificar `checkout_started`, `subscription_started`, `subscription_cancelled` e feedback opcional sem dados de cartão.

## Produção

- [ ] `npm run production:env`
- [ ] `npm run production:check`
- [ ] Repetir smoke test com configuração live e transação controlada.
- [ ] Confirmar URL pública e redirects de retorno no domínio definitivo.
- [ ] Registrar data, operador, conta de teste e evidências no change record da release.

Status nesta entrega: **PENDENTE DE AMBIENTE** até a seção Sandbox real ser executada com credenciais válidas.
