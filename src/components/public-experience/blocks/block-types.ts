import type { MutableRefObject } from "react";
import type {
  AnalyticsEventName,
  ContentBlock,
  JourneyRuntimeState,
  Project,
} from "@/types";

export interface BlockRendererProps {
  block: ContentBlock;
  project: Project;
  runtime: JourneyRuntimeState;
  setRuntime: React.Dispatch<React.SetStateAction<JourneyRuntimeState>>;
  mediaFilesRef: MutableRefObject<File[]>;
  emit: (name: AnalyticsEventName, metadata?: Record<string, unknown>) => void;
}

export type BlockRenderer = React.ComponentType<BlockRendererProps>;
