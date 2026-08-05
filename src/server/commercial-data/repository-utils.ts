import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

export function commercialDatabase() {
  const database = createServiceClient();
  if (!database) throw new Error("Supabase não está configurado para persistir dados comerciais.");
  return database;
}

export async function syncProjectRows(table: string, projectId: string, rows: Array<Record<string, unknown>>) {
  const database = commercialDatabase();
  const ids = rows.map((row) => String(row.id));
  let deletion = database.from(table).delete().eq("project_id", projectId);
  if (ids.length) deletion = deletion.not("id", "in", `(${ids.join(",")})`);
  const { error: deleteError } = await deletion;
  if (deleteError) throw new Error(`Não foi possível sincronizar ${table}.`);
  if (!rows.length) return;
  const { error } = await database.from(table).upsert(rows);
  if (error) throw new Error(`Não foi possível salvar ${table}.`);
}
