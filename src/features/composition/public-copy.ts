function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function isRecommendationIntent(value: string) {
  const text = normalize(value);
  return /recomend/.test(text) || (
    /orient|descobrir|encontrar|escolher|identificar/.test(text) &&
    /opcao|servico|modalidade|caminho|ideal|adequad|sentido|necessidade/.test(text)
  );
}

export function synthesizePublicDescription(input: {
  businessName: string;
  primaryGoal: string;
  offerings?: string[];
}) {
  const names = (input.offerings || []).filter(Boolean).slice(0, 3);
  if (isRecommendationIntent(input.primaryGoal)) {
    return names.length
      ? `Conte o que você precisa e descubra qual opção pode fazer mais sentido entre ${names.join(", ")}.`
      : "Conte o que você precisa e descubra qual opção pode fazer mais sentido.";
  }
  if (names.length) return `Conheça ${names.join(", ")} e escolha como continuar com ${input.businessName}.`;
  return `Conheça ${input.businessName} e encontre a forma mais simples de continuar.`;
}
