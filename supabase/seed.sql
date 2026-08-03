-- Rode depois de criar ao menos um usuário. O seed usa o primeiro workspace disponível.
do $$
declare ws uuid; mix uuid := '10000000-0000-4000-8000-000000000001'; vertice uuid := '20000000-0000-4000-8000-000000000001';
declare mix_intent uuid := '11000000-0000-4000-8000-000000000001'; mix_receive uuid := '11000000-0000-4000-8000-000000000002'; mix_unit uuid := '11000000-0000-4000-8000-000000000003'; mix_products uuid := '11000000-0000-4000-8000-000000000004';
declare v_intent uuid := '21000000-0000-4000-8000-000000000001'; v_form uuid := '21000000-0000-4000-8000-000000000002'; v_result uuid := '21000000-0000-4000-8000-000000000003'; v_action uuid := '21000000-0000-4000-8000-000000000004';
begin
  select id into ws from public.workspaces order by created_at limit 1;
  if ws is null then raise notice 'Seed SmartBio ignorado: crie um usuário primeiro.'; return; end if;
  insert into public.projects(id, workspace_id, name, slug, description, status, primary_goal, category, theme, settings, published_at) values
    (mix, ws, 'Casa de Sucos Mix', 'casadesucosmix', 'Sucos naturais, saladas de frutas e combos preparados na hora.', 'published', 'Receber pedidos', 'Alimentação', '{"mode":"light","colors":{"primary":"#E62E2D","secondary":"#FFD33D","accent":"#FF7A1A","background":"#FFF8EF","surface":"#FFFFFF","foreground":"#2B1712"}}', '{"phone":"5511999991001","visualDirection":"Composição vibrante"}', now()),
    (vertice, ws, 'Vértice B2B', 'vertice', 'Estratégia de crescimento para empresas B2B.', 'published', 'Gerar leads', 'Agência B2B', '{"mode":"dark","colors":{"primary":"#FF6A00","secondary":"#FFB066","accent":"#F4F4F5","background":"#090909","surface":"#151515","foreground":"#FAFAFA"}}', '{"phone":"5511988884004","visualDirection":"Fundo escuro premium"}', now())
  on conflict (id) do update set workspace_id = excluded.workspace_id;
  insert into public.brand_profiles(project_id, extracted_colors, active_palette, palette_variations, design_system, brand_personality, analysis_metadata, analyzed_at) values
    (mix, '["#E62E2D","#FFD33D","#FF7A1A"]', '{"primary":"#E62E2D","secondary":"#FFD33D","accent":"#FF7A1A","background":"#FFF8EF","surface":"#FFFFFF","foreground":"#2B1712"}', '[]', '{"shape":{"cardRadius":26,"buttonRadius":99},"cards":{"style":"elevated"}}', '["Vibrante","Orgânica"]', '{"confidence":0.94}', now()),
    (vertice, '["#FF6A00","#F4F4F5","#101010"]', '{"primary":"#FF6A00","secondary":"#FFB066","accent":"#F4F4F5","background":"#090909","surface":"#151515","foreground":"#FAFAFA"}', '[]', '{"shape":{"cardRadius":18,"buttonRadius":12},"cards":{"style":"glass"}}', '["Premium","Tecnológica"]', '{"confidence":0.96}', now())
  on conflict (project_id) do nothing;
  insert into public.journey_steps(id, project_id, type, title, description, step_order, settings) values
    (mix_intent, mix, 'choice', 'O que você quer fazer hoje?', 'A gente te leva para o melhor próximo passo.', 0, '{"visualVariant":"fruit-hero"}'),
    (mix_receive, mix, 'choice', 'Como deseja receber?', 'Escolha o que combina com seu momento.', 1, '{"visualVariant":"delivery-split"}'),
    (mix_unit, mix, 'content', 'A unidade mais rápida para você', 'Golden Shopping • 12 min • aberta agora.', 2, '{"visualVariant":"map-card"}'),
    (mix_products, mix, 'action', 'O sabor que combina com hoje', 'Suco natural, salada de frutas ou combo do dia.', 3, '{"visualVariant":"product-showcase"}'),
    (v_intent, vertice, 'choice', 'O que você quer destravar no seu negócio?', 'A gente te leva para o melhor próximo passo.', 0, '{"visualVariant":"signal-grid"}'),
    (v_form, vertice, 'form', 'Vamos entender o seu momento.', 'Negócio, investimento, objetivo e contato.', 1, '{"visualVariant":"terminal-form"}'),
    (v_result, vertice, 'recommendation', 'Esse é o melhor próximo passo.', 'Tráfego Pago + Social Media.', 2, '{"benefits":["mais leads qualificados","mais autoridade","mais previsibilidade"],"deliverables":["estratégia","criação","otimização","acompanhamento"]}'),
    (v_action, vertice, 'action', 'Escolha como quer continuar.', 'Agende, fale no WhatsApp ou receba uma proposta.', 3, '{"slots":["Hoje 15:30","Amanhã 10:00","Amanhã 14:00","Quinta 09:30","Quinta 16:00"]}')
  on conflict (id) do nothing;
  insert into public.step_options(step_id, label, description, icon, value, option_order, action_type, target_step_id, action_payload) values
    (mix_intent, 'Pedir agora', 'Delivery ou retirada', 'ShoppingBag', 'pedido', 0, 'go_to_step', mix_receive, '{}'),
    (mix_intent, 'Ver cardápio', 'Conheça os favoritos', 'BookOpen', 'cardapio', 1, 'go_to_step', mix_products, '{}'),
    (mix_intent, 'Encontrar unidade', 'A mais perto de você', 'MapPin', 'unidade', 2, 'go_to_step', mix_unit, '{}'),
    (mix_intent, 'Comprar para minha empresa', 'Condições para negócios', 'Building2', 'empresa', 3, 'open_whatsapp', null, '{"phone":"5511999992002"}'),
    (mix_receive, 'Delivery', 'Receba onde estiver', 'Bike', 'delivery', 0, 'go_to_step', mix_unit, '{}'),
    (mix_receive, 'Retirada', 'Passe e pegue sem fila', 'Store', 'retirada', 1, 'go_to_step', mix_unit, '{}'),
    (mix_unit, 'Ver produtos', null, 'ArrowRight', 'produtos', 0, 'go_to_step', mix_products, '{}'),
    (mix_products, 'Continuar pedido', null, 'ArrowRight', 'continuar', 0, 'open_whatsapp', null, '{"phone":"5511999991001"}'),
    (v_intent, 'Gerar mais leads', 'Crie demanda previsível', 'Target', 'leads', 0, 'go_to_step', v_form, '{}'),
    (v_intent, 'Melhorar redes sociais', 'Construa autoridade', 'LineChart', 'social', 1, 'go_to_step', v_form, '{}'),
    (v_intent, 'Aumentar vendas', 'Conecte marketing e comercial', 'TrendingUp', 'vendas', 2, 'go_to_step', v_form, '{}'),
    (v_intent, 'Falar com especialista', 'Vá direto ao diagnóstico', 'MessageSquare', 'especialista', 3, 'go_to_step', v_action, '{}'),
    (v_form, 'Ver diagnóstico', null, 'ArrowRight', 'diagnostico', 0, 'show_recommendation', v_result, '{}'),
    (v_result, 'Escolher próximo passo', null, 'ArrowRight', 'acao', 0, 'go_to_step', v_action, '{}'),
    (v_action, 'Confirmar reunião', null, 'CalendarCheck', 'agendar', 0, 'open_url', null, '{"url":"https://cal.com"}'),
    (v_action, 'Falar no WhatsApp', null, 'MessageCircle', 'whatsapp', 1, 'open_whatsapp', null, '{"phone":"5511988884004"}'),
    (v_action, 'Receber proposta', null, 'FileText', 'proposta', 2, 'submit_form', null, '{}')
  on conflict (step_id, option_order) do nothing;
end $$;
