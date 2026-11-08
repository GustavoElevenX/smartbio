# SOBE: validação das Fases 1C e 2

## Estado local

- Modo Simples: um comando salva projeto e contexto comercial, informa falha parcial e permite revisar um conflito de revisão 409 antes de mesclar.
- A logo mantém as cores atuais por padrão. Cores sugeridas só são aplicadas quando o usuário marca a opção. A capa só é oferecida para uma página inicial compatível.
- Onboarding: descrição livre, canal principal e destino; revisão da estrutura inferida; rascunho, prévia de caminhos, briefing simulado e publicação explícita.
- Projeto antigo: a versão guiada abre um novo rascunho preenchido com dados do projeto acessível no workspace, preservando o original.

## Verificações locais

Executar `npm run lint`, `npm run typecheck`, `npm test -- --run`, `npm run build -- --webpack` e `npx playwright test tests/e2e/phase2-onboarding.spec.ts tests/e2e/project-settings.spec.ts`.

Os testes E2E locais usam o armazenamento e o provedor de IA de teste. O provedor falso do cenário SonoLeve retorna perguntas genéricas de propósito; o bloqueio de publicação desse cenário confirma a validação de qualidade, não comprova uma proposta real pronta para publicar.

## Validação externa pendente: workspace de teste isolado

Não usar credenciais de produção nem dados de clientes. Preparar um projeto Supabase de teste com usuário e workspace exclusivos. Os scripts de integração exigem `INTEGRATION_TEST_SUPABASE_URL`, `INTEGRATION_TEST_SUPABASE_SERVICE_ROLE_KEY` e `INTEGRATION_TEST_USER_ID`; o teste RLS exige também `RLS_TEST_ALLOW_REMOTE=true` e as variáveis `RLS_TEST_SUPABASE_*` próprias desse projeto.

1. Criar uma SOBE no workspace de teste com pelo menos duas intenções. Salvar no Simples, recarregar e confirmar que projeto e contexto comercial persistiram.
2. Abrir duas abas do mesmo projeto; editar a descrição comercial nas duas. Salvar a primeira e depois a segunda. Confirmar a mensagem de conflito, comparar as revisões, escolher a mesclagem e recarregar. Repetir escolhendo a revisão mais recente.
3. Enviar logo e capa em um projeto com página de presença compatível. Confirmar persistência das imagens após recarga, cores preservadas ao enviar logo sem opção marcada e alteração de cores quando marcada.
4. Testar atendimento, catálogo direto, recomendação e agendamento com destinos reais de teste. Percorrer as jornadas no celular e no desktop, conferir briefing, dados do contato e ausência de preço ou disponibilidade inventados.
5. Publicar **somente** um projeto de teste após checar a proposta e o preflight. Conferir o endereço público, republicação e isolamento entre workspaces.
6. Rodar `npm run test:integration` e, para RLS no projeto autorizado, `npm run test:integration:rls`. Registrar ID do workspace, ambiente, resultado e evidências sem copiar chaves para o repositório.

## Critério para encerrar a Fase 1

Somente marcar a Fase 1 como validada após os passos de persistência, conflito, mídia, isolamento e publicação acima passarem no workspace de teste. As Fases 3 a 5 ficam fora deste trabalho.
