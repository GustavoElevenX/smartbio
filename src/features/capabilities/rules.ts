import type { RuleCondition } from "@/types";

function comparable(value: unknown) {
  if (typeof value === "string") return value.trim().toLocaleLowerCase("pt-BR");
  return value;
}

export function evaluateCondition(condition: RuleCondition, values: Record<string, unknown>) {
  const actual = values[condition.field];
  const expected = condition.value;
  switch (condition.operator) {
    case "equals":
      return comparable(actual) === comparable(expected);
    case "contains":
      if (Array.isArray(actual)) return actual.some((value) => comparable(value) === comparable(expected));
      return String(actual ?? "").toLocaleLowerCase("pt-BR").includes(String(expected).toLocaleLowerCase("pt-BR"));
    case "greater_than":
      return Number(actual) > Number(expected);
    case "less_than":
      return Number(actual) < Number(expected);
  }
}
