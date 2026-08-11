import type { EntryPoint, Project } from "@/types";
export const entryPointRepository = { list: (project: Project): EntryPoint[] => project.entryPoints || [], find: (project: Project, key: string) => project.entryPoints?.find((entry) => entry.key === key && entry.isActive) };
