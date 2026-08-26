<!-- Product context for design and implementation. Keep aligned with VIROU-INFRAESTRUTURA-CONVERSAO-CODEX.md. -->
# Sobe

## Product

Sobe is presence and conversion infrastructure for social traffic. It turns attention into an intentional, measurable journey that ends in an action, commercial opportunity, confirmed conversion, and learning loop.

Presence is not a separate website builder product. It is the presentation layer of the conversion infrastructure.

Core promise: **A SOBE transforma a atenção que sua empresa gera nas redes em uma estrutura digital preparada para levar o cliente à próxima ação.**

The link in bio is one entry point into that structure, not the whole product. Commercial messaging must begin with the lost-attention problem and the next action the business wants to generate, not with a list of tools.

The product serves Brazilian small and medium businesses that receive traffic from Instagram, ads, LinkedIn, QR codes, and other social entry points. It must support multiple business models without niche templates by reusing the existing qualification, quote, scheduling, catalog/order, reservation, routing, payment, analytics, publication, Supabase, and RLS engines.

## Context-first activation

The creation of the first Sobe is context-first. The business owner supplies concrete facts and real sources; Sobe interprets the commercial model, proposes distinct conversion paths, connects the appropriate existing engines, and generates the first structure. The owner confirms the complete interpretation or edits only what is necessary.

Sobe does not use niche templates as the foundation of creation. The Design System and runtime engines are reusable, but each Commercial Architecture is composed from the specific business, its offers, audiences and commercial contexts, visitor intents, real channels, locations, available evidence, and next commercial action. `visitorActions` is a compatibility adapter derived from that architecture, never the strategic input the owner must configure.

## Commercial memory per project

- The Activation session is transient. After confirmation and project materialization, the understanding moves to `ProjectCommercialContext`, a private, versioned, one-to-one project memory.
- Normalized entities remain the operational source of truth. Commercial context references existing offerings, locations, and destinations and stores their semantic relationships instead of duplicating operational records in JSON.
- Precedence is explicit user confirmation, configured operational data, recent official source, user-provided material, AI inference, then system fallback. New inference never silently replaces a confirmed decision.
- Reanalysis and conflicts create auditable proposals that can be accepted or rejected. Operational changes recalculate only affected relationships and journeys.
- `ProjectCommercialContext`, `CommercialArchitecture`, runtime, design, and analytics have separate responsibilities. Changing a palette does not change commercial context; adding a location does not require regenerating the full page.
- Scheduling and reservation claim availability only when backed by trustworthy operational configuration. Otherwise, Sobe opens an external engine or builds a request/handoff without promising confirmation.

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

## Commercial model

- One public plan: **SOBE Pro — R$ 69,90/month**, launch price. Do not show crossed-out prices or promise a lifetime price.
- Public limits: **1 business · 5 published pages · 3 members · 50 AI actions/month**.
- Trial: **7 days, no card**, 1 published page, 1 member and 10 AI actions total. Logo color extraction, brand identity, journey, lead capture and analytics remain available; “Feito com SOBE” is required.
- The trial clock starts only after onboarding is completed and the first structure is generated. Before that, the workspace is active but has no expiration date.
- After expiration, the dashboard and saved structure remain available while public pages and their public actions are disabled. Trial data is retained for 30 days for reactivation.
- Customer-facing language says **AI actions**, never requests, tokens or generations. One intentional customer action equals one AI action.
- Internal fair-use guardrails: about 100 MB/workspace, 1,000 new leads/month and 10,000 tracked visits/month. These are operational protections, not sales-page copy.

## Brand and UI

- User-facing brand: **Sobe**. Internal legacy identifiers may remain for compatibility.
- Visual character: clear editorial hierarchy, off-white `#F7F8FA` canvas, navy `#07172F` typography and structural surfaces, Sobe blue `#0054FC` for primary action/focus, and turquoise/cyan `#02E5CD` / `#01D2DF` for energy, progress, and selected moments.
- The proprietary brand gradient is `#02E5CD → #01D2DF → #0186FC → #0054FC`. Use it as a signature on rules, ambient fields, and high-impact brand moments; keep operational controls solid and accessible.
- Preserve semantic red, amber, and green for error, warning, and success. Do not reuse brand colors to blur those meanings.
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
