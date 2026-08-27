# Veredito geral

**REPROVADA**

A Activation demonstrou uma capacidade forte de entender fatos e propor uma `CommercialArchitecture` coerente para cinco negócios muito diferentes. Esse é o principal resultado positivo da rodada: a IA reconheceu B2C versus B2B, múltiplas unidades, qualificação, booking externo, descoberta de veículo e agendamento sem que o empresário precisasse usar linguagem de produto.

O problema aparece na passagem da arquitetura para o produto utilizável. Em quatro dos cinco casos, campos específicos prometidos pela arquitetura foram substituídos por duas perguntas genéricas. Os dois fluxos com maior dependência operacional — roteamento multiunidade e agendamento — ficaram bloqueados no runtime. Além disso, a finalização do onboarding falhou com HTTP 400 em **5/5 projetos**, embora o rascunho já tivesse sido salvo. Assim, o produto entende melhor do que executa e não oferece confiança suficiente para um empresário publicar sem intervenção técnica.

## Escopo e método

- Execução em 26/08/2026, aplicação real em desenvolvimento com `npm run dev` e banco configurado pelo projeto.
- Cinco sessões de onboarding e cinco projetos separados, criados pela interface.
- Contexto fornecido em linguagem de empresário, sem prescrever botões, capabilities, journeys ou routing.
- Caminhos principais clicados na prévia pública; destinos e mensagens verificados pelo painel de prévia, sem disparar mensagens reais.
- Nenhuma correção de código foi feita.
- URLs fictícias testáveis foram usadas para cardápio e booking.
- Uma ampliação temporária de cota de geração foi necessária para concluir a rodada; ela foi removida ao fim do teste.

# Score geral

**43/100**

A média das oito dimensões nos cinco negócios foi **57,5/100**. Foi aplicada uma penalidade operacional de 14,5 pontos porque a etapa final falhou em 5/5 casos e deixou todas as sessões em `review`, apesar de os projetos existirem como `draft`.

| Negócio | Entendimento | Esforço do empresário | Jornadas propostas | Blockers | Primeira página | Conversões reais | Visual | Confiança para publicar | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Viva Natural | 9 | 7 | 8 | 6 | 5 | 2 | 4 | 2 | 43/80 |
| Elevare | 9 | 9 | 8 | 9 | 5 | 4 | 4 | 3 | 51/80 |
| Vila do Mar Hotel | 8 | 9 | 6 | 8 | 4 | 2 | 4 | 2 | 43/80 |
| Prime Motors | 9 | 9 | 8 | 9 | 5 | 4 | 4 | 3 | 51/80 |
| Clínica Aurora | 8 | 8 | 6 | 2 | 6 | 2 | 8 | 2 | 42/80 |

# Negócio 1 — Viva Natural

## Contexto fornecido

- Sucos naturais, smoothies e kits em 300 ml, 1 L e 2 L.
- Quatro unidades: Centro, Jardins, Moema e Pinheiros, cada uma com WhatsApp próprio.
- Cardápio digital de autoatendimento, encomendas/eventos e canal B2B separado.
- Telefone principal, cinco números operacionais no texto e logo verde simulada.
- O link real do cardápio não estava disponível inicialmente.

Projeto criado: `90e1bf6d-eb71-4b43-86af-d5a56c4cb912` (`/viva-natural/preview`).

## Informações extraídas automaticamente

- Ofertas: sucos naturais, smoothies e kits; tamanhos foram reconhecidos no contexto.
- Públicos: consumidor final, empresas/revendedores e clientes de encomendas/eventos.
- Intenções: consultar cardápio, fazer pedido, pedir orçamento de encomenda/evento, atendimento B2B e falar com unidade.
- Unidades e canais: quatro locais ligados aos quatro números corretos, mais o WhatsApp B2B terminado em 2200.
- Jornada de pedido proposta com bairro, preferência de unidade, retirada/atendimento local, produto, tamanho e quantidade.
- Jornada de encomenda proposta com data, tipo de evento, local e quantidade estimada.
- A logo gerou a paleta `#000000`, `#48A800`, `#186030`, `#A8D800`, `#D8F030` e `#F0F0C0`, além de direção visual orgânica/fresca.

## Blockers

| Pergunta exibida | Classificação | Resultado |
|---|---|---|
| `Link do cardápio digital` | **BLOCKER REAL** | Necessário para permitir autoatendimento externo. Foi preenchido com uma URL fictícia testável. |
| `Link para Consultar cardápio` | **PERGUNTA DESNECESSÁRIA** | Duplicava o blocker anterior. Preencher um campo resolveu os dois. |

Não houve pergunta estratégica indevida. O problema foi duplicação de representação do mesmo requisito.

## Entendimento comercial

A arquitetura foi muito boa. Separou B2C, B2B e encomendas; preservou os cinco destinos; associou locais a canais e propôs composições diferentes para link externo, routing, pedido e qualificação. O principal desvio não ocorreu no entendimento, mas na materialização.

## Primeira página criada

- Duas páginas (`Início` e `Fale com a equipe`) e cinco ações iniciais relevantes.
- A página é legível, mas genérica: headline pouco específica, cards com descrições superficiais e unidades sem descrição útil.
- A quantidade de opções é alta, mas justificável pela operação. Uma priorização melhor reduziria carga cognitiva.
- A identidade verde aparece principalmente na pequena logo; a página permanece quase toda preta e branca. A paleta foi extraída, mas pouco usada no sistema visual renderizado.

## Jornada funcional

- **Cardápio:** o destino externo foi salvo, mas a prévia não deixou claro que o CTA selecionado estava sendo verificado; o painel lateral continuou exibindo B2B.
- **Unidade:** coletou bairro e unidade, mas `/api/public/routing/resolve` retornou 404 e exibiu “Não encontramos um destino compatível seguro”. Nenhuma das quatro unidades chegou ao WhatsApp correto.
- **Pedido:** começou com os dados de localização, mas falhou no routing antes de chegar a produto, tamanho e quantidade.
- **Encomenda/evento:** em vez de data, tipo, local e quantidade, mostrou apenas duas perguntas genéricas. Ao concluir, encaminhou para o WhatsApp da unidade Centro, não para um destino explicitamente coerente com encomendas.
- **B2B:** o destino terminado em 2200 estava correto, mas a mensagem carregou campos de unidade preenchidos em outra jornada.
- **Memória:** respostas da jornada de unidade vazaram para B2B e encomendas.
- **Finalização:** `generate` e o salvamento do projeto concluíram, mas `finalize-project` retornou 400 com “Revise os dados enviados”. Uma tentativa de repetição chegou a iniciar outro ID de projeto e falhou no salvamento; o banco terminou com apenas um Viva Natural persistido, mas a ação não se mostrou segura para repetição.

## Teste mais importante

**NÃO.** Um empresário leigo reconheceria sua operação na arquitetura, mas receberia uma experiência que não roteia unidades, não coleta os dados prometidos e mistura contexto entre jornadas.

# Negócio 2 — Elevare

## Contexto fornecido

- Consultoria de crescimento comercial B2B, sem venda direta pelo site.
- Objetivo de identificar empresas com potencial antes da conversa.
- Oito fatos desejados: nome, empresa, site/Instagram, faturamento, mídia paga, investimento, time comercial e problema atual.
- WhatsApp comercial terminado em 3300 e logo azul simulada.

Projeto criado: `e9d6df54-15ad-4f69-853c-dbe9937281c4` (`/elevare/preview`).

## Informações extraídas automaticamente

- Público empresarial e mecanismo principal de qualificação.
- Intenções: `Ser qualificado para abordagem comercial` e `Falar com o comercial`.
- Jornada de qualificação com exatamente os oito campos fornecidos.
- Destino único correto: WhatsApp comercial terminado em 3300.
- Ausência de catálogo/produtos preservada.
- Logo analisada com paleta azul (`#000000`, `#001860`, `#0060FF`) e direção de confiança/performance.

## Blockers

Nenhuma pergunta foi feita. Isso foi correto: os dados mínimos e o destino já estavam presentes.

## Entendimento comercial

O entendimento foi excelente e econômico. A Sobe identificou qualificação como mecanismo principal sem o usuário pedir formulário, evitou catálogo e propôs um atalho de contato direto como ação secundária.

## Primeira página criada

- Duas opções iniciais, hierarquia simples e legível.
- A primeira tela quase não explica a proposta da Elevare antes de pedir ação; usa a copy genérica “O que você deseja fazer hoje?”.
- A logo azul aparece, mas a paleta tem participação visual discreta e não diferencia suficientemente a página.

## Jornada funcional

- O caminho de qualificação prometeu oito campos, mas o runtime mostrou somente:
  1. `O que você mais gostaria de resolver neste momento?`
  2. `Que resultado seria mais importante para você?`
- A mensagem final incluiu `qualification 1` e `qualification 2`, nomenclatura técnica e genérica, em vez dos dados comerciais esperados.
- O WhatsApp terminado em 3300 foi selecionado corretamente.
- O contato direto também verificou o destino correto na prévia.
- A finalização retornou HTTP 400 e deixou a sessão em `review`.

## Teste mais importante

**PARCIALMENTE.** O empresário não precisaria entender funil para obter uma arquitetura correta, mas teria de reconstruir manualmente o formulário para que a qualificação realmente sirva ao comercial.

# Negócio 3 — Vila do Mar Hotel

## Contexto fornecido

- Quartos standard, premium e suítes família.
- Reservas por sistema externo de booking em URL fictícia testável.
- WhatsApp terminado em 4400.
- Necessidade de conhecer quartos, escolher datas, informar hóspedes e reservar.
- Declaração explícita de que somente o booking confirma disponibilidade real.

Projeto criado: `b7ac479a-c963-4927-98f9-a9650266459b` (`/vila-do-mar-hotel/preview`).

## Informações extraídas automaticamente

- Oferta de hospedagem e os três tipos de acomodação.
- Intenções: fazer reserva, falar com o hotel e consultar hospedagem.
- Dois canais corretos: WhatsApp terminado em 4400 e booking externo.
- A arquitetura colocou reserva e consulta no canal externo, sem afirmar disponibilidade própria.

## Blockers

Nenhuma pergunta foi feita. Isso era aceitável se a experiência fosse apenas encaminhar ao booking, porque a URL e o WhatsApp já estavam disponíveis.

## Entendimento comercial

A separação entre informação, atendimento e reserva foi coerente. Entretanto, a jornada de `Consultar hospedagem` não coletava datas nem hóspedes, e `Fazer reserva` foi definida como acesso externo. A arquitetura era conservadora e não prometia disponibilidade, mas também pouco aproveitava o contexto antes do encaminhamento.

## Primeira página criada

- Três CTAs claros, porém a página não apresenta visualmente quartos standard, premium ou suíte família.
- Copy e design são genéricos e não comunicam hotelaria além dos rótulos.
- O WhatsApp permanece acessível e o número é verificado corretamente.

## Jornada funcional

- **Consultar hospedagem:** abriu as mesmas duas perguntas genéricas dos outros negócios, em vez de mostrar quartos ou coletar datas/hóspedes. Após preenchimento, ofereceu o botão para o sistema externo de booking.
- **Fazer reserva:** abriu uma tela com `Consultar disponibilidade` e `Continuar`, mas sem campos de entrada, saída ou hóspedes. Clicar em consultar exibiu `Escolha entrada e saída`, embora não existissem controles para escolhê-las. O caminho ficou bloqueado.
- Esse runtime diverge da arquitetura `direct_external`: criou aparência de reserva nativa incompleta mesmo sem dados de disponibilidade.
- Não foi exibida disponibilidade inventada, mas o controle sugere uma consulta que a aplicação não consegue executar.
- A finalização retornou HTTP 400 e deixou a sessão em `review`.

## Teste mais importante

**NÃO.** O núcleo do negócio é reservar hospedagem, e o CTA principal termina em uma tela que exige datas sem oferecer os campos correspondentes.

# Negócio 4 — Prime Motors

## Contexto fornecido

- Veículos novos e seminovos, várias marcas e modelos.
- Clientes frequentemente ainda não sabem qual carro desejam.
- Fatos de compra: faixa de orçamento, novo/usado, tipo, modelo, troca, financiamento e entrada.
- Continuidade com consultor pelo WhatsApp terminado em 5500.

Projeto criado: `270b0aaa-39b8-411a-9259-16621d0fe19e` (`/prime-motors/preview`).

## Informações extraídas automaticamente

- Intenções: falar com consultor, recomendação de carro e cotação/pré-atendimento.
- Duas jornadas de descoberta/qualificação com os sete dados, seguidas de handoff ao WhatsApp.
- Contato direto como escape secundário.
- Não houve criação de catálogo fictício de veículos.

## Blockers

Nenhuma pergunta foi feita. Correto: o contexto e o canal eram suficientes para criar um primeiro fluxo de triagem.

## Entendimento comercial

Foi um dos melhores resultados de raciocínio. A Sobe diferenciou visitante decidido de visitante que precisa de recomendação e organizou preferências antes das condições de compra. Isso foi obtido sem capability ou linguagem específica de concessionária fornecida pelo usuário.

## Primeira página criada

- Três CTAs relevantes e sem opção inútil.
- Design claro, mas genérico; não há prova, seleção visual ou apresentação de proposta que gere confiança antes da triagem.
- Sem logo, a identidade padrão não cria distinção forte de marca.

## Jornada funcional

- Tanto `Recomendação de carro` quanto `Cotação / pré-atendimento` foram reduzidas às mesmas duas perguntas genéricas.
- Os sete campos e a ordem lógica da arquitetura desapareceram.
- A conclusão chegou ao WhatsApp terminado em 5500 e levou o conteúdo das duas respostas, portanto o handoff básico funciona.
- A mensagem usa chaves técnicas `qualification 1/2`, não linguagem comercial útil.
- O contato direto aponta para o número correto no verificador da prévia.
- A finalização retornou HTTP 400 e deixou a sessão em `review`.

## Teste mais importante

**PARCIALMENTE.** A IA faz o trabalho estratégico de alto nível, mas o visitante e o vendedor não recebem a qualificação que foi planejada.

# Negócio 5 — Clínica Aurora

## Contexto fornecido

- Clínica estética com avaliação, limpeza de pele, procedimentos faciais e corporais.
- Operação com agenda.
- Visitantes querem entender tratamentos, escolher serviço, marcar avaliação/atendimento ou falar com a recepção.
- WhatsApp terminado em 6600 e logo vinho simulada.
- Nenhum serviço agendável, duração ou regra de disponibilidade foi cadastrado, deliberadamente.

Projeto criado: `5a2cdcd7-e73d-4130-aff3-187b1ddf8846` (`/clinica-aurora/preview`).

## Informações extraídas automaticamente

- Intenções: falar com recepção, marcar avaliação/horário e entender tratamentos.
- Jornada de orientação com interesse, região do corpo/rosto, objetivo e preferência por avaliação/procedimento.
- A arquitetura decidiu corretamente que o agendamento final deveria continuar pelo WhatsApp, sem scheduling nativo.
- Logo analisada com paleta `#781830`, `#000000`, `#C06078`, `#D8A8A8` e `#480000`.
- A página renderizada aplicou vinho/rosa em barra de progresso, CTA, fundo e detalhes, com bom contraste e legibilidade.

## Blockers

Nenhuma pergunta foi feita.

Isso seria correto se a materialização preservasse o agendamento via WhatsApp. Como o runtime criou scheduling nativo, faltaram blockers reais:

| Pergunta ausente | Classificação |
|---|---|
| Serviço agendável e duração | **BLOCKER REAL** para scheduling nativo |
| Regras de disponibilidade/agenda | **BLOCKER REAL** para scheduling nativo |
| Forma de confirmação | **BLOCKER REAL** para scheduling nativo |

## Entendimento comercial

A arquitetura proposta foi prudente: descoberta guiada, agenda via recepção e contato direto. O erro surgiu na materialização, que mudou a estratégia de destino e expôs controles de scheduling sem backing.

## Primeira página criada

- Três caminhos bem nomeados e a melhor personalização visual da rodada.
- Identidade elegante, legível e coerente com a marca vinho.
- Ainda falta conteúdo que apresente os quatro serviços antes do contato; a primeira página permanece um seletor de intenção.

## Jornada funcional

- **Marcar avaliação ou horário:** exibiu `Consultar horários`, a mensagem `Nenhum horário disponível nesta data` e `Continuar`, mas não havia seletor de serviço, data nem horário. `Continuar` respondeu `Escolha um serviço e um horário disponível`. É um beco sem saída.
- A aplicação não inventou um horário específico, mas afirmou ausência de horário para uma data que nunca foi escolhida.
- **Entender tratamentos:** em vez de quatro perguntas específicas, mostrou as mesmas duas perguntas genéricas.
- **Falar com recepção:** o verificador apontou corretamente para WhatsApp terminado em 6600.
- A finalização retornou HTTP 400 e deixou a sessão em `review`.

## Teste mais importante

**NÃO.** O caminho de maior intenção comercial, agendar, fica impossível de concluir e exige intervenção técnica ou reconstrução manual.

# Identidade visual — resultado transversal

Foram usadas três logos fictícias, geradas exclusivamente como fixture desta rodada:

- Viva Natural: marca verde orgânica.
- Elevare: marca azul corporativa/performance.
- Clínica Aurora: marca vinho premium.

O pipeline `logo → extração → paleta → página` existe e funcionou tecnicamente nos três casos. A extração distinguiu corretamente as famílias cromáticas e manteve contraste legível. A aplicação no resultado final, porém, foi desigual:

- **Clínica Aurora:** boa incorporação da paleta no fundo, progresso, CTA e microdetalhes.
- **Viva Natural e Elevare:** logo correta, mas presença cromática fraca; o layout continua majoritariamente neutro e pouco reconhecível como marca.

Conclusão visual: o pipeline está presente, mas ainda não garante personalização consistente. A melhor execução prova que o sistema consegue aplicar a marca; a variação entre projetos mostra falta de previsibilidade.

# Overfitting

## Comportamento observado

Os cinco projetos não foram cópias de um único template: a IA propôs combinações diferentes de `direct_contact`, `direct_external`, `qualification`, `guided_flow`, `routing`, `catalog` e scheduling. Canais, unidades, intenções e campos variaram conforme os fatos. Essa parte se aproxima do resultado desejado: mecanismos compartilhados com composições diferentes.

## Código observado

Há, porém, lógica explícita por vertical no código atual:

- `src/features/business-understanding/rule-based-business-analyzer.ts`: grupos de palavras para `hospitality`, produto físico e serviço profissional, com consequências determinísticas sobre intenções, capacidade e confirmação.
- `src/features/site-composer/business-shape.ts`: regex específicas para hotel/hospedagem, consultoria/clínica e restaurante/local, escolhendo um `model` de vertical.
- `src/features/composition/visual-composer.ts`: `if` explícitos para clínica/saúde, restaurante/comida/sucos, hotel/pousada/hospedagem e pet, com paletas, personalidade e copy padrão próprias.
- `src/features/ai-setup/qualification-proposal.ts`: ramo específico de saúde/estética. A restrição clínica é justificável por segurança, mas continua sendo lógica de nicho e deve ser tratada conscientemente como política, não como template comercial.
- Fixtures e testes contêm Casa de Sucos, clínica e hotel. Eles não substituíram os projetos reais desta rodada, mas aumentam o risco de otimização para esses exemplos.

Portanto, o resultado atual é **mecanismos universais + classificadores e defaults verticais explícitos**. Não foi encontrada uma condicional `if dealership`, e a Prime Motors ainda foi bem entendida, o que é um sinal positivo. Mesmo assim, o critério estrito de ausência de lógica por nicho não é atendido.

# Padrões de erro encontrados

## Entendimento da IA

- Forte extração de intenções, canais, unidades e distinção entre contato direto e jornada guiada.
- Priorização ocasionalmente discutível: contato direto virou ação primária em Viva Natural e Clínica Aurora, embora pedido/agendamento fossem mais centrais.
- Alguns perfis rule-based ficaram imprecisos: Prime Motors foi classificada como `service`; Clínica Aurora exigiu `company` no perfil, apesar de ser B2C.

## UX

- A página pública frequentemente repete uma segunda tela `Escolha seu próximo passo` depois de o usuário já ter escolhido uma ação.
- Headlines e conteúdo da primeira página são genéricos e pouco persuasivos.
- Mensagens finais usam chaves como `qualification 1/2`, visíveis ao usuário.
- Erro de finalização não explica qual campo está inválido nem oferece recuperação segura.

## Blockers

- Duplicação do link de cardápio em Viva Natural.
- Nenhum blocker para o scheduling nativo que acabou materializado na Clínica Aurora.
- O sistema de blockers avaliou a arquitetura, mas não protegeu o runtime efetivamente criado.

## Jornadas

- Campos específicos da `CommercialArchitecture` foram perdidos na composição.
- Quatro negócios reutilizaram as mesmas duas perguntas genéricas, independentemente do propósito.
- Reserva externa foi transformada em uma experiência nativa incompleta.

## Runtime

- Finalização falhou em 5/5 casos após o rascunho já ter sido salvo.
- Agenda da clínica e reserva do hotel ficaram em dead-end.
- A prévia não executa envio real por desenho, mas o verificador de destino nem sempre acompanha o CTA selecionado.

## Design

- Boa legibilidade, espaçamento e responsividade básica.
- Paleta vinho aplicada de forma convincente na clínica.
- Personalização fraca nos dois outros negócios com logo.
- Pouco conteúdo específico de oferta: quartos, tratamentos, serviços e proposta B2B quase não aparecem antes da ação.

## Routing

- Multiunidade retornou 404 mesmo com quatro locais e canais corretamente extraídos.
- Encomenda/evento foi encaminhada à unidade Centro sem uma regra comercial claramente sustentada.
- Cardápio externo e WhatsApp B2B existiam na arquitetura, mas o painel de verificação manteve destino/CTA incorreto em alguns estados.

## Memory/context

- Respostas de unidade da Viva Natural vazaram para jornadas B2B e de evento.
- Trocar de objetivo não limpou o estado específico da jornada anterior.
- As cinco sessões de negócio foram separadas; não foi observado vazamento entre empresas.

# Top 10 problemas

## 1. Finalização do onboarding falha depois de salvar o projeto

- **Severidade:** crítica
- **Frequência:** 5/5
- **Impacto:** o usuário nunca chega ao estado concluído nem à tela de lançamento; todas as sessões ficam em `review` e todos os projetos em `draft`.
- **Evidência:** `POST .../finalize-project` retornou 400 com `Revise os dados enviados` em todos os casos, depois de `generate` 200 e `PUT /api/projects/{id}` 200.
- **Possível causa:** falha de validação ou materialização dentro da etapa final, com tratamento que reduz o erro a uma mensagem genérica.

## 2. A composição descarta campos específicos da arquitetura

- **Severidade:** crítica
- **Frequência:** 5/5 em pelo menos uma jornada principal
- **Impacto:** a inteligência comercial existe no planejamento, mas não chega à experiência nem ao handoff.
- **Evidência:** oito campos da Elevare, sete da Prime Motors, quatro da clínica e quatro de eventos da Viva Natural viraram duas perguntas genéricas; hotel não exibiu datas/hóspedes.
- **Possível causa:** fallback de `buildQualificationQuestionPlan`/materialização substitui `steps.collects` por um plano genérico quando não encontra ofertas/perfis associados.

## 3. Scheduling nativo é materializado sem backing

- **Severidade:** crítica
- **Frequência:** 1/5
- **Impacto:** o CTA principal da clínica é impossível de concluir.
- **Evidência:** “Nenhum horário disponível nesta data” sem data, serviço ou slot selecionável; continuar exige um serviço/horário inexistente.
- **Possível causa:** o scaffold de ação `schedule` cria bloco `schedule_slots` antes de existirem `schedulableServices` e `availabilityRules`, divergindo da arquitetura `direct_contact`.

## 4. Routing multiunidade não resolve destinos válidos

- **Severidade:** crítica
- **Frequência:** 1/5
- **Impacto:** pedido e contato por unidade não chegam a nenhum dos quatro WhatsApps.
- **Evidência:** `/api/public/routing/resolve` retornou 404 após bairro/unidade; a UI declarou não haver destino seguro.
- **Possível causa:** locais e canais foram extraídos, mas regras de routing materializadas não ligam as respostas do formulário aos IDs de destino.

## 5. Reserva externa vira fluxo nativo incompleto

- **Severidade:** alta
- **Frequência:** 1/5
- **Impacto:** o caminho central do hotel fica bloqueado e confunde o usuário sobre quem controla disponibilidade.
- **Evidência:** arquitetura `direct_external`; runtime pede entrada/saída sem renderizar os controles e não chega ao booking.
- **Possível causa:** semântica `reserve` aciona automaticamente scaffold de capability de reserva, sobrepondo a estratégia externa definida na arquitetura.

## 6. Estado de uma jornada vaza para outra

- **Severidade:** alta
- **Frequência:** 1/5
- **Impacto:** o comercial recebe contexto incorreto e pode atender pelo canal errado.
- **Evidência:** bairro e unidade de Viva Natural apareceram na mensagem B2B e de evento após troca de objetivo.
- **Possível causa:** respostas mantidas em store compartilhado por sessão/página, sem namespace ou reset por journey/intent.

## 7. Destino/CTA verificado pode não acompanhar a escolha atual

- **Severidade:** alta
- **Frequência:** 1/5 confirmado; risco transversal na prévia
- **Impacto:** o administrador aprova um caminho acreditando que ele usa outro destino.
- **Evidência:** painel da Viva Natural permaneceu em `Atendimento comercial B2B`/WhatsApp 2200 ao testar cardápio e outros objetivos; evento terminou em 1101.
- **Possível causa:** resolução baseada na ação primária/default ou estado anterior, não na journey ativa.

## 8. Primeira página é um seletor genérico, não uma proposta comercial

- **Severidade:** alta
- **Frequência:** 5/5
- **Impacto:** baixa confiança e menor conversão antes de o visitante fornecer dados.
- **Evidência:** headline repetida `O que você deseja fazer hoje?`; pouca explicação de quartos, tratamentos, diferenciais da consultoria ou critérios de compra.
- **Possível causa:** composição prioriza `conversionGoals` e chooser, mas não materializa ofertas/provas/benefícios suficientes na página inicial.

## 9. Blockers não correspondem ao runtime final

- **Severidade:** alta
- **Frequência:** 2/5
- **Impacto:** pergunta duplicada em um caso e ausência de dados operacionais críticos em outro.
- **Evidência:** dois campos para o mesmo cardápio; zero perguntas de serviço/duração/disponibilidade antes de criar scheduling vazio.
- **Possível causa:** requisitos são derivados da arquitetura revisada, enquanto scaffolds posteriores podem introduzir capabilities adicionais.

## 10. Lógica explícita por vertical reduz a generalidade

- **Severidade:** média
- **Frequência:** transversal
- **Impacto:** comportamento e visual podem parecer bons nos nichos conhecidos e degradar em categorias novas; dificulta distinguir inteligência real de defaults treinados no produto.
- **Evidência:** regex e `if` para hotel, clínica/saúde, restaurante/sucos e pet em analisador, shape e visual composer.
- **Possível causa:** fallbacks determinísticos foram expandidos por exemplos de nicho em vez de serem expressos apenas por atributos universais como oferta, capacidade, canal e risco.

# O que NÃO deve ser alterado

- A etapa `Entendi seu negócio assim` é clara, compacta e útil para confirmação.
- A extração de canais e normalização de telefones funcionou bem nos cinco casos.
- A separação entre fatos, inferências e destinos preservou o contexto fornecido e não inventou preço, depoimento ou resultado clínico.
- A arquitetura da Viva Natural reconheceu corretamente quatro unidades, B2B separado, cardápio externo, pedido e encomenda.
- Elevare e Prime Motors provam que a IA consegue inferir qualificação sem o usuário falar em funil ou formulário.
- O hotel foi conceitualmente direcionado ao booking externo, preservando a fonte real de disponibilidade.
- A clínica recebeu tratamento visual coerente e legível a partir de uma logo simples.
- A opção de contato direto funciona como escape sensato ao lado de jornadas guiadas.
- A prévia informa explicitamente que nenhuma mensagem real será enviada, o que é bom para revisão segura.
- Os projetos permaneceram como rascunho; nenhuma publicação automática ocorreu.

# Recomendação

**C. Ainda existe problema estrutural na Activation.**

Não iniciar beta com usuários reais nesta versão. A arquitetura conceitual pode continuar considerada fechada, mas a camada de materialização/runtime ainda não preserva seu contrato. A próxima rodada deve ser curta e focada em quatro gates objetivos antes de repetir estes mesmos testes, sem criar tratamentos por nicho:

1. Finalização idempotente e concluída em 5/5 casos.
2. Cada `steps.collects` relevante da arquitetura precisa aparecer no runtime ou ser substituído por uma composição explicitamente equivalente e verificável.
3. Nenhuma capability operacional pode ser exibida sem backing; nesse caso, deve virar blocker real ou handoff externo/humano.
4. Estado e destino precisam ser isolados por jornada, com routing multiunidade coberto ponta a ponta.

Somente depois desses gates a recomendação pode mudar para **B. fazer uma rodada curta de correções** rumo a beta. Hoje, o risco não é acabamento: é a quebra entre a inteligência que a Sobe mostra e a experiência que realmente entrega.
