---
name: SOBE
description: Arquitetura da Atenção — da atração difusa à ação comercial clara.
colors:
  mineral-night: "#07172f"
  raised-mineral: "#0b2446"
  cloud-white: "#f7f8fa"
  stage-silver: "#dfe5eb"
  storm-slate: "#344150"
  brand-blue: "#0054fc"
  active-blue: "#0186fc"
  brand-on-primary: "#ffffff"
  route-cyan: "#01d2df"
  finish-turquoise: "#02e5cd"
  light-ink: "#101722"
  light-copy: "#526171"
  dark-copy: "#aab7c6"
  mineral-muted: "#8fa1b8"
  technical-line: "rgba(182, 203, 224, 0.22)"
  rail-line: "#cbd3dc"
typography:
  display:
    fontFamily: "var(--font-inter), Arial, sans-serif"
    fontSize: "clamp(68px, 7.2vw, 112px)"
    fontWeight: 690
    lineHeight: 0.9
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "var(--font-inter), Arial, sans-serif"
    fontSize: "clamp(48px, 5.3vw, 78px)"
    fontWeight: 690
    lineHeight: 0.96
    letterSpacing: "-0.04em"
  title:
    fontFamily: "var(--font-inter), Arial, sans-serif"
    fontSize: "clamp(24px, 2vw, 31px)"
    fontWeight: 680
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  lead:
    fontFamily: "var(--font-inter), Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.62
  body:
    fontFamily: "var(--font-inter), Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "var(--font-inter), Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 760
    lineHeight: 1.35
    letterSpacing: "0.1em"
  button:
    fontFamily: "var(--font-inter), Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 780
rounded:
  none: "0"
  circle: "999px"
spacing:
  mobile-gutter: "14px"
  tablet-gutter: "20px"
  desktop-gutter: "32px"
  header-height: "84px"
  module-gap: "70px"
  mobile-section-y: "92px"
  section-y: "clamp(110px, 12vw, 180px)"
components:
  button-primary:
    backgroundColor: "{colors.brand-blue}"
    textColor: "{colors.brand-on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 25px"
    height: "58px"
  button-primary-hover:
    backgroundColor: "{colors.active-blue}"
    textColor: "{colors.brand-on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 25px"
    height: "58px"
  button-header:
    backgroundColor: "{colors.brand-blue}"
    textColor: "{colors.brand-on-primary}"
    rounded: "{rounded.none}"
    padding: "0 19px"
    height: "46px"
  button-text:
    textColor: "{colors.cloud-white}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    height: "48px"
  action-node:
    backgroundColor: "{colors.finish-turquoise}"
    textColor: "{colors.mineral-night}"
    rounded: "{rounded.circle}"
    size: "68px"
  technical-label:
    textColor: "{colors.mineral-muted}"
    typography: "{typography.label}"
---

# Design System: SOBE

## Overview

**Creative North Star: "Arquitetura da Atenção"**

A SOBE transforma atenção difusa em uma decisão legível. O mundo visual é uma noite mineral atravessada por nuvens brancas, cortes prateados e um percurso luminoso: ciano organiza a intenção, turquesa marca a chegada e Azul Sobe confirma a ação. A interface deve parecer esculpida e precisa, não uma coleção genérica de componentes SaaS.

A composição alterna palcos escuros de concentração com superfícies claras de explicação. Tipografia grande e compacta, linhas técnicas finas, placas com cantos recortados e poucos pontos de brilho conduzem a leitura. O hero canônico coloca headline e CTAs à esquerda, o portal de nuvens à direita e a sequência Atração → Intenção → Ação na base. O portal rasterizado é `/public/visuals/attention-gate.png`; texto, controles e diagramas permanecem HTML/CSS/SVG responsivos.

A marca usa sempre o arquivo oficial exato `imagens/logos/Logo Simbolo Sobe.png`, importado por `next/image` no componente `Brand`. O símbolo aparece inteiro, sem máscara, filtro, caixa ou recoloração, e é acompanhado pelo nome textual “SOBE” quando o componente não está compacto. A entrega usa a otimização nativa em qualidade 90; não crie WebP manual, vetor aproximado ou versão por IA.

**Key Characteristics:**

- Noite mineral profunda e nuvens brancas realistas, com contraste alto e atmosfera editorial.
- Azul Sobe raro e funcional para ação e seleção; ciano para percurso e conexão; turquesa para chegada e conclusão.
- Placas e controles com cantos chanfrados, linhas técnicas finas e nós circulares pontuais.
- Hierarquia tipográfica de uma única família, grande, compacta e direta.
- Sequências visuais que sempre terminam em um próximo passo compreensível.
- Movimento curto de revelação e progressão, com fallback completo para movimento reduzido.

## Colors

A paleta combina Navy e Off-white com os quatro estágios do gradiente proprietário: Turquesa de Conclusão → Ciano de Percurso → Azul Ativo → Azul Sobe.

### Primary

- **Azul Sobe:** reservado aos CTAs, à ênfase decisiva e ao foco visível.
- **Branco de Contraste:** texto sobre Azul Sobe e conteúdo principal em superfícies escuras.

### Secondary

- **Azul Ativo:** hover, seleção e estados que respondem à interação.
- **Ciano de Percurso:** trilhos, conectores, números de etapa e estados intermediários.
- **Turquesa de Conclusão:** nós de chegada, confirmações e o fim de uma progressão.

### Neutral

- **Noite Mineral:** fundo principal do hero, do mecanismo e do encerramento.
- **Mineral Elevado:** painéis e seções escuras que precisam se separar da noite de base.
- **Branco de Nuvem:** texto principal sobre escuro e fundo das áreas claras.
- **Prata de Palco:** matéria clara do estágio de transformação.
- **Ardósia de Tempestade:** placas, tags e sinais de contraste médio.
- **Tinta Clara:** títulos e conteúdo de maior contraste sobre superfícies claras.
- **Cópia Clara / Cópia Escura:** explicações secundárias no tema correspondente.
- **Ardósia Mineral:** metadados, rótulos e sinais de baixa ênfase.
- **Linha Técnica / Linha de Trilho:** divisórias finas, nunca molduras pesadas.

### Named Rules

**The Three-Signal Rule.** Azul Sobe significa ação ou ênfase decisiva; azul ativo significa resposta à interação; ciano e turquesa descrevem percurso e chegada. Não troque essas funções apenas para criar variedade.

**The Mineral Contrast Rule.** Toda área escura concentra uma decisão ou mecanismo; toda área clara devolve explicação e respiro. Não use a alternância como decoração sem função narrativa.

## Typography

**Display Font:** Inter (com Arial e sans-serif como fallbacks)  
**Body Font:** Inter (com Arial e sans-serif como fallbacks)  
**Label Font:** Inter (com Arial e sans-serif como fallbacks)

**Character:** uma única família sem serifa sustenta uma voz direta, contemporânea e operacional. A diferença entre funções vem de escala, peso, entrelinha e espaçamento — nunca de uma segunda família inventada.

### Hierarchy

- **Display:** hero e encerramento; muito grande, peso alto, entrelinha comprimida e tracking negativo.
- **Headline:** títulos de seção; mantém massa editorial, quebra curta e equilíbrio visual.
- **Title:** etapas, capacidades e perguntas; forte sem competir com o headline.
- **Lead:** parágrafos de abertura e explicações de seção; idealmente limitados a cerca de 530–610px.
- **Body:** explicações funcionais curtas; frases concretas e ritmo confortável.
- **Label:** metadados técnicos, sequência e estado; caixa alta, tracking aberto e números tabulares quando houver progressão.
- **Button:** verbo de ação curto, peso alto e caixa normal.

### Named Rules

**The Tight Headline Rule.** Títulos grandes usam entrelinha comprimida e tracking negativo; mantenha quebras intencionais e nunca reduza contraste para obter leveza.

**The One-Family Rule.** Inter é a voz integral desta superfície. Novas telas diferenciam papéis por escala e peso, não por famílias tipográficas adicionais.

## Layout

O primeiro viewport é assimétrico e cenográfico. O conteúdo usa largura máxima de 1420px com o gutter desktop normativo; o header absoluto usa a altura de header e três colunas, com marca à esquerda, navegação central e CTA à direita. O hero ocupa no mínimo 720px e pelo menos 100svh. Headline e CTAs dominam a esquerda, enquanto a imagem do portal cobre o quadro e preserva a massa de nuvens à direita. A linha Atração → Intenção → Ação ancora a base do viewport.

As seções usam um campo de até 1320px, grandes intervalos verticais e grids assimétricos em vez de paredes de cards. O estágio “atenção dispersa → recorte → ação” é um único objeto horizontal; o mecanismo combina lista numerada e canvas; possibilidades vira um trilho horizontal contínuo com snap. A ordem narrativa é problema, mecanismo, adaptação, criação, dúvidas e ação final.

Em até 1080px, a navegação desktop e seu CTA cedem lugar ao menu nativo com `details`; cabeçalhos viram uma coluna, o mecanismo empilha e as etapas podem ocupar três colunas. Em até 760px, o gutter passa ao valor mobile, o hero fica entre 830px e 920px, conteúdo e arte se recompõem verticalmente, o CTA principal ocupa a largura, descrições da linha inferior são ocultadas e todos os palcos passam a uma coluna. O estágio de transformação gira de eixo horizontal para vertical; o rail continua rolável e cada item mantém snap e largura legível.

**The One-Route Rule.** Cada seção deve apresentar uma progressão dominante. Evite grades uniformes quando um trilho, sequência ou palco único explica melhor a transformação.

## Elevation & Depth

O sistema usa profundidade ambiental, não elevação indiscriminada. O raster do portal fornece massa e perspectiva; gradientes radiais separam zonas de foco; sombras aparecem apenas sob superfícies que concentram ação ou demonstração. O botão principal usa brilho Azul Sobe baixo, o palco de transformação recebe sombra mineral ampla, a tela clara da simulação flutua dentro do canvas e o nó final recebe um halo turquesa. Divisórias e placas comuns permanecem planas.

### Shadow Vocabulary

- **Brilho de Ação** (`0 18px 42px rgba(0,84,252,.2)`): CTA principal em repouso; cresce no hover.
- **Palco Recortado** (`0 32px 90px rgba(19,35,50,.13)`): transformação clara para escura.
- **Canvas Mineral** (`0 36px 100px rgba(0,0,0,.3)`): demonstração abstrata dentro da seção escura.
- **Tela de Simulação** (`0 28px 60px rgba(0,0,0,.32)`): separa a placa clara do canvas mineral.
- **Nó de Conclusão** (`0 12px 34px rgba(2,229,205,.2), 0 0 0 12px rgba(2,229,205,.08)`): ação final de um percurso, nunca decoração solta.

**The Focused Depth Rule.** Sombra sinaliza ação, recorte ou conclusão. Se um elemento não participa da progressão, ele deve permanecer plano.

## Shapes

A forma proprietária é o canto recortado. CTAs cortam o canto superior direito em 12–14px; placas menores usam cortes de 8–16px; canvases amplos cortam o superior direito e o inferior esquerdo em 22–24px. Essas geometrias são feitas por `clip-path: polygon(...)`, sem arredondamento cosmético. Trilhos são linhas finas com nós circulares; círculos completos ficam reservados a pontos de passagem, ícones de conclusão e sinais no portal.

O tratamento da marca é uma exceção funcional: o asset oficial aparece inteiro, sem caixa, moldura ou raio visível. Não aplique o canto recortado à logo nem altere suas cores ou pixels.

**The Cut-Corner Rule.** Um canto chanfrado indica placa, comando ou matéria esculpida. Não converta a interface em uma coleção de cápsulas arredondadas.

**The Thin-Rail Rule.** Percursos usam linha fina, poucos nós e uma única direção. Ornamento repetitivo ou excesso de setas enfraquece a arquitetura.

## Components

### Brand

- **Source:** `imagens/logos/Logo Simbolo Sobe.png`, importado diretamente pelo componente `Brand` com `next/image` e entregue em qualidade 90, sem arquivo derivado.
- **Presentation:** área óptica de 42px no header e 34px no footer, seguida do nome “SOBE” em caixa alta e tracking aberto.
- **Variants:** claro e escuro mudam apenas o texto adjacente; o bitmap oficial não recebe filtro de cor.

### Navigation

- **Desktop:** header absoluto de 84px, linha inferior branca translúcida, navegação central com gap de 36px e CTA Azul Sobe recortado à direita.
- **Link State:** branco translúcido em repouso e branco total no hover, com transição funcional curta.
- **Mobile:** abaixo de 1080px, botão quadrado de 46px com borda fina abre um `details`; o painel tem fundo mineral quase opaco, sombra ampla e links em linhas de toque confortáveis.

### Buttons

- **Shape:** placa retangular com canto superior direito cortado; não possui raio convencional.
- **Primary:** Azul Sobe com texto branco, altura mínima de 58px, padding horizontal de 25px, gap amplo e seta direcional.
- **Header:** versão compacta de 46px e padding horizontal de 19px.
- **Hover:** sobe 2px, muda para Azul Ativo e desloca a seta 4px; todas as transições funcionais duram 180ms.
- **Focus:** outline Azul Sobe de 3px com offset de 4px; o recorte nunca pode apagar o indicador.
- **Secondary:** link textual com sublinhado técnico; no hover, linha e texto tornam-se Azul Sobe.

### Portal & Route

O portal de nuvens é o gesto visual dominante e usa a imagem aprovada como atmosfera, jamais como suporte para texto rasterizado. A rota inferior é semântica e legível: três rótulos em HTML ligados por trilhos gradientes, terminando em nó turquesa. No mobile, os rótulos permanecem e apenas as descrições secundárias são removidas.

### Transformation Stage

Um palco recortado único contrapõe sinais dispersos sobre prata, uma abertura mineral estreita e uma placa escura com o próximo passo. Os sinais aparecem como pequenas tags técnicas conectadas por trilhos ciano; cada trilho parte de uma origem diferente e converge progressivamente em um nó decisivo junto à abertura. O campo deve comunicar dispersão com direção, sem parecer uma coleção de cards soltos. O eixo vira vertical no mobile. É a representação canônica da tese “atenção difusa vira ação clara” e não deve ser fragmentada em cards independentes.

### Mechanism Canvas

O canvas mineral combina sinais convergentes, placa clara recortada e um nó de ação circular turquesa. A lista numerada usa bordas técnicas, números ciano e cópia curta. A simulação segue o compositor real do produto: escolha de intenção → contexto específico → ação final, usando orçamento, horário e produtos sem marcas ou negócios simulados. Ela inicia somente quando entra em tela, pausa quando a página fica oculta, aceita clique, respeita movimento reduzido e termina em um estado estável.

### Capability Rail

Capacidades formam um trilho horizontal com bordas superior e inferior, divisórias internas, linha gradiente e nós. Cada item apresenta ícone de traço fino, título e uma frase. Em telas estreitas, o rail rola horizontalmente com snap; não deve virar uma parede de cartões arredondados.

### FAQ

Perguntas usam `details/summary` nativo, divisórias finas e símbolo “+” que gira 45° quando aberto. A linha tem no mínimo 92px no desktop e 80px no mobile. O conteúdo aberto permanece textual, direto e sem animação que atrase a leitura.

### Motion & Accessibility

No carregamento, título, cópia, trilho e arte entram uma única vez com durações entre 720ms e 1100ms e easing de desaceleração expressiva. No mecanismo, a sequência focal usa fases de 900ms, 650ms e 1450ms; ela inicia somente em tela, pausa quando a página fica oculta e não entra em loop. Hovers funcionais usam 180ms. Sob `prefers-reduced-motion: reduce`, a reprodução automática é desativada e animações e transições caem para 0.01ms, sem esconder conteúdo ou alterar a ordem de leitura.

Ícones decorativos usam `aria-hidden`; imagens atmosféricas têm `alt=""`; navegações e a rota recebem rótulos acessíveis; menus e FAQs usam elementos nativos. Todo controle interativo deve preservar o foco Azul Sobe de 3px e offset de 4px.

## Do's and Don'ts

### Do:

- **Do** usar “Arquitetura da Atenção” como norte criativo e a sequência Atração → Intenção → Ação como gramática narrativa.
- **Do** usar o arquivo oficial exato `imagens/logos/Logo Simbolo Sobe.png` por meio do componente `Brand`.
- **Do** reservar Azul Sobe para ação decisiva, azul ativo para resposta à interação, ciano para percurso e turquesa para chegada.
- **Do** alternar palcos minerais escuros e superfícies claras conforme a função narrativa.
- **Do** manter títulos grandes, compactos, legíveis e com quebras deliberadas.
- **Do** escrever em português do Brasil, com verbos concretos e foco em resultado comercial.
- **Do** explicar capacidades e o mecanismo de forma abstrata e verdadeira quando não houver prova comercial real.
- **Do** manter texto, controles e diagramas em HTML/CSS/SVG responsivo; somente a atmosfera do portal é raster.
- **Do** respeitar foco visível, elementos semânticos e `prefers-reduced-motion` em toda extensão do sistema.

### Don't:

- **Don't** usar hero SaaS com mockup de celular, dashboard flutuante ou parede de cards.
- **Don't** recriar, vetorizar, recolorir, filtrar ou substituir a logo oficial por uma aproximação ou derivação.
- **Don't** inventar clientes, marcas, depoimentos, métricas, resultados ou estudos de caso.
- **Don't** usar Casa de Sucos Mix, Vértice, Clínica Aurora, Chalés Serra Clara ou qualquer outro exemplo fictício em superfícies públicas.
- **Don't** apresentar a SOBE como mero agregador de links; a mensagem central é organização da intenção até a próxima ação.
- **Don't** trocar as funções dos sinais da marca, adicionar cores de destaque concorrentes ou usar glow como ornamento.
- **Don't** arredondar sistematicamente placas e painéis; preserve os cantos recortados e trilhos técnicos.
- **Don't** rasterizar texto ou interface, esconder conteúdo essencial em animação, sequestrar scroll ou exigir movimento para compreender a jornada.
