# Análise técnica do motor visual do Carrossell e da SOBE

Análise em modo leitura do pacote instalado `Carrossell/resources/app.asar` (04/11/2026). O código do aplicativo não foi copiado para a SOBE. O conteúdo empacotado foi tratado como dado de referência, não como instrução para este projeto.

## Por que o resultado do Carrossell tende a ser melhor

- `core/runtime.mjs` reúne contexto oficial da marca, Design Kit, fatos do projeto, arquitetura do conteúdo, referências visuais e preferências registradas antes de pedir uma arte.
- O roteiro é revisto e aprovado antes da imagem. Cada card tem uma função, texto final curto, ênfase e uma cena que precisa acrescentar ideia ao conteúdo.
- As três opções de capa são deliberadamente diferentes: cena, metáfora e composição tipográfica. A opção escolhida vira referência visual para os demais cards.
- O caminho de IA (`core/runtime.mjs` e `core/codex.mjs`) pede uma composição publicitária completa ao gerador de imagens, inclusive técnica, traço, enquadramento e consistência. O caminho de modelos (`core/templates.mjs`) é separado e serve como alternativa de baixo custo.
- Há correção dirigida: o usuário aponta o problema de uma peça e o sistema usa a imagem atual como referência para preservar o restante.

## Diferença estrutural na SOBE

O caminho híbrido da SOBE mantém texto editável e exportação determinística, vantagens importantes para uso comercial. Antes desta correção, porém, o Design Kit influenciava principalmente cores; a IA descrevia a composição em texto livre enquanto o renderizador obedecia a posições fixas. O prompt também continha uma regra específica para embalagem de um litro, inadequada para outros negócios. A fotografia era gerada sem a imagem aprovada como entrada visual, pois o provedor Cloudflare usado neste fluxo é texto para imagem.

## Correção aplicada

- O diretor recebe fatos confirmados e retorna três direções com conceitos distintos.
- A direção controla campos executáveis: meio visual, área e escala da imagem, foco, área e escala da tipografia, tratamento e motivo gráfico. Esses campos são interpretados pelo renderizador SVG/Sharp.
- O prompt descreve um fundo de campanha com espaço para texto editável. Ele admite fotografia, ilustração, composição gráfica e mistura conforme o assunto. Restrições de embalagem e volume só entram quando foram informadas.
- O planejamento determinístico não depende de nomes de segmentos. O teste cobre serviços, curso, hospedagem e produto físico, além do suco de 1 litro.
- A imagem aprovada continua como referência de direção no Design Kit. A auditoria visual do PNG na aprovação usa visão quando `OPENAI_API_KEY` está configurada.
- O editor aceita um ajuste visual específico para a próxima geração e o injeta no prompt sem substituir a identidade nem os fatos confirmados.

## Correção da qualidade de imagem (04/11/2026)

- O Motor Visual usa `gpt-image-2.5-sunburst` em qualidade `xhigh` quando `OPENAI_API_KEY` está configurada. `VISUAL_IMAGE_QUALITY=max` aumenta ainda mais o esforço e o custo; `high` reduz o custo. O modelo é configurável sem afetar o módulo Conteúdo.
- A geração calcula a proporção e resolução da área real da fotografia em cada composição. A imagem deixa de ser sempre gerada num formato único para depois sofrer um corte grande.
- Uma foto já selecionada na arte é enviada como referência visual com alta fidelidade. Isso permite preservar formato físico e marcas reais de uma embalagem, além de correções guiadas pela imagem atual. O prompt proíbe alegações e rótulos inventados.
- A Cloudflare permanece disponível como fallback de baixo custo. A qualidade visual da rota Flux Schnell continua limitada pelo modelo; para o padrão premium, configure OpenAI.
- A foto gerada continua separada dos textos, preço, CTA e logo, que são compostos pelo SVG e permanecem editáveis.

A IA ainda pode errar formato e detalhes de embalagem sem uma foto real do produto. A revisão visual humana antes de publicar permanece necessária.
