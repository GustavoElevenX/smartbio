import type { EntryPoint, Project } from "@/types";
import { entryPointSchema } from "./schema";

export function setProjectEntryPoints(project: Project, entries: EntryPoint[]): Project {
  const parsed = entries.map((entry) => entryPointSchema.parse(entry));
  if (new Set(parsed.map((entry) => entry.key)).size !== parsed.length) throw new Error("Cada entrada precisa ter uma chave única.");
  return { ...project, entryPoints: parsed, updatedAt: new Date().toISOString(), version: project.version + 1 };
}
