export interface OperationalTotals {
  sessions: number;
  intentions: number;
  actions: number;
  externalActions: number;
  opportunities: number;
  conversions: number;
  confirmedValue: number;
}

export interface OperationalProject extends OperationalTotals {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published";
  publishedAt?: string;
  updatedAt: string;
  publicUrl: string;
}

export interface WorkspaceOperationalOverview {
  periodStart: string;
  periodEnd: string;
  hasPreviousVisit: boolean;
  totals: OperationalTotals;
  projects: OperationalProject[];
  learnings: Array<{ id: string; statement: string; evidence: string }>;
}

export const EMPTY_OPERATIONAL_TOTALS: OperationalTotals = {
  sessions: 0,
  intentions: 0,
  actions: 0,
  externalActions: 0,
  opportunities: 0,
  conversions: 0,
  confirmedValue: 0,
};
