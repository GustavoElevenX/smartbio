import { Badge } from "@/components/ui/badge";
import type { BusinessSource } from "@/types";

export function ProjectFactsSummary({ sources }: { sources: BusinessSource[] }) {
  const processed = sources.filter((source) => source.status === "processed").length;
  const facts = sources.reduce((total, source) => total + Number(source.extractedData.factCount || 0), 0);
  return <div className="flex flex-wrap gap-2"><Badge variant="secondary">{sources.length} fontes</Badge><Badge variant="secondary">{processed} processadas</Badge><Badge variant="secondary">{facts} fatos extraídos</Badge></div>;
}
