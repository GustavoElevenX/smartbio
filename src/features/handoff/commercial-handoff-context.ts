export interface CommercialHandoffContext {
  projectId: string;
  conversionGoalId?: string;
  opportunityId?: string;
  origin: {
    entryPointId?: string;
    source?: string;
    campaign?: string;
    pageId?: string;
    activationId?: string;
  };
  identity: {
    name?: string;
    phone?: string;
    email?: string;
  };
  intent: {
    label?: string;
    productIds?: string[];
    serviceIds?: string[];
    locationId?: string;
  };
  qualification: Array<{
    label: string;
    value: string;
    include: boolean;
  }>;
  benefit?: {
    label?: string;
    code?: string;
  };
}
