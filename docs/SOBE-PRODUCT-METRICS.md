# Métricas oficiais de produto

Este documento é a definição canônica das quatro perguntas de produto. Métricas usam eventos first-party autenticados para lifecycle e eventos públicos sem PII para conversão. Sessões são deduplicadas por `visitor_sessions.id`; conversão é apenas oportunidade em estado `converted`.

## Regras comuns

- Datas usam UTC no armazenamento e a timezone selecionada somente na apresentação.
- Eventos de lifecycle idempotentes contam uma vez por entidade e marco.
- Preview, dados de demonstração e fallback local não entram em métricas de produção.
- Valor é `confirmed_value`; não existe projeção de receita.
- Histórico sem versão identificável não é atribuído retroativamente.
- Metas de sucesso não são hardcoded no produto; pertencem à camada de decisão administrativa.

## Activation

### Activation A

Proporção e tempo de `account_created` até `first_structure_generated`, por usuário/workspace. A estrutura só conta quando a geração do onboarding conclui, inclusive quando o fallback seguro foi explicitamente registrado.

### Activation B

Proporção e tempo de `first_structure_generated` até `first_project_published`, por workspace.

### Time to First Value

Mediana de `first_structure_generated.occurred_at - account_created.occurred_at` entre contas elegíveis. Excluir pares sem ambos os eventos; reportar população junto da mediana.

### Time to Publish

Mediana de `first_project_published.occurred_at - account_created.occurred_at`. Excluir workspaces ainda não publicados do cálculo de duração, mas mostrá-los no denominador de Activation B.

Fricção complementar: abandono e duração entre `onboarding_started`, `onboarding_stage_completed`, `first_structure_generated`, `publish_readiness_viewed` e `first_project_published`.

## Usage

### Activated workspace return

Workspace com projeto publicado cujo membro abriu `dashboard_viewed` ou `analytics_viewed` em uma semana ISO posterior à semana da primeira publicação. Numerador dividido pelos workspaces publicados elegíveis.

### Weekly active published workspace

Workspace com ao menos um projeto publicado e uma atividade autenticada relevante na semana: dashboard, analytics, otimização, edição ou operação comercial. Eventos públicos de visitantes não tornam o workspace ativo.

### Insight engagement

Workspaces que registraram `optimization_viewed` divididos pelos workspaces que atingiram a evidência mínima para ao menos uma sugestão, na mesma janela.

## Conversion

As métricas podem ser segmentadas por projeto, versão publicada, entrada, campanha, meta, página e destino. A versão é herdada da sessão no servidor.

### Intent rate

Sessões com `conversion_goal_selected` ou `conversion_goal_resolved` / sessões com atenção.

### Action rate

Primária: sessões com ação / sessões com intenção. Secundária: sessões com ação / sessões totais. Ações são os nomes centralizados em `src/features/optimization/config.ts`.

### Opportunity rate

Oportunidades / sessões. Uma oportunidade não é uma conversão confirmada.

### Confirmed conversion rate

Oportunidades em `converted` / sessões.

### Confirmed value per session

Soma de `confirmed_value` das conversões / sessões. Sem valor confirmado, o numerador é zero e o estado deve ser explicado na UI.

## Willingness to Pay

### Trial → Paid

Workspaces com `subscription_started` / workspaces com `trial_started`, usando coorte de início do trial.

### Value-exposed Trial → Paid

Workspaces que tiveram `first_opportunity_generated` antes do paywall e depois `subscription_started` / workspaces que tiveram oportunidade antes de `paywall_viewed` ou `trial_expired`.

### Checkout completion

Workspaces com `subscription_started` / workspaces com `checkout_started`. Deduplicar por workspace e tentativa idempotente na janela analisada.

Complementos: tempo de `paywall_viewed` a `checkout_started`, tempo de checkout a assinatura, motivo de cancelamento e quantidade de sessões/oportunidades/conversões/valor confirmado nos sete dias antes da decisão.

## Evidência de otimização

Uma sugestão exige os thresholds centralizados do produto. A avaliação `observational_before_after_v1` compara baseline e candidate version em janelas declaradas, registra suficiência, delta e possíveis fatores de confusão. A linguagem permitida é “observado”, “associado” ou “na janela”; nunca “causou”.
