export type ProjectStatus = "draft" | "published" | "archived";
export type StepType =
  | "welcome"
  | "choice"
  | "form"
  | "content"
  | "recommendation"
  | "action"
  | "thank_you";

export type ActionType =
  | "go_to_step"
  | "open_url"
  | "open_whatsapp"
  | "submit_form"
  | "show_recommendation"
  | "finish";

export type ContentBlockType =
  | "text"
  | "image"
  | "video"
  | "choice_grid"
  | "choice_list"
  | "benefits"
  | "testimonial"
  | "form"
  | "recommendation_card"
  | "cta_group"
  | "location_card"
  | "product_cards"
  | "schedule_slots";

export interface BrandPalette {
  sourceColors: string[];
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  success: string;
  warning: string;
  destructive: string;
  gradientStart?: string;
  gradientEnd?: string;
}

export interface ProjectDesignSystem {
  mode: "light" | "dark" | "auto";
  colors: BrandPalette;
  typography: {
    headingFont: string;
    bodyFont: string;
    headingWeight: number;
    bodyWeight: number;
    scale: "compact" | "standard" | "expressive";
  };
  shape: {
    cardRadius: number;
    buttonRadius: number;
    inputRadius: number;
    borderWidth: number;
  };
  elevation: {
    cardShadow: string;
    floatingShadow: string;
    glowColor?: string;
    glowIntensity?: number;
  };
  spacing: {
    density: "compact" | "balanced" | "spacious";
    sectionGap: number;
    cardGap: number;
  };
  imagery: {
    backgroundAssetId?: string;
    backgroundPosition?: string;
    overlayColor?: string;
    overlayOpacity?: number;
    decorativeStyle?: string;
  };
  motion: {
    transition: "none" | "fade" | "slide" | "scale";
    duration: number;
    cardHover: boolean;
  };
  buttons: {
    style: "solid" | "outline" | "soft" | "glass" | "gradient";
    height: "compact" | "normal" | "large";
    iconPosition: "left" | "right";
  };
  cards: {
    style: "flat" | "outlined" | "elevated" | "glass" | "gradient";
    borderColor?: string;
    surfaceOpacity?: number;
  };
}

export interface StepOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  value: string;
  actionType: ActionType;
  targetStepId?: string;
  actionPayload?: Record<string, string | number | boolean>;
}

export interface FormField {
  id: string;
  label: string;
  key: string;
  type: "text" | "email" | "phone" | "textarea" | "select" | "radio" | "checkbox" | "date" | "url";
  placeholder?: string;
  required: boolean;
  options?: string[];
}

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  variant?: string;
  content?: Record<string, unknown>;
  style?: Record<string, string | number | boolean>;
}

export interface JourneyStep {
  id: string;
  type: StepType;
  title: string;
  description?: string;
  order: number;
  visualVariant?: string;
  options?: StepOption[];
  blocks?: ContentBlock[];
  formFields?: FormField[];
  recommendation?: {
    title: string;
    description: string;
    label?: string;
    benefits: string[];
    deliverables?: string[];
  };
  settings?: Record<string, unknown>;
  isActive: boolean;
}

export interface BrandProfile {
  logoDataUrl?: string;
  lightLogoDataUrl?: string;
  darkLogoDataUrl?: string;
  faviconDataUrl?: string;
  extractedColors: string[];
  activePalette: BrandPalette;
  paletteVariations: Array<{ name: "Fiel" | "Equilibrada" | "Ousada"; palette: BrandPalette }>;
  brandPersonality: string[];
  analysisMetadata?: {
    confidence: number;
    orientation?: "horizontal" | "vertical" | "square";
    luminance?: "light" | "dark" | "mixed";
    colorCount?: number;
  };
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string;
  subtitle: string;
  status: ProjectStatus;
  primaryGoal: string;
  primaryDestination: string;
  category?: string;
  audience?: string;
  phone?: string;
  visualDirection: string;
  designSystem: ProjectDesignSystem;
  brand: BrandProfile;
  steps: JourneyStep[];
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface Lead {
  id: string;
  projectId: string;
  projectName: string;
  sessionId: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  source?: string;
  campaign?: string;
  recommendation?: string;
  answers: Record<string, string>;
  notes?: string;
  createdAt: string;
}

export interface AnalyticsEvent {
  id: string;
  projectId: string;
  visitorId: string;
  sessionId: string;
  eventName:
    | "page_view"
    | "session_started"
    | "step_viewed"
    | "option_clicked"
    | "form_started"
    | "form_submitted"
    | "recommendation_viewed"
    | "cta_clicked"
    | "whatsapp_clicked"
    | "external_link_clicked"
    | "journey_completed";
  stepId?: string;
  optionId?: string;
  metadata?: Record<string, unknown>;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  deviceType?: string;
  createdAt: string;
}

export interface ExperienceCompositionInput {
  businessName: string;
  businessDescription: string;
  primaryGoal: string;
  primaryDestination: string;
  slug: string;
  category?: string;
  audience?: string;
  phone?: string;
  brandPersonality?: string[];
  visualDirection?: string;
  brand?: BrandProfile;
  preferredDensity?: "compact" | "balanced" | "immersive";
  preferredTheme?: "light" | "dark" | "auto";
}
