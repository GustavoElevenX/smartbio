import type { SetupQuestion } from "@/features/ai-setup/ai-setup.schema";

export type AdaptiveQuestionSuggestion = {
  displayText: string;
  visibleLines: string[];
  submission: NonNullable<SetupQuestion["structuredAnswer"]> | string;
  structured: boolean;
};

export function adaptiveQuestionSuggestion(question: SetupQuestion): AdaptiveQuestionSuggestion | undefined {
  if (question.structuredAnswer?.length) {
    const visibleLines = question.structuredAnswer.map((item) => item.question);
    return {
      displayText: visibleLines.join("\n"),
      visibleLines,
      submission: question.structuredAnswer,
      structured: true,
    };
  }
  if (!question.suggestedAnswer) return undefined;
  return {
    displayText: question.suggestedAnswer,
    visibleLines: [question.suggestedAnswer],
    submission: question.suggestedAnswer,
    structured: false,
  };
}

export function editedAdaptiveQuestionAnswer(question: SetupQuestion, value: string) {
  if (!question.structuredAnswer?.length) return value.trim();
  const editedLines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return question.structuredAnswer.map((item, index) => ({
    ...item,
    question: editedLines[index] || item.question,
  }));
}
