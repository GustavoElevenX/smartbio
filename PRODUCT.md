<!-- Product context for design and implementation. Keep aligned with VIROU-INFRAESTRUTURA-CONVERSAO-CODEX.md. -->
# Sobe

## Product

Sobe is presence and conversion infrastructure for social traffic. It turns attention into an intentional, measurable journey that ends in an action, commercial opportunity, confirmed conversion, and learning loop.

Presence is not a separate website builder product. It is the presentation layer of the conversion infrastructure.

Core promise: **Sobe não é onde seus links ficam. É onde a intenção vira ação.**

The product serves Brazilian small and medium businesses that receive traffic from Instagram, ads, LinkedIn, QR codes, and other social entry points. It must support multiple business models without niche templates by reusing the existing qualification, quote, scheduling, catalog/order, reservation, routing, payment, analytics, publication, Supabase, and RLS engines.

## Users and jobs

- Business owner or operator: define what visitors want, connect each intent to a journey, publish entry-specific links, receive opportunities, and measure confirmed conversion.
- Visitor: state what they want and reach the right next step with minimal friction.
- Workspace member: configure and analyze only the businesses their workspace can access.

## Product model

- A database `Project` remains the technical aggregate; the UI calls it **Negócio**.
- **Presence** is the branded presentation layer that connects commercial content and calls to action to conversion goals.
- A **Meta de conversão** represents visitor intent and points to the start of a journey.
- An **Entrada** is a publishable URL/QR/campaign context that can preselect a goal and carry attribution.
- A **Jornada** is the existing step graph and capability runtime.
- An **Oportunidade** unifies commercial outcomes produced by forms, quotes, bookings, orders, reservations, and qualified routed contacts without replacing those source records.
- **Analytics de conversão** measures the real macro funnel: Atenção → Intenção → Ação → Oportunidade → Conversão.
- **Sugestões de otimização** are deterministic, evidence-based, thresholded, explanatory, and never auto-published.

## Voice and language

Portuguese (Brazil), direct, useful, confident, and commercially literate. Never claim guaranteed results or automated WhatsApp behavior. Never invent prices, phone numbers, addresses, percentages, growth, or customer facts. Clearly label demo/example data.

## Brand and UI

- User-facing brand: **Sobe**. Internal legacy identifiers may remain for compatibility.
- Visual character: clear editorial hierarchy, warm white surfaces, ink typography, violet as an intentional accent, and restrained coral/green for status.
- Prefer a calm workspace over a wall of interchangeable cards. Use tables, flows, and evidence blocks when they clarify relationships.
- Minimum touch targets: 44px. Keyboard focus, semantic labels, reduced-motion support, empty/loading/error/success states, and responsive layouts are required.
- Public attribution: “Feito com Sobe” and fallback link “Conhecer a Sobe”.

## Guardrails

- Preserve existing capabilities and normalized data; do not introduce niche templates.
- Preview never persists analytics events.
- Explicit UTM parameters override entry defaults; entry attribution overrides referrer/direct fallback.
- Only manually confirmed conversions contribute confirmed value.
- Analytics aggregates server-side in database mode and never returns PII.
- AI may explain evidence, but it does not decide or publish changes.
- Out of scope: WhatsApp Cloud/bots, advanced CRM, ads manager, ERP, stock, new billing, custom domains, statistical A/B tests, email automation, marketplace.
