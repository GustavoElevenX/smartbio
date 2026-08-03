import type { Metadata } from "next";
import { ProjectsList } from "@/components/dashboard/projects-list";
export const metadata: Metadata = { title: "Projetos" };
export default function ProjectsPage() { return <ProjectsList />; }
