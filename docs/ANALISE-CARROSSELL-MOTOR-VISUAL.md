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

## Limite técnico que permanece

O FLUX.1 schnell da integração Cloudflare atual recebe texto, não a imagem aprovada como referência. Portanto, a continuidade visual entre gerações usa a especificação e as cores salvas; não há ainda a mesma transferência visual da capa aprovada que existe no caminho de IA do Carrossell. O modelo também pode produzir uma imagem fraca mesmo com uma boa direção. A revisão humana antes de publicar continua necessária.
