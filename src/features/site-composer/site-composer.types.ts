import type { PresencePageType, PresenceSectionType } from "@/features/presence/presence.types";

export type CatalogPresentationStrategy =
  | "inline_all"
  | "featured_then_catalog"
  | "categories_then_catalog"
  | "search_first";

export interface BusinessShape {
  model: "product" | "service" | "mixed" | "hospitality" | "professional" | "b2b" | "local" | "unknown";
  productCount: number;
  serviceCount: number;
  locationCount: number;
  hasPortfolio: boolean;
  hasTestimonials: boolean;
  hasPricing: boolean;
  hasCatalog: boolean;
  hasScheduling: boolean;
  hasReservation: boolean;
  hasQualification: boolean;
  hasMultipleGoals: boolean;
  primaryGoalTypes: string[];
}

export interface SuggestedSection {
  sectionType: PresenceSectionType;
  purpose: string;
  suggestedContent: Record<string, unknown>;
  sourceBindings: string[];
  conversionGoalId?: string;
  priority: "essential" | "recommended" | "optional";
  reasoning: string;
}

export type SiteComposerIntent =
  | "suggest_structure"
  | "create_page"
  | "add_section"
  | "reorganize"
  | "improve_cta"
  | "focus_offer"
  | "create_landing";

export interface SuggestedPage {
  type: PresencePageType;
  name: string;
  purpose: string;
  pathSuggestion: string;
  conversionGoalId?: string;
  sections: SuggestedSection[];
}

export interface SuggestedSiteStructure {
  reasoning: string;
  pages: SuggestedPage[];
  primaryConversionGoals: string[];
  catalogStrategy: CatalogPresentationStrategy;
  contentStrategy: string[];
  visualDirection: string[];
  warnings: string[];
}

export type SiteOperation =
  | { id: string; type: "add_section"; pageId: string; section: SuggestedSection; at?: number }
  | { id: string; type: "remove_section"; pageId: string; sectionId: string }
  | { id: string; type: "move_section"; pageId: string; sectionId: string; to: number }
  | { id: string; type: "update_section"; pageId: string; sectionId: string; patch: Record<string, unknown> }
  | { id: string; type: "add_page"; page: SuggestedPage }
  | { id: string; type: "rename_page"; pageId: string; name: string }
  | { id: string; type: "connect_goal"; pageId: string; sectionId?: string; conversionGoalId: string };

export interface SiteStructureProposal {
  proposalId: string;
  projectId: string;
  expectedVersion: number;
  target: "site" | "page";
  pageId?: string;
  suggestion: SuggestedSiteStructure;
  operations: SiteOperation[];
  createdAt: string;
  status: "pending" | "applied" | "dismissed" | "outdated";
  instruction?: string;
  usedAI?: boolean;
}

export interface CatalogStrategyThresholds {
  inlineMax: number;
  featuredMax: number;
  categoriesMax: number;
}
