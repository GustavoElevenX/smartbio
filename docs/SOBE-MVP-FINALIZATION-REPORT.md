# Relatório de fechamento do MVP — páginas, Journey, Forms e Design

Data: 17 de agosto de 2026

## Resumo executivo

O fechamento foi aplicado de forma incremental sobre os modelos e runtimes existentes. Não houve criação de um segundo construtor, troca de arquitetura, nova área analítica ou recurso específico de nicho.

O Journey agora possui Form Builder visual, payloads reais para URL e WhatsApp, controles globais de design que alteram o renderer e editores rápidos sem JSON. O Presence passou a expor `start_activation` no editor universal. O fluxo de benefício permite continuar a meta de conversão sem claim quando a pessoa não é elegível. A visão de leads usa os rótulos construídos no formulário e preserva origem, campanha e data.

## Checklist de entrega

### P0.1 — Journey Form Builder

- [x] Adicionar, editar, excluir e duplicar campos.
- [x] Reordenar campos para cima e para baixo.
- [x] Suportar `text`, `email`, `phone`, `number`, `textarea`, `select`, `radio`, `checkbox`, `date`, `time`, `url` e `file`.
- [x] Exibir nomes amigáveis dos tipos.
- [x] Gerar chave semântica e estável apenas na criação/duplicação.
- [x] Validar rótulo, chave, duplicidade e opções obrigatórias.
- [x] Editar opções individualmente, sem lista por vírgula ou JSON.
- [x] Configurar `includeInHandoff` e `handoffLabel`.
- [x] Exibir arquivo apenas em projetos com Media Library disponível.
- [x] Atualizar imediatamente o preview e persistir no `Project` existente.
- [x] Manter o handoff restrito aos campos explicitamente marcados.

### P0.2 — Payloads das ações da Journey

- [x] `open_url` com URL completa e validação HTTP/HTTPS.
- [x] `open_whatsapp` com destino configurado, telefone manual/padrão e mensagem inicial.
- [x] Runtime resolve o telefone do destino antes do fallback do projeto.
- [x] `go_to_step`, `finish`, `submit_form` e `start_capability` preservados.
- [x] Troca de tipo limpa payload incompatível.

### P0.3 — Presence `start_activation`

- [x] Tipo disponível no editor universal de ações.
- [x] Seletor limitado a ativações ativas/agendadas conectadas a uma meta.
- [x] Mensagem vazia quando não há ativação utilizável.
- [x] Botão para usar o telefone padrão do projeto no WhatsApp.
- [x] Readiness de URL, telefone, meta, página e referência de ativação.
- [x] Publicação valida no servidor se a ativação está publicada, ativa/agendada e conectada a uma meta.

### P0.4 — Continuar sem benefício

- [x] “Continuar sem benefício” fecha a validação e abre a meta de conversão da ativação.
- [x] Nenhum `benefitClaimId` ou código é anexado nesse caminho.
- [x] O caminho com benefício continua anexando claim e código.

### P0.5 — Design e consistência do renderer

- [x] Presets Minimal, Editorial e Expressivo.
- [x] Cores globais com correção de contraste já existente.
- [x] Fonte de títulos e corpo em listas controladas.
- [x] Raio, card e botão configuráveis.
- [x] Card e botão alteram o renderer público, sem controles decorativos falsos.
- [x] Aba Visual do editor Presence preservada como painel funcional.
- [x] Overflow horizontal móvel corrigido no editor Journey.

### P1 — IA e edição rápida

- [x] “Sugerir campos com IA” reutiliza a regeneração estruturada da etapa.
- [x] Proposta nunca é aplicada automaticamente.
- [x] Cada campo sugerido possui seleção individual antes de ser adicionado.
- [x] Prompt limita a proposta a dados mínimos, úteis e não sensíveis.
- [x] Editores rápidos para texto, formulário, grade de escolhas, serviços, categorias, itens, fulfillment e unidades.
- [x] JSON aparece somente no modo Avançado.
- [x] Rótulos técnicos substituídos por nomes humanos no modo rápido.

### Leads e handoff

- [x] Respostas usam o rótulo configurado no Form Builder.
- [x] Origem, campanha e data aparecem no detalhe.
- [x] CSV continua exportando contexto e respostas.
- [x] Handoff envia apenas campos com `includeInHandoff`.

## Readiness e segurança

- Campos inválidos bloqueiam publicação.
- URLs externas exigem `http://` ou `https://`.
- WhatsApp aceita destino configurado ou fallback válido do projeto.
- Ativações são revalidadas no servidor durante publicação; dados do navegador não autorizam uma ativação inválida.
- O endpoint administrativo de ativações respeita persistência em memória no modo local e não consulta UUID de demonstração no banco.

## Verificação executada

- `npm run lint`: aprovado, sem warnings.
- `npm run typecheck`: aprovado.
- `npm run test`: 24 arquivos e 111 testes aprovados.
- `npm run build`: aprovado no Next.js 16.2.12.
- `npm run test:e2e`: a primeira execução teve um timeout transitório no onboarding mobile (29/30); o caso passou isoladamente em 7,6 s e a segunda execução completa aprovou 30/30. Nenhuma falha foi associada aos fluxos alterados.
- QA no navegador integrado: Form Builder, editores rápidos, controles de design e lista com `start_activation` confirmados.
- Console do navegador: nenhum warning ou erro após a correção.
- Responsividade: Journey revalidado em viewport móvel; `scrollWidth` e `clientWidth` ficaram iguais a 375 px.
- Detector mecânico Impeccable: nenhuma ocorrência.

## Limites conhecidos e operação

- A sugestão por IA depende da mesma disponibilidade, entitlement e rate limit da regeneração de etapa. Falhas são exibidas sem alterar o formulário.
- O campo `file` só aparece quando o projeto possui Media Library no agregado; o upload público continua usando o runtime de mídia existente.
- O seletor de ativação fica vazio quando não existe ativação publicada, ativa/agendada e conectada a uma meta. Isso é intencional e o editor orienta a configuração necessária.
- Nenhuma migração de banco foi necessária.

## Arquivos centrais

- `src/components/editor/form-builder.tsx`
- `src/features/forms/form-field-utils.ts`
- `src/components/editor/experience-editor.tsx`
- `src/components/editor/block-editor.tsx`
- `src/components/presence-editor/section-editor-registry.tsx`
- `src/components/public-activations/activation-runtime-provider.tsx`
- `src/components/public-experience/public-experience.tsx`
- `src/features/presence/presence-readiness.ts`
- `src/features/publishing/project-readiness.ts`
- `src/server/publishing/publish-project.ts`
- `tests/unit/mvp-finalization.test.ts`
