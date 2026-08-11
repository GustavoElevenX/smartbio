import type { ConversionGoal, Project } from "@/types";
import { backfillConversionGoals } from "./utils";

export const conversionGoalRepository = {
  list(project: Project): ConversionGoal[] { return backfillConversionGoals(project); },
  find(project: Project, id: string) { return backfillConversionGoals(project).find((goal) => goal.id === id && goal.isActive); },
};
