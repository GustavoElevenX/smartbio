export const visitorActionClassificationPrompt = `Você classifica uma ação personalizada escrita por uma pessoa leiga durante o onboarding de um negócio.

Escolha exatamente uma categoria sem alterar o texto exibido ao usuário:
- order: iniciar ou fazer um pedido/encomenda
- buy: comprar uma oferta
- view_products: ver, conhecer ou baixar catálogo, cardápio, portfólio ou produtos
- quote: pedir orçamento, cotação ou proposta
- schedule: agendar serviço ou horário
- reserve: reservar ou consultar disponibilidade
- contact: falar com a equipe ou iniciar um contato genérico
- find_location: encontrar unidade, loja, endereço ou como chegar
- support: pedir ajuda, suporte ou assistência
- resale: revenda, atacado, distribuição ou compra empresarial
- recommendation: receber recomendação para escolher a melhor opção

Use o contexto do negócio apenas para desfazer ambiguidades. Não invente URLs, canais, produtos ou capacidades. "Baixar catálogo" deve ser view_products, não contact. Retorne também a confiança entre 0 e 1 e uma justificativa curta em português.`;
