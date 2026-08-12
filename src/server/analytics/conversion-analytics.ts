import type {
  AnalyticsEvent,
  CommercialOpportunity,
  ConversionGoal,
  EntryPoint,
} from "@/types";
import type { PresencePage } from "@/features/presence/presence.types";
import { buildConversionFunnel } from "@/features/analytics/conversion-funnel";

export function buildConversionAnalytics(input: {
  events: AnalyticsEvent[];
  opportunities: CommercialOpportunity[];
  goals?: ConversionGoal[];
  entries?: EntryPoint[];
  pages?: PresencePage[];
}) {
  const { events, opportunities } = input;
  const sessions = new Set(events.map((event) => event.sessionId));
  const confirmed = opportunities.filter((item) => item.status === "converted");
  const confirmedValue = confirmed.reduce(
    (total, item) => total + (item.confirmedValue || 0),
    0,
  );
  const byGoal = (input.goals || []).map((goal) => ({
    id: goal.id,
    name: goal.name,
    sessions: new Set(
      events
        .filter((event) => event.conversionGoalId === goal.id)
        .map((event) => event.sessionId),
    ).size,
    opportunities: opportunities.filter(
      (item) => item.conversionGoalId === goal.id,
    ).length,
    conversions: confirmed.filter((item) => item.conversionGoalId === goal.id)
      .length,
  }));
  const byEntry = (input.entries || []).map((entry) => ({
    id: entry.id,
    key: entry.key,
    name: entry.name,
    sessions: new Set(
      events
        .filter((event) => event.entryPointId === entry.id)
        .map((event) => event.sessionId),
    ).size,
    opportunities: opportunities.filter(
      (item) => item.entryPointId === entry.id,
    ).length,
    conversions: confirmed.filter((item) => item.entryPointId === entry.id)
      .length,
  }));
  const byPage = (input.pages || []).map((page) => {
    const pageEvents = events.filter(
      (event) => event.presencePageId === page.id,
    );
    const pageOpportunities = opportunities.filter(
      (item) => item.presencePageId === page.id,
    );
    const pageConversions = confirmed.filter(
      (item) => item.presencePageId === page.id,
    );
    const views = new Set(
      pageEvents
        .filter((event) => event.eventName === "presence_page_viewed")
        .map((event) => event.sessionId),
    );
    const intentions = new Set(
      pageEvents
        .filter((event) =>
          ["conversion_goal_selected", "conversion_goal_resolved"].includes(
            event.eventName,
          ),
        )
        .map((event) => event.sessionId),
    );
    const starts = new Set(
      pageEvents
        .filter((event) => event.eventName === "presence_conversion_started")
        .map((event) => event.sessionId),
    );
    return {
      id: page.id,
      key: page.key,
      name: page.name,
      type: page.type,
      views: views.size,
      intentions: intentions.size,
      ctaClicks: new Set(
        pageEvents
          .filter((event) => event.eventName === "presence_cta_clicked")
          .map((event) => event.sessionId),
      ).size,
      conversionStarts: starts.size,
      opportunities: pageOpportunities.length,
      conversions: pageConversions.length,
      confirmedValue: pageConversions.reduce(
        (total, item) => total + (item.confirmedValue || 0),
        0,
      ),
      startRate: views.size
        ? Math.round((starts.size / views.size) * 1000) / 10
        : 0,
    };
  });
  const bySection = (input.pages || []).flatMap((page) =>
    page.sections.map((section) => {
      const sectionEvents = events.filter(
        (event) => event.presenceSectionId === section.id,
      );
      return {
        id: section.id,
        pageId: page.id,
        name: section.title || section.key,
        views: new Set(
          sectionEvents
            .filter((event) => event.eventName === "presence_section_viewed")
            .map((event) => event.sessionId),
        ).size,
        ctaClicks: new Set(
          sectionEvents
            .filter((event) => event.eventName === "presence_cta_clicked")
            .map((event) => event.sessionId),
        ).size,
        conversionStarts: new Set(
          sectionEvents
            .filter(
              (event) => event.eventName === "presence_conversion_started",
            )
            .map((event) => event.sessionId),
        ).size,
      };
    }),
  );
  return {
    sessions: sessions.size,
    opportunities: opportunities.length,
    conversions: confirmed.length,
    confirmedValue,
    funnel: buildConversionFunnel(events, opportunities),
    byGoal,
    byEntry,
    byPage,
    bySection,
  };
}
