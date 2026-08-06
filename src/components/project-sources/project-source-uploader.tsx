"use client";

import { SourceUploader } from "@/components/ai-setup/source-uploader";

export function ProjectSourceUploader({ projectId, onUploaded }: { projectId: string; onUploaded: () => void }) {
  return <SourceUploader sources={[]} projectId={projectId} onChange={onUploaded} />;
}
