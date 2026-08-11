import { ConversionMap } from "./conversion-map";
import { DestinationSummary } from "./destination-summary";
import type { Project } from "@/types";
export function ConversionOverview({ project }: { project: Project }) { return <section><div className="grid gap-4 xl:grid-cols-[1fr_240px]"><ConversionMap project={project} /><DestinationSummary project={project} /></div></section>; }
