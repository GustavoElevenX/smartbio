# QA pós-correções — Activation da Sobe

- Data: 27/08/2026
- Conta: workspace demo informado pelo responsável
- Modo: onboarding real com IA + revisão de lançamento em modo de prévia
- Publicação: não executada

## Veredito

Os três rascunhos finais chegaram a **Pronto para publicar: 3 de 3**, com zero bloqueadores no `getProjectReadiness`. Os testes de conversão confirmaram coleta de contexto, roteamento e destinos. As URLs `.test` e os telefones de QA foram usados apenas como dados controlados; o modo de prévia não enviou mensagens nem abriu destinos externos.

## 1. Viver Natural — Beta Final

- Projeto: `2b3ea2d1-e297-47bb-aab2-5dafd766bf43`
- Slug: `viver-natural-beta-final`
- Prontidão: publicável, 0 bloqueadores
- Intenções: cardápio, contato por unidade, encomenda para evento e B2B/revenda
- Roteamento verificado: Praia resolve para o WhatsApp terminado em `1102`
- Encomenda verificada com: produto/kit, tamanho, quantidade, data do evento e unidade
- Cardápio: `https://vivanatural.test/cardapio`
- UX: sem coordenadas, o visitante escolhe diretamente Centro, Praia, Shopping ou Norte; geolocalização não é prometida

## 2. Elevare — Consultoria Beta

- Projeto: `c8783a91-aa85-4728-a57d-6b031ff0f36e`
- Slug: `elevare-consultoria-beta`
- Prontidão: publicável, 0 bloqueadores
- Qualificação verificada em duas etapas com os oito campos confirmados pelo negócio
- Handoff verificado: resumo completo preparado para o WhatsApp terminado em `3300`
- Não foi criado catálogo ou checkout indevido

## 3. Vila do Mar Hotel — Beta Final

- Projeto: `14ec7d2b-fe30-42ff-a488-f76c5011dea7`
- Slug: `vila-do-mar-hotel-beta-final`
- Prontidão: publicável, 0 bloqueadores
- Reserva verificada com entrada, saída, adultos e crianças
- Conclusão verificada no sistema externo `https://hotelviladomar.test/reservas`
- Não há etapa nativa de disponibilidade, `availabilityRules` ou `reservableUnits`; a Sobe não afirma que há quartos ou valores disponíveis
- Reabertura do modal verificada: a jornada volta ao primeiro passo com estado limpo

## Correções materializadas durante o QA

1. IDs semânticos da arquitetura deixaram de vazar para colunas UUID do runtime.
2. Memória comercial e validador passaram a mapear IDs semânticos para IDs operacionais.
3. Repetição da geração preserva a identidade do rascunho da sessão.
4. Rotas por unidade materializam seletor, regras e destinations compatíveis.
5. Campos gerados usam chaves válidas com `_`, sem hífens.
6. Ofertas são ligadas à jornada correspondente mesmo quando a IA omite o ID explícito na etapa.
7. Produtos sem preço confirmado usam o modo “sob consulta” sem bloquear publicação.
8. Roteamento manual não exige geocodificação; busca por proximidade só aparece quando existem coordenadas.
9. Etapas genéricas de “encaminhamento” para um sistema externo não viram seletor de unidade.
10. Cada abertura do modal de conversão recebe uma instância limpa da jornada.

## Limpeza da conta demo

Os rascunhos intermediários com falhas conhecidas foram arquivados, não excluídos. Permaneceram em rascunho os três projetos finais acima.
