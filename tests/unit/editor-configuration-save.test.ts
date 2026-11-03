import { beforeEach, expect, it, vi } from "vitest";
import { casaDeSucos } from "@/data/demo-projects";

const state = vi.hoisted(() => ({ existing: null as Record<string, unknown> | null, previous: {} as Record<string, unknown>, rpc: vi.fn(), upsert: vi.fn(), upsertResponses: [] as Array<{ error: Record<string, unknown> | null }> }));
vi.mock("@/server/http/with-authenticated-actor", () => ({ withAuthenticatedActor: (handler: (...args: unknown[]) => unknown) => (request: Request, context: unknown) => handler(request, context, { persistence: "database", workspaceId: "demo-workspace", userId: "owner", mode: "workspace" }) }));
vi.mock("@/server/auth/project-access", () => ({ assertProjectAccess: vi.fn() }));
vi.mock("@/server/entitlements/require-entitlement", () => ({ requireResourceCapacity: vi.fn() }));
vi.mock("@/server/projects/load-project-for-actor", () => ({ loadProjectForActor: vi.fn() }));
vi.mock("@/server/platform-acquisition/platform-acquisition", () => ({ recordPlatformGrowthEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({
  rpc: state.rpc,
  from: (table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.existing, error: null }) }) }),
    upsert: async (data: unknown) => { state.upsert(table, data); return state.upsertResponses.shift() || { error: null }; },
  }),
}) }));
import { PUT } from "@/app/api/projects/[projectId]/route";

beforeEach(() => {
  vi.clearAllMocks();
  state.previous = { version: 8, projectPayload: casaDeSucos };
  state.existing = { id: casaDeSucos.id, settings: state.previous };
  state.upsertResponses = [];
  state.rpc.mockResolvedValue({ data: { version: 9 }, error: null });
});

async function save(project: typeof casaDeSucos) {
  return PUT(new Request(`https://sobe.test/api/projects/${project.id}`, { method: "PUT", body: JSON.stringify(project) }), { params: Promise.resolve({ projectId: project.id }) });
}

it("salva alterações comerciais pela transação e devolve a versão confirmada", async () => {
  const project = structuredClone(casaDeSucos);
  project.commercialConfig = { ...project.commercialConfig, paymentUrl: "https://checkout.example.org/pay" };
  const response = await save(project);
  expect(response.status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith("save_project_commercial_data", expect.objectContaining({ p_project_id: project.id, p_payload: expect.objectContaining({ expectedProjectVersion: 8, data: project.commercialConfig }) }));
  expect((await response.json()).data.version).toBe(9);
});

it("não informa sucesso nem sobrescreve o rascunho quando a transação falha", async () => {
  state.rpc.mockResolvedValue({ error: { message: "database failure" } });
  const response = await save({ ...casaDeSucos, commercialConfig: { ...casaDeSucos.commercialConfig, paymentUrl: "https://checkout.example.org/pay" } });
  expect(response.status).toBe(500);
  expect(state.upsert).not.toHaveBeenCalled();
});

it("edição de texto preserva a versão atual sem regravar dados comerciais", async () => {
  const response = await save({ ...casaDeSucos, name: "Novo título" });
  expect(response.status).toBe(200);
  expect(state.rpc).not.toHaveBeenCalled();
  expect((await response.json()).data.version).toBe(8);
});

it("criação reserva um slug alternativo quando o nome já está em uso", async () => {
  state.existing = null;
  const project = { ...casaDeSucos, id: "10000000-0000-4000-8000-000000000001", slug: "casa-de-sucos" };
  state.upsertResponses = [
    { error: { code: "23505", message: "duplicate key value violates unique constraint projects_slug_key", details: "Key (slug)=(casa-de-sucos) already exists." } },
    { error: null },
  ];

  const response = await save(project);
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(payload.data.slug).toBe(`casa-de-sucos-${project.id.slice(0, 8)}`);
  expect(state.upsert).toHaveBeenNthCalledWith(2, "projects", expect.objectContaining({ slug: payload.data.slug }));
  expect(state.upsert).toHaveBeenNthCalledWith(3, "brand_profiles", expect.any(Object));
});
