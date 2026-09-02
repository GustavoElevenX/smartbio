# SOBE — Hermes Execution State

> Registro operacional único (jornada até o Beta). Branch: `hermes/sobe-beta-final`.

## Etapa atual
CI / Release Gate (P1).

## Status dos itens
- P0-05 Scheduling Nativo = **CLOSED** (código + testes locais; teste real deferido p/ QA).
- P0-06 Stripe/Billing = **código CLOSED**; **config corrigida** (webhook eventos + price). Cobrança real pendente de autorização.
- Termos + Privacidade = **CLOSED** (`51be215`).
- Observabilidade = **CLOSED** (`ae31f23`).
- CI/Release Gate, QA*, Golden Path, Regressão, GO/NO-GO = pendentes.

## Commits (branch hermes/sobe-beta-final)
- `51be215` feat: termos de uso e política de privacidade (P1)
- `ae31f23` feat: observabilidade — logs estruturados (P1)

## Correções de config Stripe (live, a pedido de Gustavo)
- Webhook endpoint `we_1U5t12...`: eventos ajustados para os 6 tratados (adicionado `customer.subscription.updated` e `invoice.payment_failed`; removidos 4 irrelevantes).
- `.env.local`: `STRIPE_PRO_PRICE_ID` → `price_1U5v5pDEBj7v0EqGCbGIpkuK`.
- **Segurança:** revertido vazamento de chaves LIVE em `.env.example` (versionado). Chaves permanecem só em `.env.local` (ignorado) + Vercel.

## Pendências / decisões de Gustavo
- [ ] Cobrança real (prova ponta a ponta do billing) — só com autorização explícita, ou test mode (que Gustavo recusou por ora).
- [ ] Teste integração real do Scheduling (deferido p/ QA/Golden Path).
- [ ] Revisar `STRIPE_PRO_PRICE_ID` no Vercel (produção) — o DB mostra `price_1U5v5p...` como correto.

## Próxima etapa
CI/Release Gate → QA funcional → QA visual → QA painel → Golden Path → Regressão → GO/NO-GO.
