import type { Metadata } from "next";
import { findDemoProject } from "@/data/demo-projects";
import { PublicExperience } from "@/components/public-experience/public-experience";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const project = findDemoProject(slug);
  return { title: project?.name || "Experiência", description: project?.description || "Uma experiência guiada criada com Virou.", robots: project ? { index: true, follow: true } : { index: false, follow: false }, openGraph: { title: project?.name || "Virou", description: project?.description || "Seu melhor próximo passo." } };
}

export default async function PublicProjectPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <PublicExperience slug={slug} />; }
