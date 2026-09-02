# Task: corrigir falha de ID no e2e self-service-activation (P1)

## Sintoma
`npm run test:e2e` → `tests/e2e/self-service-activation.spec.ts` linha 101 falha (determinístico, em mobile E desktop):
```
expect(generated.commercialConfig.serviceOfferings.map((item) => item.id))
  .toEqual(persistedPlan?.offerings.map((item) => item.id));
```
Recebido: 5 UUIDs diferentes dos esperados (nomes batem na linha 102; `settings.discoveryPlanId` e `offerIntelligence` apontam corretamente).

## Contexto do código
- `src/features/ai-setup/materialize-setup-answers.ts` → `serviceOfferings()` (linha ~292) tem DOIS caminhos:
  1. Com `plan` (linha ~300): usa `id: planned.id` (preserva ID do offering do plano).
  2. Sem `plan` (linha ~339): gera `uid("offering")` novo.
- Chamada na linha ~607: `serviceOfferings(project, offeringNames, selectedDestination, currentConfig.serviceOfferings, session.initialInput.description, boundDiscoveryPlan)`.
- `boundDiscoveryPlan` vem de `bindDiscoveryPlanToProject(session.discoveryPlan, project.id)` (linha ~577), que NÃO altera `offerings`.
- O teste espera que `commercialConfig.serviceOfferings[].id` seja igual a `discoveryPlan.offerings[].id`.

## Diagnóstico que você deve confirmar
Descobrir EXATAMENTE por que os IDs divergem apesar do caminho com `plan` usar `planned.id`. Hipóteses a verificar (não assuma):
1. `boundDiscoveryPlan` está falsy no momento da geração (caindo no fallback que gera IDs novos)?
2. O `session.discoveryPlan` na geração tem `offerings` com IDs diferentes do plano persistido antes da geração?
3. Alguma etapa re-gera os `offerings` (ex.: re-análise, merge, re-materialização) entre o "beforeGeneration" e o "afterGeneration" do teste?

## Correção esperada
Preservar os IDs dos offerings do discovery plan no `commercialConfig.serviceOfferings` (contrato de estabilidade de ID — é o que o teste e a rastreabilidade/atribuição esperam). Se, após diagnóstico, concluir que a regeneração de ID é intencional e o vínculo correto é via `settings.discoveryPlanId`, então ajuste o TESTE (linha 101) para assertar o vínculo correto — mas só depois de justificar claramente. PREFIRA preservar IDs.

## Restrições
- NÃO alterar comportamento de UI, fluxo, arquitetura comercial, RLS, billing ou scheduling.
- NÃO tocar em outros specs.
- Mudança mínima e cirúrgica.

## Verificação obrigatória (antes de reportar)
1. `npm.cmd run test:e2e` (ou ao menos o spec `self-service-activation.spec.ts`) passa.
2. `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build` passam.
3. `npm.cmd test` (suíte unit) passa.

## Relatório esperado
- Causa raiz exata.
- Arquivos alterados + diff.
- Como verificou cada critério.
