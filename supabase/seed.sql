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

-- Fixtures de aceitação da camada de conversão (migrações 0003–0008).
do $$
declare ws uuid;
declare cleaning uuid := '30000000-0000-4000-8000-000000000001'; clinic uuid := '40000000-0000-4000-8000-000000000001'; chalet uuid := '50000000-0000-4000-8000-000000000001'; network uuid := '60000000-0000-4000-8000-000000000001';
declare cleaning_step uuid := '31000000-0000-4000-8000-000000000001'; clinic_step uuid := '41000000-0000-4000-8000-000000000001'; chalet_step uuid := '51000000-0000-4000-8000-000000000001'; network_step uuid := '61000000-0000-4000-8000-000000000001';
begin
  select id into ws from public.workspaces order by created_at limit 1;
  if ws is null then raise notice 'Fixtures de conversão ignorados: crie um usuário primeiro.'; return; end if;

  insert into public.projects(id,workspace_id,name,slug,description,status,primary_goal,category,theme,settings,published_at) values
    (cleaning,ws,'LimpaBem Estofados','limpabem','Higienização com orçamento por fotos.','published','Solicitar orçamento','Serviços','{"mode":"light","colors":{"primary":"#176B64","background":"#F4FBFA","surface":"#FFFFFF","foreground":"#15312F"}}','{"phone":"5511977771100","primaryDestination":"Experiência nativa","version":1}',now()),
    (clinic,ws,'Clínica Aurora','clinica-aurora','Consultas por horário.','published','Agendar consulta','Clínica','{"mode":"light","colors":{"primary":"#7C5CFC","background":"#FCFAFF","surface":"#FFFFFF","foreground":"#28213C"}}','{"phone":"5511966662200","primaryDestination":"Experiência nativa","version":1}',now()),
    (chalet,ws,'Chalés Serra Clara','chales-serra-clara','Chalés com disponibilidade por período.','published','Consultar e reservar','Hospedagem','{"mode":"light","colors":{"primary":"#315A45","background":"#F6F1E7","surface":"#FFFCF5","foreground":"#24352C"}}','{"phone":"5512955553300","primaryDestination":"Experiência nativa","version":1}',now()),
    (network,ws,'Rede Movimento','rede-movimento','Rede de academias com roteamento por unidade.','published','Encontrar unidade','Academia','{"mode":"light","colors":{"primary":"#155EEF","background":"#F5F8FF","surface":"#FFFFFF","foreground":"#17243D"}}','{"phone":"5511944444400","primaryDestination":"WhatsApp","version":1}',now())
  on conflict (id) do update set workspace_id = excluded.workspace_id;

  insert into public.brand_profiles(project_id,extracted_colors,active_palette,palette_variations,design_system,brand_personality,analysis_metadata,analyzed_at) values
    (cleaning,'["#176B64","#9AD9D3","#F4FBFA"]','{"primary":"#176B64","background":"#F4FBFA","surface":"#FFFFFF","foreground":"#15312F"}','[]','{}','["Acolhedora","Confiável"]','{"confidence":0.94}',now()),
    (clinic,'["#7C5CFC","#DCCFFF","#FCFAFF"]','{"primary":"#7C5CFC","background":"#FCFAFF","surface":"#FFFFFF","foreground":"#28213C"}','[]','{}','["Humana","Serena"]','{"confidence":0.94}',now()),
    (chalet,'["#315A45","#D6A85F","#F6F1E7"]','{"primary":"#315A45","background":"#F6F1E7","surface":"#FFFCF5","foreground":"#24352C"}','[]','{}','["Natural","Premium"]','{"confidence":0.94}',now()),
    (network,'["#155EEF","#53B1FD","#F5F8FF"]','{"primary":"#155EEF","background":"#F5F8FF","surface":"#FFFFFF","foreground":"#17243D"}','[]','{}','["Energética","Confiável"]','{"confidence":0.94}',now())
  on conflict (project_id) do update set active_palette = excluded.active_palette;

  insert into public.business_profiles(project_id,business_name,description,offer_kinds,primary_intents,confirmation_mode,capacity_kinds,completion_channel,signals) values
    (cleaning,'LimpaBem Estofados','Higienização com fotos',array['service'],array['request_quote'],'manual_approval',array['none'],'native','{"requiresMediaUpload":true,"requiresQualification":true}'),
    (clinic,'Clínica Aurora','Consultas agendadas',array['professional_service'],array['schedule'],'instant',array['time_slot','professional'],'native','{}'),
    (chalet,'Chalés Serra Clara','Hospedagem por período',array['hospitality'],array['check_availability','reserve'],'manual_approval',array['room','daily_capacity'],'native','{"requiresPayment":true}'),
    (network,'Rede Movimento','Academias multiunidade',array['membership','service'],array['visit','contact'],'manual_approval',array['location'],'whatsapp','{"hasMultipleLocations":true}')
  on conflict (project_id) do update set signals = excluded.signals;

  insert into public.project_capabilities(project_id,capability_key,enabled,source) values
    (cleaning,'quote',true,'suggested'),(cleaning,'qualification',true,'suggested'),
    (clinic,'scheduling',true,'suggested'),(chalet,'reservation',true,'suggested'),(network,'routing',true,'suggested')
  on conflict (project_id,capability_key) do update set enabled = excluded.enabled;

  insert into public.journey_steps(id,project_id,type,title,description,step_order,settings) values
    (cleaning_step,cleaning,'quote','O que você quer higienizar?','Escolha o item, quantidade e envie fotos.',0,'{}'),
    (clinic_step,clinic,'schedule','Escolha serviço, data e horário.','A confirmação é imediata.',0,'{}'),
    (chalet_step,chalet,'reservation','Encontre o chalé certo.','Informe período e hóspedes.',0,'{}'),
    (network_step,network,'routing','Onde fica melhor para você?','A recomendação considera sua região.',0,'{}')
  on conflict (id) do nothing;

  insert into public.step_options(step_id,label,value,option_order,action_type,action_payload) values
    (cleaning_step,'Enviar pedido de orçamento','submit',0,'start_capability','{"capability":"quote"}'),
    (clinic_step,'Confirmar agendamento','submit',0,'start_capability','{"capability":"scheduling"}'),
    (chalet_step,'Solicitar reserva','submit',0,'start_capability','{"capability":"reservation"}'),
    (network_step,'Encontrar melhor unidade','submit',0,'start_capability','{"capability":"routing"}')
  on conflict (step_id,option_order) do nothing;

  insert into public.content_blocks(project_id,step_id,block_type,block_order,content) values
    (cleaning,cleaning_step,'service_selector',0,'{"fieldKey":"servico","options":["Sofá","Colchão","Cadeiras"]}'),
    (cleaning,cleaning_step,'quantity_selector',1,'{"fieldKey":"quantidade","min":1,"max":12}'),
    (cleaning,cleaning_step,'media_upload',2,'{"fieldKey":"fotos","maxFiles":4,"required":false}'),
    (cleaning,cleaning_step,'price_estimate',3,'{}'),
    (clinic,clinic_step,'service_selector',0,'{"fieldKey":"service","options":["Nutrição","Psicologia"]}'),
    (clinic,clinic_step,'calendar',1,'{}'),(clinic,clinic_step,'schedule_slots',2,'{}'),
    (chalet,chalet_step,'date_range',0,'{}'),(chalet,chalet_step,'guest_selector',1,'{}'),(chalet,chalet_step,'reservable_unit_cards',2,'{}'),
    (network,network_step,'location_selector',0,'{"fieldKey":"regiao","options":["Zona Sul","Centro","Zona Norte"]}'),(network,network_step,'route_result',1,'{}')
  on conflict (step_id,block_order) do nothing;

  insert into public.quote_definitions(id,project_id,name,currency,base_price,is_active,settings) values ('30000000-0000-4000-8000-000000000301',cleaning,'Orçamento de higienização','BRL',90,true,'{"estimationMode":"range"}') on conflict (project_id) do nothing;
  insert into public.schedulable_services(id,project_id,name,duration_minutes,buffer_after_minutes,confirmation_mode,is_active) values ('40000000-0000-4000-8000-000000000401',clinic,'Consulta de nutrição',50,10,'instant',true) on conflict (id) do nothing;
  insert into public.availability_rules(project_id,weekday,starts_at,ends_at,timezone) select clinic,weekday,'08:00','18:00','America/Sao_Paulo' from generate_series(1,5) weekday on conflict do nothing;
  insert into public.reservable_units(id,project_id,name,description,capacity_adults,capacity_children,quantity,base_price,currency,is_active,amenities) values ('50000000-0000-4000-8000-000000000501',chalet,'Chalé Vista','Varanda e vista para a serra',2,1,2,520,'BRL',true,array['Café da manhã','Lareira','Hidromassagem']) on conflict (id) do nothing;
  insert into public.routing_destinations(id,project_id,label,channel,value) values
    ('60000000-0000-4000-8000-000000000601',network,'Unidade Zona Sul','whatsapp','5511944444401'),
    ('60000000-0000-4000-8000-000000000602',network,'Unidade Centro','whatsapp','5511944444402'),
    ('60000000-0000-4000-8000-000000000603',network,'Unidade Zona Norte','whatsapp','5511944444403') on conflict (id) do nothing;
end $$;
