# Entitlement enforcement matrix

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
