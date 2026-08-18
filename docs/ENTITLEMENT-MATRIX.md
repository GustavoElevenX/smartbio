# Entitlement enforcement matrix

Commercial truth: the only public paid offer is `pro` (**SOBE Pro**, R$ 69,90/month). New workspaces receive `trial`; its seven-day clock begins in `finalizeProject` after the first generated structure is persisted. An expired assignment disables every entitlement and all public project reads, while authenticated dashboard access remains available.

| Feature | Endpoint/action | Enforcement |
|---|---|---|
| projects | `POST /api/projects/compose` | capacity |
| presence_pages | `POST /api/projects/:id/presence` | capacity |
| activations | `POST /api/projects/:id/activations` | boolean |
| active_activations | `POST /api/projects/:id/activations/:id/publish` | capacity |
| customer_history_import | `POST /api/projects/:id/customer-history/import` | boolean |
| benefit_validators | `POST /api/projects/:id/validators` | boolean |
| ai_activation | `POST /api/ai/projects/:id/activations/compose` | boolean |

UI gates are informational. The server is authoritative and returns `entitlement_required` or `plan_limit_reached`.
