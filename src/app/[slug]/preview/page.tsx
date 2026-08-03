import { PublicExperience } from "@/components/public-experience/public-experience";
export default async function PreviewPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <PublicExperience slug={slug} preview />; }
