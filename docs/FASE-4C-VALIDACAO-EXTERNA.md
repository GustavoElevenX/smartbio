# Fase 4C — validação isolada antes da produção

Este plano ainda **não foi executado**. Os testes locais usam dados sintéticos e IA simulada. Nenhum resultado local confirma Supabase real, provedor de IA real ou cache de hospedagem.

## Ambiente e acesso

1. Criar um projeto Supabase **de teste**, sem conexão ou cópia de dados de clientes. Aplicar as migrações de `supabase/migrations` em ordem. Criar um usuário e um projeto sintéticos com uma meta de conversão, uma jornada, destino de WhatsApp de teste e unidade com fuso `America/Manaus`. Preparar uma segunda unidade em `America/Sao_Paulo`. Não colocar números de clientes nem destinos de produção.
2. Guardar as credenciais apenas no gerenciador de segredos do ambiente isolado e no arquivo local ignorado pelo Git. Configurar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` e `NEXT_PUBLIC_PUBLIC_BASE_URL` para os serviços de teste. Não registrar valores de chaves, tokens ou mensagens pessoais na evidência.
3. Para integração, configurar `INTEGRATION_TEST_SUPABASE_URL`, `INTEGRATION_TEST_SUPABASE_SERVICE_ROLE_KEY` e `INTEGRATION_TEST_USER_ID` com **somente** o projeto de teste. Executar `npm run test:integration`. Para políticas de acesso, configurar `RLS_TEST_SUPABASE_URL`, `RLS_TEST_SUPABASE_ANON_KEY`, `RLS_TEST_SUPABASE_SERVICE_ROLE_KEY` e `RLS_TEST_ALLOW_REMOTE=true` **após conferir** o identificador do projeto; executar `npm run test:integration:rls`.
4. Configurar `AI_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL` e `AI_REQUEST_TIMEOUT_MS` para a conta de teste. Desativar `ACTIVATION_GATE_FAKE_AI` nesse ambiente. Usar prompts sintéticos que mencionem um item inexistente e um preço não confirmado; verificar que a proposta pede revisão e não transforma essas menções em fatos da empresa. Repetir sem catálogo e com catálogo sintético.
5. Hospedar um build da branch em projeto e domínio isolados. Configurar as mesmas variáveis de teste, autenticação e recursos necessários, sem apontar para Supabase, WhatsApp ou analytics de produção. Conferir que o domínio isolado é o `NEXT_PUBLIC_APP_URL` e a base pública usada nos metadados.

## Roteiro de aceitação

| Cenário | Evidência a recolher |
| --- | --- |
| Criar campanha Simples sem catálogo, revisar e confirmar | Rascunho, texto aprovado, meta e destino existentes, prévia em celular e desktop |
| Publicar link exclusivo e depois assumir a home | URL exclusiva ativa, `/{slug}` com campanha, `/{slug}?view=standard` com publicação anterior |
| Entrada e página secundária | `?entry=` válido e `/p/{pageKey}` permanecem acessíveis durante takeover |
| Agendar em Manaus e São Paulo | Horário exibido, ISO salvo, início e término observados nos dois fusos |
| Pausar, retomar, expirar e concorrer | Seleção por prioridade, publicação mais recente e ID; retorno automático à experiência padrão |
| Editar campanha publicada | Versão ativa permanece intacta até confirmação de nova publicação |
| Seguir CTA até WhatsApp e Oportunidades | Mesmo `activationId`, versão, `offerId`, campanha, respostas e código do claim no snapshot, briefing, oportunidade e eventos; UTM explícito preservado |
| Declaração versus fato | Resposta do visitante marcada como declaração; preço, compatibilidade, disponibilidade e condição só aparecem como confirmados quando têm fonte empresarial |
| Cache e metadados no host | HTML, título, descrição, OG e canonical mudam conforme a campanha ativa sem servir versão vencida |

Registrar horário UTC e fuso em cada transição, requests e respostas sem segredos, IDs sintéticos e capturas de celular e desktop. Conferir o banco de teste para `conversion_activations.published_snapshot`, `benefit_claims.benefit_snapshot`, `commercial_opportunities` e `analytics_events`. Encerrar as campanhas de teste, remover dados sintéticos e revogar credenciais temporárias ao concluir.

## Critério de conclusão

Marcar a validação real concluída somente após integração Supabase e RLS, execução com IA real, verificação do host isolado e auditoria da cadeia comercial passarem com evidência. Qualquer falha deve produzir correção e nova execução dos cenários afetados antes de liberar produção.
