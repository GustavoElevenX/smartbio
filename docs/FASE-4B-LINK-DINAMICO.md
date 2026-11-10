# Fase 4B — link dinâmico de campanha

## Estado e limite desta entrega

A Fase 4A define `ActivationDynamicSurface`, `DynamicHomeCandidate` e a seleção determinística em `src/features/activations/dynamic-home-contract.ts`. Nenhuma rota pública usa essa seleção ainda. A publicação principal continua em `Project.publication` e o snapshot publicado da Presence continua intacto.

## Diagnóstico da arquitetura atual

- `resolvePublicSurface` escolhe entrada específica primeiro, depois a publicação principal (`journey`, `goal` ou `step`), e páginas secundárias por `pageKey`. Ele não conhece campanhas.
- `resolvePublicActivations` consulta snapshots publicados, filtra por status, período e entrada e devolve placements. Um `hero_override` muda apenas o bloco da página, não a superfície principal. Hoje não há ordem determinística entre campanhas de mesma prioridade na resposta pública.
- `activation-resolver` filtra campanhas ativas por entrada e unidade, mas só ordena pela prioridade. `activation-conflicts` arbitra placements, sem decidir o link principal.
- `GET /[slug]` renderiza `PublicExperience` ou `PublicPresencePage` conforme a publicação do projeto. `GET /[slug]/p/[pageKey]` trata páginas secundárias. O runtime já carrega `activationId`, `entryPointId`, UTM e contexto de handoff; o briefing e Oportunidades usam o mesmo `CommercialHandoffContext`.
- `publishActivationSnapshot` congela os dados de campanha, e pausa/fim alteram o status operacional. O agendamento já depende do período de início e fim no request público.

## Contrato de publicação

Adicionar `dynamicSurface?: ActivationDynamicSurface` ao próximo snapshot versionado de `ConversionActivation`. O modo `exclusive` cria apenas `/{slug}/c/{activationKey}`. O modo `exclusive_and_home` também concorre pelo link `/{slug}`. A experiência é uma projeção temporária de conteúdo e meta de conversão, referenciando o mesmo projeto, seus destinos e sua jornada; não cria outro Project, Journey ou PresencePage permanente. Persistir a configuração revisada na campanha e congelá-la no snapshot publicado. `experienceKey` deve ser estável por publicação e `activationKey` único por projeto. Alterações em rascunho não mudam um snapshot já publicado.

Validar no publish: meta ativa, destino resolvível, condições e oferta coerentes, seções seguras, período válido, escopo do projeto e prontidão da campanha. Registrar a versão do contexto comercial usada na proposta para revisão, sem copiar fatos operacionais para o snapshot. IA jamais publica. Quando não houver catálogo, a ação deve ser captação/consulta/agenda suportada pela meta; não renderizar preço ou disponibilidade sem fonte confirmada.

## Resolução por request

1. `/{slug}/c/{activationKey}` busca somente o snapshot publicado dessa campanha, valida status e período e renderiza a experiência exclusiva. Quando pausada ou encerrada, exibe indisponibilidade clara com link para `/{slug}`; não reaproveita conteúdo vencido.
2. `/{slug}` sem `entry` válido consulta candidatos `exclusive_and_home`. A seleção pura usa: maior prioridade, publicação mais recente e, no empate, menor `activationId` lexical. Apenas status ativo e janela vigente participam. A página usa o snapshot vencedor; ausência de vencedor retorna imediatamente ao `resolvePublicSurface` atual. Não há gravação nem rollback de `Project.publication`.
3. Uma `?entry=` válida mantém sua precedência atual, inclusive `conversion_direct`. `/{slug}/p/{pageKey}` nunca sofre takeover. Links de entrada e páginas secundárias continuam estáveis.
4. Selecionar campanha e renderizar metadados OG/canonical a partir da mesma decisão por request. O canonical da página exclusiva é `/{slug}/c/{activationKey}`; a home conserva `/{slug}`. Evitar cache compartilhado além do início/fim/pausa; invalidar ao publicar, pausar, retomar ou encerrar, e assegurar verificação temporal mesmo sem invalidação.

## Atribuição e contexto

O renderer deve iniciar a jornada existente com `activationId`, `conversionGoalId`, `entryPointId` quando existir e o `campaign` derivado de `activationKey` somente quando não houver UTM explícito. UTM explícito continua prevalecendo sobre defaults de entrada e campanha. Propagar os mesmos campos para analytics, `CommercialHandoffContext.origin`, mensagem de WhatsApp, briefing e Oportunidades. A campanha e a versão publicada devem ser identificáveis sem transformar inferência em fato confirmado.

## Sequência de implementação da 4B

1. Versionar o schema do snapshot e criar migração aditiva para a configuração revisada; manter leitura dos snapshots v1.
2. Adicionar renderer de superfície promocional reutilizando blocos, CTA, jornada e handoff existentes.
3. Adicionar rota exclusiva e integrar o seletor à rota principal e aos metadados, preservando a precedência de entradas e páginas secundárias.
4. Conectar publicação, pausa, retomada e fim à invalidação e validar janela temporal na leitura.
5. Testar empates, publicação simultânea, pausa/fim, expiração, entrada específica, página secundária, UTM, briefing e acesso móvel/desktop. Executar integração real com Supabase e provedor de IA antes de considerar a fase validada em produção.
