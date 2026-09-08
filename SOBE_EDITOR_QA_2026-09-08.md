# Validação do editor e da jornada Viver Natural — 08/09/2026

## Onde visualizar

- Editor: https://appsobe.vercel.app/app/projects/4bf0c117-1eb2-4468-a0c6-32220ddd244e/editor
- Central de Dados: https://appsobe.vercel.app/app/projects/4bf0c117-1eb2-4468-a0c6-32220ddd244e/data

O projeto continua como rascunho. O cardápio foi configurado com https://cardapiocsm.netlify.app/. Os telefones ainda são os de QA e precisam ser substituídos pelos contatos reais antes do lançamento dessa página.

## Jornada configurada

Comprar para empresa ou revenda agora abre três perguntas: finalidade, produtos e quantidade aproximada. Depois apresenta o próximo passo e prepara o contato comercial com as respostas. A jornada de unidades permite escolher a unidade; a de eventos coleta os detalhes do pedido. Nenhuma mensagem de WhatsApp foi enviada durante os testes.

## Correções e evidência

- Prévia acompanha a etapa selecionada, permite rolagem interna e reinício; o modo Bio permite percorrer a jornada completa.
- Tipo, título, campos e opções ficam acessíveis no painel. Etapas duplicadas recebem identificadores novos; exclusão protege referências de objetivos.
- Salvamento automático serializado, com tentativa novamente em caso de erro e preservação da versão confirmada.
- Configuração comercial usa a função transacional do banco. Corrigida a ambiguidade SQL de quote_definition_id no banco online.
- Requisitos antigos sem origem deixam de bloquear a validação, sem atribuir uma origem fictícia.

Testes automatizados do editor passaram em desktop e Pixel 7: selecionar etapa, editar título, recarregar e conferir persistência, rolar a prévia, alternar Rápido/Avançado e abrir a configuração de qualificação. Arquivo: tests/e2e/journey-editor.spec.ts.

Testes unitários adicionais passaram: três cenários de persistência comercial e um de origem ausente. Arquivos: tests/unit/editor-configuration-save.test.ts e tests/unit/commercial-requirement-origin.test.ts. Typecheck passou após a última correção.

Na conferência online anterior, o editor mostrou 11 etapas, o formulário B2B mostrou as três perguntas e a análise de publicação informou 100% de prontidão. Não foi acionado Publicar agora. O último reteste autenticado da Central de Dados permanece pendente porque o navegador conectado deixou de estar disponível na sessão.

Essas verificações demonstram funcionamento dos cenários descritos; não medem vendas reais nem garantem uma taxa de conversão.
