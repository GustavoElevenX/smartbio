# Sobe — relatório de implementação do construtor adaptativo

1. **Identidade:** símbolo fornecido copiado para `public/brand/sobe-symbol.png` e aplicado ao componente `Brand` e ao cabeçalho do editor.
2. **Landing institucional:** `src/app/page.tsx` não foi alterado; não houve rebrand destrutivo.
3. **Editor:** três áreas funcionais — páginas/seções, preview e propriedades.
4. **Propriedades:** abas Conteúdo, Visual, Conversão e Dados; presets controlados, sem CSS arbitrário.
5. **Operação de seções:** adicionar, remover, duplicar, arrastar, mover por botões e `Alt+Seta`; desfazer/refazer preservados.
6. **Páginas:** página vazia, simples, landing, duplicação, exclusão protegida, propósito e objetivo principal.
7. **Motor adaptativo:** `BusinessShape`, densidade, catálogo, conversão, visual, recomendações e qualidade separados em módulos.
8. **Verticais:** invariantes testadas para produto, serviço, misto, hotelaria, profissional, B2B, local e desconhecido.
9. **Sobe IA:** proposta com justificativa, páginas, seções, alertas e operações; nenhuma aplicação automática.
10. **Versionamento:** proposta persiste `expectedVersion`; aplicação desatualizada retorna `409`.
11. **Persistência:** migration `202608130040_adaptive_site_composer.sql`, RLS por workspace e status da proposta.
12. **Entitlements:** `presence_sections_per_page`, `catalog_large`, `ai_structure_suggestions` e `ai_page_edits` registrados e validados no servidor.
13. **Catálogo:** busca, categorias, cursor, limite máximo, ordenação e projeção pública sem metadados privados.
14. **Escala:** fixture com 40 produtos; home limitada a destaques e link para catálogo dedicado.
15. **Conversão de produto:** seleção abre a jornada com `catalogItemId`, página e seção de origem.
16. **Handoff comercial:** contrato B2B/B2C, mensagem “Contexto recebido pela Sobe”, URL codificada e seleção explícita de respostas.
17. **Privacidade:** evidência de desempenho agregada exclui nome, telefone, e-mail e respostas brutas.
18. **Otimização:** 30 dias completos, 30 sessões do projeto e 15 da meta; estado de aprendizado mostra progresso.
19. **Runtime:** geolocalização só é anunciada quando existem coordenadas confirmadas.
20. **Responsividade e acessibilidade:** preview desktop/tablet/mobile, shell móvel, nomes acessíveis, tabs semânticas, modal e navegação por teclado.
21. **Verificação:** TypeScript, ESLint, 102 testes unitários, 4 cenários E2E desktop/mobile e build Next.js 16 concluídos; evidências em `docs/qa/`.

## Limitações conhecidas

- A aplicação de migration depende do pipeline Supabase do ambiente de destino; ela foi gerada e validada estaticamente, não executada contra produção.
- O modo local usa os projetos de demonstração do servidor para sugestões; persistência transacional completa e auditoria são exercidas no modo Supabase.
- O sticky de seleção do catálogo abre a conversão por item; carrinho comercial completo continua pertencendo à jornada nativa existente.

## Evidências visuais

- `docs/qa/site-composer-desktop.png`: proposta da Sobe IA antes da confirmação.
- `docs/qa/site-composer-mobile-preview.png`: editor com preview móvel selecionado.
