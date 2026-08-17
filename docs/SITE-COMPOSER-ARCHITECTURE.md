# Sobe — arquitetura do construtor adaptativo

## Princípios

O construtor não escolhe um template por nicho. Ele infere a forma operacional do negócio a partir de produtos, serviços, unidades, capacidades e objetivos; depois aplica regras determinísticas antes de pedir qualquer complemento à IA. Toda sugestão vira uma proposta versionada. O usuário escolhe as operações, aplica somente ao rascunho e publica em uma ação separada.

## Fluxo

1. `inferBusinessShape` resume o negócio sem PII.
2. Estratégias de catálogo, conteúdo, conversão e visual produzem uma estrutura inicial previsível.
3. `createSiteStructureProposal` converte a sugestão em operações estruturadas.
4. `POST /api/ai/projects/[projectId]/site/suggest-structure` registra a proposta e sua versão esperada.
5. O editor apresenta justificativa, páginas, seções, alertas e prévia; nada é aplicado automaticamente.
6. `POST /api/projects/[projectId]/site/apply-proposal` valida entitlement, projeto, proposta, operações selecionadas e versão. Conflitos retornam `409`.

Operações aceitas: adicionar, remover, mover ou atualizar seção; adicionar ou renomear página; conectar objetivo. HTML, JavaScript e CSS arbitrários não fazem parte do contrato.

## Editor

O editor tem navegação de páginas e seções à esquerda, preview responsivo ao centro e propriedades à direita. As propriedades são separadas em Conteúdo, Visual, Conversão e Dados. Arrastar é complementado por `Alt+Seta para cima/baixo`, e desfazer/refazer continua disponível.

## Capacidades e planos

`runtime-capabilities.ts` impede promessas incompatíveis com o runtime, especialmente geolocalização sem coordenadas confirmadas. Os limites comerciais usam entitlements (`presence_sections_per_page`, `catalog_large`, `ai_structure_suggestions`, `ai_page_edits`) e nunca preço fixo no código.

## Consistência e segurança

Propostas são isoladas por workspace e projeto, usam RLS e carregam `expectedVersion`. Aplicações atualizam apenas páginas do rascunho por meio do serviço transacional existente. Publicação permanece uma etapa explícita e auditável.
