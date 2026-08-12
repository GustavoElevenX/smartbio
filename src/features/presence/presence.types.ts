export type PresencePageType = "home" | "landing" | "page";
export type PublicSurfaceMode = "presence" | "landing" | "conversion_direct";

export type PresenceSectionType =
  | "hero"
  | "rich_text"
  | "benefits"
  | "feature_grid"
  | "services"
  | "products"
  | "about"
  | "stats"
  | "logo_cloud"
  | "gallery"
  | "portfolio"
  | "testimonials"
  | "faq"
  | "pricing"
  | "locations"
  | "contact"
  | "video"
  | "conversion_cta"
  | "divider";

export type PresenceActionType =
  | "start_conversion_goal"
  | "go_to_presence_page"
  | "scroll_to_section"
  | "open_url"
  | "open_whatsapp";

export interface PresenceAction {
  type: PresenceActionType;
  label: string;
  conversionGoalId?: string;
  pageId?: string;
  anchor?: string;
  url?: string;
  whatsappPhone?: string;
  whatsappMessage?: string;
  style?: "primary" | "secondary" | "ghost" | "link";
  analyticsLabel?: string;
}

export interface PresenceSectionStyle {
  background?: "default" | "surface" | "muted" | "primary" | "dark";
  theme?: "default" | "muted" | "brand" | "dark";
  width?: "md" | "lg" | "xl" | "full";
  alignment?: "left" | "center";
  spacing?: "compact" | "normal" | "airy";
  radius?: "none" | "sm" | "md" | "lg";
  mediaTreatment?: "plain" | "rounded" | "frame";
  backgroundAssetId?: string;
  className?: never;
}

export interface PresenceContentMeta { generatedByAI?: boolean; sourceIds?: string[]; verificationStatus?: DataVerificationStatus }

export interface PresencePageSettings {
  header: {
    enabled: boolean;
    sticky: boolean;
    showLogo: boolean;
    showNavigation: boolean;
    primaryAction?: PresenceAction;
  };
  footer: {
    enabled: boolean;
    showLogo: boolean;
    showSocialLinks: boolean;
    showPolicies: boolean;
    showVirouBranding: boolean;
  };
  layout: {
    maxWidth?: "md" | "lg" | "xl" | "full";
    sectionSpacing?: "compact" | "normal" | "airy";
  };
  conversionPresentation: { mode: "overlay" | "replace" };
}

export interface PresenceSection {
  id: string;
  pageId: string;
  key: string;
  type: PresenceSectionType;
  anchor?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  content: Record<string, unknown>;
  style: PresenceSectionStyle;
  settings: Record<string, unknown>;
  order: number;
  isActive: boolean;
}

export interface PresencePage {
  id: string;
  projectId: string;
  key: string;
  name: string;
  type: PresencePageType;
  path: string;
  title?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImageAssetId?: string;
  defaultConversionGoalId?: string;
  isHome: boolean;
  isActive: boolean;
  isIndexable: boolean;
  version?: number;
  settings: PresencePageSettings;
  sections: PresenceSection[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PresenceSite { pages: PresencePage[] }

export interface PresenceLaunchContext {
  goalId?: string;
  entryPointId?: string;
  pageId?: string;
  sectionId?: string;
  catalogItemId?: string;
  serviceId?: string;
  locationId?: string;
}

export type DataVerificationStatus = "unverified" | "confirmed" | "source_verified";
