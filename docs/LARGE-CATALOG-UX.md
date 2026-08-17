# UX para catálogos grandes

## Estratégia adaptativa

| Produtos ativos | Apresentação |
| ---: | --- |
| 1–8 | todos na página |
| 9–30 | destaques na home e catálogo completo |
| 31–100 | categorias na home e catálogo completo |
| 101+ | busca primeiro e página de catálogo |

Os limites ficam em `DEFAULT_CATALOG_THRESHOLDS` e podem ser configurados. A home nunca despeja dezenas de produtos.

## API pública

`GET /api/public/catalog/[projectId]` aceita `q`, `categoryId`, `cursor` e `limit`. O servidor limita a resposta a 48 itens, filtra apenas itens disponíveis do projeto publicado e não expõe metadados privados. A busca considera nome, descrição, categoria e tags; a ordenação prioriza destaque, ordem, nome e preço.

## Interface

A página oferece busca com debounce, filtros roláveis, grade responsiva, estado vazio, detalhe acessível, “carregar mais” e seleção fixa. A escolha inicia a conversão com `catalogItemId`, preservando o contexto comercial.

## Verificação

A fixture de 40 produtos cobre a transição para catálogo dedicado. A validação deve exercitar busca, categoria, paginação, detalhe, início da conversão e layouts desktop/mobile.
