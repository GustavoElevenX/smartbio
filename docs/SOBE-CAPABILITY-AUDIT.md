# Sobe — Capability Audit

**Data:** 2026-08-16  
**Escopo:** produto usado pelos clientes (não inclui a landing institucional em `src/app/page.tsx`).  
**Regra de evidência:** um item só é verde quando foi executado ponta a ponta no ambiente disponível. Código, schema ou tela sem execução recebem amarelo, laranja ou vermelho.

## Executive summary

A base tem uma arquitetura comercial surpreendentemente ampla: Presence multipágina, jornadas, metas de conversão, entrada/UTM, catálogo, pedidos, agenda, reservas, roteamento, oportunidades, ativações, benefícios, planos e administração têm modelos, rotas e migrações. A qualidade do baseline também é boa: lint, tipos, build e 105 testes passaram.

O que é demonstrável hoje, porém, é principalmente o **laboratório local em `localStorage`**. Ele entrega bem a narrativa de uma jornada B2C/B2B e a UI pública. Não prova persistência nem isolamento no Supabase, porque `ENABLE_LOCAL_DEV_AUTH=true` e `NEXT_PUBLIC_ENABLE_LOCAL_DEV_STORE=true` estão ativos. Não foi usado banco remoto: não há confirmação de que seja um banco de testes, e a auditoria não grava em produção.

O principal risco é confundir os bons demos com operação. A Casa de Sucos demonstrável possui três produtos e uma unidade apresentada estaticamente; ela não prova 30+ produtos, quatro unidades reais, geolocalização Turu, horário, raio, elegibilidade de delivery, WhatsApp final ou oportunidade persistida. O benefício é visualmente exercitável, mas o E2E intercepta `claim` e `handoff`, portanto não prova a cadeia de dados remota.

## Score (0–10)

| Área | Nota | Motivo resumido |
|---|---:|---|
| Arquitetura | 8 | Domínio, RLS/migrações e APIs cobrem muitos casos. |
| Produto | 5 | Demos funcionam; operação persistida ainda não foi provada. |
| Criação de páginas | 6 | Pages, editor e composição existem; não houve avaliação com dados reais variados. |
| IA | 5 | Gera/edita e extrai fontes; falta copilot baseado em evidência histórica. |
| B2C | 6 | Pedido local completo passou; integração operacional não demonstrada. |
| B2B | 6 | Qualificação local passou; handoff real não demonstrado. |
| Geo Routing | 3 | Motor de regras existe; demo de unidade é estático e não prova geo. |
| Activations | 4 | CRUD/claim/handoff existem; E2E mocka a parte crítica. |
| Human Handoff | 5 | Mensagem contextual e API existem; entrega real ao time não testada. |
| Opportunities | 6 | Modelo/API/analytics existem; persistência não exercitada. |
| Analytics | 6 | Eventos, funil e atribuição existem; eventos locais falharam em chamadas observadas antes do reinício. |
| Admin | 3 | Arquitetura existe; sem admin de teste não há demo navegável. |
| Entitlements | 5 | Checagens server-side e schema existem; matriz de ataques não foi executada. |
| Segurança | 5 | RLS, assinatura de mídia e validações existem; vulnerabilidade alta de dependência e fluxos remotos não auditados. |
| Testes | 7 | 81 unitários + 24 E2E passam; faltam E2E remoto, admin, plano, geo real e carga de catálogo. |

## Estado inicial e método

### Comandos executados

| Comando | Resultado |
|---|---|
| `npm ci` | Passou após encerrar o dev server que bloqueava `lightningcss.win32-x64-msvc.node`. Reportou 1 vulnerabilidade alta e um postinstall pendente (`unrs-resolver`). |
| `npm run lint` | Passou, 0 warnings (configurado com `--max-warnings=0`). |
| `npm run typecheck` | Passou. |
| `npm run test` | 19 arquivos, 81 testes passaram. |
| `npm run build` | Passou; 59 páginas estáticas geradas. |
| `npm run test:e2e` | 24/24 passaram, desktop e Pixel 7. |
| Browser em `http://127.0.0.1:3000` | Casa de Sucos: entrada de delivery → unidade → catálogo → dois itens no carrinho → `Pedido enviado com sucesso.`; console sem erros/warnings relevantes. |
| Browser em `/admin` | 404 no modo local; não existe demo navegável de admin sem sessão de platform admin. |

O E2E usa explicitamente ambiente local (`playwright.config.ts`), dados de demonstração e, no cenário de ativação, intercepta as respostas de `/claim` e `/handoff`. Ele é evidência válida de interface/contrato, não de integração remota.

### Ambiente e limitações de segurança

- O Supabase configurado tem os buckets `business-sources`, `media-private`, `media-public` e `commercial-media`, e as tabelas consultadas existem. Somente leitura foi realizada.
- Não foi criado o laboratório remoto “Casa de Sucos Mix” porque não foi fornecido um projeto Supabase de teste. Criar quatro unidades, pedidos, claims e leads em um banco possivelmente produtivo violaria o escopo.
- O laboratório existente é claramente demonstrativo em `src/data/demo-projects.ts`: Casa de Sucos, Vértice, clínica, chalé e outros. Ele não contém Cohama, Vinhais, Cohatrac e Golden Shopping como quatro unidades de teste completas.

## Matriz principal

| Capacidade | Status | Demonstração disponível? | E2E real? | Produção? | Principal gap |
|---|---|---:|---:|---:|---|
| Presence / página pública | ✅ | Sim | Sim | 🟡 | Dados remotos e variação premium não provados. |
| Jornada direta por Entry Point | ✅ | Sim | Sim | 🟡 | Persistência de analytics remota não provada. |
| UTM / attribution local | ✅ | Sim | Sim | 🟡 | Eventos no Supabase não exercitados. |
| Catálogo e carrinho | 🟡 | Sim (3 itens) | Sim | 🟡 | Sem teste de 30+; sem busca/filtro/paginação pública. |
| Pedido B2C | 🟡 | Sim | Sim, local | 🟡 | WhatsApp/opportunity/database reais não provados. |
| Qualificação B2B | 🟡 | Sim | Sim, local | 🟡 | Roteamento por vendedor e contexto entregue não provados. |
| Orçamento | ✅ | Sim | Sim, local | 🟡 | Anexos e persistência remota não testados. |
| Agenda | 🟡 | Sim | Sim, local | 🟡 | Agenda externa/ocupação real não testada. |
| Reserva | 🟡 | Sim | Sim, local | 🟡 | Inventário real e concorrência não testados. |
| Roteamento por regra | 🟡 | Não como geo | API/modelo | 🟡 | Motor não calcula distância/horário/raio por si. |
| Geolocalização multiunidade | 🟠 | Fallback CEP manual | Sim (E2E) | ❌ | Turu e critérios A–E não demonstrados. |
| Ativações e benefício | 🟡 | Sim | UI sim; APIs mockadas | 🟡 | Claim/handoff/redemption reais ausentes. |
| Ativações sem desconto | 🟠 | Parcial | Não | ❌ | Tipos existem, execução específica não provada. |
| IA de onboarding/composição | 🟡 | Sim | Onboarding local | 🟡 | Qualidade por oito verticais e persistência não avaliadas. |
| IA comercial / otimização | 🟠 | Não como copilot | Regras unitárias | ❌ | Só limiar de sessões; sem janela de 30 dias. |
| Upload de mídia/fontes | 🟠 | UI existe | Não | 🟡 | No modo local é recusado; requer login/Supabase persistente. |
| Analytics / opportunities | 🟡 | Dashboard local | Eventos/testes | 🟡 | Confiabilidade histórica remota não provada. |
| Admin | 🟠 | Não | Não | ❌ | Exige admin real; `/admin` local devolveu 404. |
| Support session | 🟠 | Não | Não | ❌ | Não foi possível criar/administar sessão de teste. |
| Entitlements | 🟠 | Não | Unitários | 🟡 | Não executados Free/Pro/override/expiry/API attack. |
| Billing real | ⏸️ | Não | Não | Pendente | Decisão externa de gateway, conforme escopo. |

Legenda: ✅ funciona ponta a ponta no ambiente auditado; 🟡 parcial; 🟠 arquitetura/UI sem fechamento demonstrado; ❌ não atende/indisponível; ⏸️ fora do escopo por decisão externa.

## Cenários exercitados

### Demo 1 — B2C, Casa de Sucos Mix

- **URL:** `/casadesucosmix?entry=story-delivery&utm_source=instagram&utm_campaign=audit`
- **Login:** não, modo demo.
- **Passos executados:** Delivery → card “Golden Shopping” → Ver produtos → Suco natural + Salada de frutas → Entrega → Enviar pedido.
- **Resultado:** total de R$ 28,00 e mensagem `Pedido enviado com sucesso.` no navegador; E2E equivalente passa em desktop e mobile.
- **Arquivos/rotas:** `src/components/public-experience/public-experience.tsx`, `src/components/public-experience/blocks/block-renderers.tsx`, `/api/public/orders`, `/api/public/catalog/[projectId]`.
- **Dados:** `catalog_items`, `catalog_categories`, `catalog_orders`, `commercial_opportunities`, `analytics_events` quando persistente.
- **Classificação:** 🟡. O demo confirma UI e estado local. Não abriu WhatsApp nem comprovou pedido/opportunity no banco.

### Demo 2 — Geo, Turu → unidade adequada

- **Resultado obtido:** não existe demonstração executada de Turu. Ao escolher Delivery, a UI exibiu Golden Shopping/“12 min”, que vem do conteúdo estático do step `mix-unit` em `src/data/demo-projects.ts`.
- **Arquivos/rotas:** `src/components/public-experience/location-finder.tsx`, `src/features/routing/routing-engine.ts`, `/api/public/routing/resolve`, `/api/public/routing/nearest`.
- **Dados:** `business_locations`, `routing_destinations`, `routing_rules`.
- **Blocker/severidade:** P0. `resolveRoute` seleciona a primeira regra com condição e fallback; não contém cálculo de distância, horário, raio nem modalidade. Sem fixture com coordenadas e sem banco de teste, os casos A–E não podem ser declarados funcionais.
- **O que falta:** fixture isolada das quatro unidades, geocoder/coordinates para Turu, teste com geolocation permitida/negada, horário fechado, modalidade delivery e fora de raio.

### Demo 3 — Campanha / landing

- **Evidência:** Presence suporta `home`, `landing` e `page`; Entry Point pode apontar `presence_page_id` e goal, e `resolve-public-surface.ts` resolve essa superfície. UTM/entry foram confirmados em E2E.
- **Não executado:** uma landing independente criada e publicada em banco de teste com opportunity e analytics remotos.
- **Classificação:** 🟡; arquitetura fecha, fluxo operacional não foi provado.

### Demo 4 — Benefício de 20% na primeira compra

- **Evidência:** E2E cria e publica ativação local, mas substitui as respostas públicas de claim e handoff. O fluxo mostra código e prepara a mensagem/contexto.
- **Arquivos/rotas:** `tests/e2e/activations.spec.ts`, `/api/projects/[projectId]/activations/*`, `/api/public/activations/[activationId]/claim`, `/handoff`, `/api/redeem/*`.
- **Dados:** `conversion_activations`, `benefit_claims`, `benefit_redemptions`, `redemption_validators`, `commercial_opportunities`.
- **Classificação:** 🟡 (UI/contrato), não ✅. Elegibilidade repetida, continuação sem benefício, validator, redemption e conversão real não foram executados contra banco.

### Demo 5 — B2B → vendedor

- **URL:** `/vertice?utm_source=instagram&utm_campaign=e2e`
- **Evidência:** E2E preenche negócio, investimento, objetivo e canal; a recomendação aparece. Há `leads` e opportunities no modelo/local store.
- **Limitação:** nenhum vendedor/time distinto foi configurado em fixture e não há prova de que um WhatsApp recebeu o resumo. A resposta para “quais dados chegam?” é: os campos respondidos podem ficar em `answers`/metadata, mais origem, campanha, goal e destination; a entrega real não foi comprovada.
- **Classificação:** 🟡; blocker P1 para venda assistida.

### Demo 6 — catálogo grande

- **Resultado:** não demonstrável. A fixture Casa de Sucos tem 3 itens e 1 categoria.
- **Evidência estática:** schema aceita até 10.000 itens e 1.000 categorias (`commercial-data.schema.ts`), mas o renderer lista todos os itens ativos; não há busca, filtro de categoria ou paginação pública identificados.
- **Classificação:** 🟠. Não há motivo para assumir que 30+ itens tenham UX aceitável.

### Demo 7 — Admin

- **URL:** `/admin`; **resultado:** 404 no ambiente local.
- **Arquivos:** `src/app/admin/*`, `src/app/admin/layout.tsx`, `src/server/platform-admin/require-platform-admin.ts`.
- **Dados:** `platform_admins`, `platform_support_sessions`, `platform_support_grants`, `platform_admin_audit_log`, planos/workspaces/projetos.
- **Classificação:** 🟠. Rotas e guard existem, mas não há usuário platform admin de teste nem cenário exercitado.

### Demo 8 — Support

- **Resultado:** não existe demo navegável ainda, pois requer platform admin e workspace/usuário de teste.
- **Blocker:** P1. Não se pode afirmar isolamento project-scoped, motivo obrigatório, audit do admin real ou revogação da sessão sem teste remoto.

## Auditoria funcional por domínio

### Presence builder e qualidade visual

**Criação e dados.** O onboarding adaptativo cria rascunho sem login no local; o E2E chega ao editor. Há editor, páginas (`home`, `landing`, `page`), sections e ligação de CTA para conversion goal. Persistência usa RPC versionada (`save_presence_page`) quando há actor de banco.

**Avaliação visual executada.** A Casa de Sucos carregou sem overlay/erros de console; desktop é legível, com hero tipográfico, cards e boa hierarquia básica. O E2E cobre navegação desktop/mobile da Presence. Não foi feito redesign.

| Item | Achado |
|---|---|
| Visual público | 6/10 — limpo e coerente no demo; ainda exibe “Feito com Virou”. |
| Editor | 6/10 — cobertura de fluxo até editor, sem sessão real/conflito de versão. |
| Criação com IA | 5/10 — gera rascunho; não comparada por oito tipos de negócio. |
| Personalização | 5/10 — dados/sections existem, prova de variação visual ampla insuficiente. |

#### Por que as páginas ainda não parecem premium

- **Componentes:** o demo de conversão privilegia uma sequência única de cards/steps. A própria Casa mostra uma unidade como conteúdo, não como componente conectado a operações.
- **Design system:** paletas e variantes existem, mas a auditoria só confirmou uma superfície pública; não há evidência visual de variação suficiente entre oito verticais.
- **IA:** o composer recebe dados comerciais e `requestedSurface`, mas não foi medido se evita a mesma estrutura para negócios muito diferentes.
- **Editor:** a maturidade de dados supera a demonstração UX; editar/publish remoto e media replacement não foram executados.
- **Mídia:** storage e otimização existem, mas upload real é bloqueado no modo memory e não foi testado em Supabase de teste.
- **Mobile:** a navegação Presence foi testada; páginas grandes/catálogo grande não.

### B2C, pedidos, agenda e reservas

| Fluxo | Evidência | Estado e lacuna |
|---|---|---|
| Pedido com múltiplos itens | Browser + E2E | 🟡 Carrinho e total locais funcionam; preço server-side/persistência não provados. |
| Categorias | Modelo + renderer | 🟡 Modeladas; não há teste visual de várias categorias. |
| Orçamento | E2E | 🟡 Solicitação local funciona; anexos privados não testados. |
| Agenda | E2E | 🟡 Consulta slot e confirma localmente; não há agenda externa/concorrência. |
| Reserva | E2E | 🟡 Consulta e envia localmente; disponibilidade real não provada. |
| “Preencher agenda amanhã” | Modelos de activation + scheduling | 🟠 Não há evidência de activation lendo disponibilidade, ocultando slots acabados e encerrando oferta. |

### Geo routing

O projeto possui `business_locations` com campos de geo e API pública de roteamento. Contudo, o motor atual avalia condições e prioridade; não calcula proximidade. A `location-finder` oferece consentimento/fallback manual, coberto por E2E para CEP, mas isso não valida distância. Todos os cinco casos solicitados (geolocation, negação, fechado, sem delivery, fora do raio) permanecem **não demonstrados**.

### Ativações, benefícios e handoff humano

Os tipos, placement conflicts, claims, validators, redeem e APIs existem. A mensagem de WhatsApp pode incorporar interesse, unidade, benefício/código e itens (cobertura unitária). Isso é infraestrutura melhor do que a interface deixa parecer.

Ainda assim:

- `20% OFF`: UI passa, cadeia real é 🟡 porque o E2E mocka claim/handoff.
- tentativa repetida / “continuar sem benefício”: 🟠, não exercitada;
- destaque, lançamento, captação, promoção de unidade, espera e preencher agenda: 🟠, existem como modelagem/activation types, sem cenário de execução por tipo;
- delivery ao atendente: 🟡; contexto é modelável, mas destinatário e recepção real não provados.

### IA — de gerador para copiloto

**Hoje.** Há análise de negócio, fontes (PDF/CSV/texto/imagem), extração de fatos, brand analysis, jornada, Presence/landing, activation, visual direction e melhorias pontuais de section/copy. `OPENAI_API_KEY` está configurada; upload de fontes exige actor persistente. A composição recebe catálogo, serviços, unidades e mídia.

**Próxima fase.** Agregar analytics/opportunities por janela, aplicar regra determinística, mostrar evidência e pedir aprovação humana antes de criar uma alteração/activation.

**Futuro.** Um copilot “o que quer melhorar?” deve analisar dados agregados da conta/projeto e produzir ação revisável. Evitar telefone, e-mail e respostas individuais quando não forem necessários; os repositórios de analytics já podem buscar eventos e opportunities agregáveis, mas não há camada de minimização/briefing de IA auditada.

#### Regra de 30 dias — não atende à nova regra

`features/optimization/evidence.ts` libera evidência com `totalSessions >= 30` e, quando aplicável, `goalSessions >= 15`. Não verifica data de publicação nem 30 dias completos. As sugestões como `goal_dropoff` podem aparecer com sessões suficientes em período curto.

Implementação recomendada, sem implementá-la nesta auditoria:

```text
Observation Window (published_at até hoje, >= 30 dias completos)
  + Evidence Threshold (sessions / goal sessions / conversões mínimos)
  + Deterministic Analysis (dados agregados)
  + AI Explanation (somente interpreta a evidência)
  + Suggested Action (rascunho)
  + Human Approval (salvar/publicar)
```

O ponto de mudança é `features/optimization/evidence.ts` e os callers em `engine.ts`/regras; incluir `publishedAt`, intervalo do filtro e mensagens “A Sobe ainda está aprendendo com seu negócio.” antes do limiar.

### Matriz de dados para inteligência comercial

| Dado | Existe? | Confiável nesta auditoria? | Histórico? | Pode alimentar IA? |
|---|---|---|---|---|
| Visitas, CTA, etapas/dropoff | Sim (`analytics_events`) | 🟡 local/E2E | Sim no schema | Sim, agregado |
| Origem, UTM, Entry Point | Sim | ✅ local | Sim | Sim |
| Página/section/goal/destination | Sim | 🟡 | Sim | Sim |
| Produtos, pedidos, reservas, agenda | Sim | 🟡 | Sim | Sim, agregado |
| Opportunities, conversão, valor | Sim | 🟡 | Sim | Sim, agregado |
| Activation, claim, redemption | Sim | 🟠 | Sim | Sim, agregado |
| Unidade, horário, routing | Sim | 🟠 | Sim | Sim após geo real |
| Telefone/e-mail/respostas pessoais | Sim | Não necessário | Sim | Não enviar por padrão |

### Admin, suporte e entitlements

O schema e as rotas oferecem planos, overrides, platform admins, grants, sessões e auditoria. Não houve conta admin de teste; por isso não foi possível validar métricas, busca, suporte, isolamento entre projeto A/B, expiração, downgrade ou ataques diretos de API. Classificação operacional: 🟠. Billing real é **PENDENTE POR DECISÃO EXTERNA**, não bug.

## Funcionalidades que parecem prontas, mas não estão

1. Geo da Casa de Sucos: o card Golden Shopping aparenta recomendação calculada, mas é conteúdo estático do demo.
2. Benefício 20%: o E2E prova UI e contratos, mas mocka claim/handoff e não prova elegibilidade/redemption reais.
3. “Pedido enviado”: prova um fluxo local, não criação remota de pedido/opportunity nem WhatsApp correto.
4. Multiunidade: há fallback CEP e entidades, não os cinco critérios de roteamento exigidos.
5. Otimização comercial: 30 sessões não é 30 dias observados.
6. Admin/support: páginas compilam, mas sem role de teste não são demonstráveis.
7. Upload: buckets existem, mas o modo demo recusa persistência de arquivo.

## Funcionalidades que já funcionam melhor do que a interface deixa parecer

1. O modelo de composição já aceita catálogo, serviços, unidades, mídia, policies e facts verificados.
2. Presence suporta home/landing/página, Entry Point e CTA ligado a goal, com save versionado no caminho persistente.
3. Há armazenamento privado, URLs assinadas e validação de tipo/tamanho para mídia/fontes.
4. Há modelos para oportunidade, atribuição, activation claims/redemptions e auditoria de admin.
5. Há limites server-side de entitlement e endpoints dedicados; não é somente uma tela de pricing.

## Pressupostos que limitam a adaptação da Sobe

- O demo principal presume três produtos, uma categoria e uma unidade; catalog scale não foi validado.
- O renderer público atual não oferece descoberta de catálogo grande (busca/filtros/paginação).
- A jornada do demo sugere uma rota/unidade antes de um cálculo operacional real.
- O handoff do demo fixa um número de WhatsApp; times/vendedores múltiplos não foram demonstrados.
- A otimização trata volume de sessões, sem maturidade temporal de negócio.
- Local dev mistura UX de demo e APIs: ótimo para explorar, insuficiente para validar banco, RLS e operação.

## Referências legadas user-facing

“Virou” ainda aparece no título público (`Casa de Sucos Mix · Virou`), no footer (“Feito com Virou”), no conteúdo de demos, em mensagens/claims e no nome do pacote/repositório `linkbio`/`smartbio`. Não foi feito rebranding, conforme escopo.

## P0–P3

### P0 — impede uso real demonstrável

1. Criar ambiente Supabase de **teste** e fixture isolada de Casa de Sucos Mix com quatro unidades, coordenadas, horários, modalidades, prioridades e destinos.
2. Implementar/provar o cálculo de geo: distância, aberto/fechado, delivery, raio, prioridade e fallback; hoje o motor não o contém.
3. Validar pedido, opportunity, evento e handoff contra banco de teste; não aceitar `Pedido enviado` local como prova operacional.

### P1 — prejudica conversão/segurança

1. Testar claim, não elegibilidade, continuação sem benefício, validator/redemption e audit real.
2. Criar plataforma-admin de teste e cobrir suporte, isolamento project-scoped e entitlements por API.
3. Resolver/triangular a vulnerabilidade alta informada por `npm ci`; revisar postinstall pendente antes de produção.
4. Definir suporte a catálogo grande: busca, categorias, paginação/virtualização e regras de destaques.

### P2 — UX/IA importante

1. Adicionar janela de observação de 30 dias às sugestões, com texto de aprendizagem e evidência agregada.
2. Avaliar IA/Preset visual em oito verticais com rubrica e screenshots comparáveis.
3. Dar mais transparência de routing e de contexto que chega ao atendente.

### P3 — posterior

1. Rebranding controlado de Virou/SmartBio para Sobe.
2. Billing após decisão do gateway.

## O que Gustavo consegue demonstrar hoje no navegador

| Demo | URL | Resultado honesto |
|---|---|---|
| B2C / carrinho | `/casadesucosmix` | Selecionar itens, quantidade, fulfillment e confirmação local. |
| Entrada/UTM | `/casadesucosmix?entry=story-delivery&utm_source=instagram&utm_campaign=demo` | Entrada abre a jornada direta; dados ficam no demo/localStorage. |
| B2B | `/vertice` | Formulário de qualificação e recomendação local. |
| Orçamento | `/limpabem` | Solicitação local com quantidade/contexto. |
| Agenda | `/clinica-aurora` | Consulta e confirmação local de slot. |
| Reserva | `/chales-serra-clara` | Consulta e solicitação local. |
| Presence | `/virou-presenca-demo` | Conteúdo server-first, SEO e modal de jornada. |
| Activation | `/virou-activation-demo` | Interface de claim/handoff; não apresentar como redemption operacional. |
| Admin/support | — | Não existe demo navegável ainda: requer conta platform admin em banco de teste. |

## Conclusão

Se um cliente sentar hoje ao navegador, a Sobe pode mostrar uma proposta de produto convincente: páginas públicas, entrada atribuída, jornadas, carrinho/pedido local, qualificação, orçamento, agenda, reserva e UI de activation. A demonstração quebra no momento em que a conversa exige prova operacional persistente: geo multiunidade real, pedido/WhatsApp/opportunity no banco, claim/redemption real, upload persistente, admin/support e limites de plano.

O próximo passo recomendado não é adicionar mais superfícies: é criar um ambiente de teste isolado e converter os cenários prioritários acima em testes E2E remotos sem mocks nas bordas críticas.

