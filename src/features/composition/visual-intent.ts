import type { ExperienceCompositionInput } from "@/types";

/** Art direction follows supplied intent, never a random variation of a name. */
export function resolveVisualIntent(input: Pick<ExperienceCompositionInput, "visualDirection" | "brandPersonality">) {
  const fromText = (value: string) => {
  const text = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/minimal|discret|essencial|sobri/.test(text)) return "essential";
  if (/editorial|elegan|sofistic|premium/.test(text)) return "editorial";
  if (/natural|organic|acolhed|artesanal|humana/.test(text)) return "organic";
  if (/expressiv|vibran|ousad|criativ|energi/.test(text)) return "expressive";
  return undefined;
  };
  return fromText(input.visualDirection || "") || fromText((input.brandPersonality || []).join(" ")) || "clear";
}
