import type { MutableRefObject } from "react";
import type {
  ContentBlock,
  JourneyRuntimeState,
  Project,
} from "@/types";
import type { PublicAnalyticsEventName } from "@/lib/validation/schemas";

export interface BlockRendererProps {
  block: ContentBlock;
  project: Project;
  runtime: JourneyRuntimeState;
  setRuntime: React.Dispatch<React.SetStateAction<JourneyRuntimeState>>;
  mediaFilesRef: MutableRefObject<File[]>;
  emit: (name: PublicAnalyticsEventName, metadata?: Record<string, unknown>) => void;
}

export type BlockRenderer = React.ComponentType<BlockRendererProps>;
