import type { FormField } from "@/types";

const semanticKeys: Array<[RegExp, string]> = [
  [/^(nome|nome completo)$/i, "name"],
  [/^(e-?mail|email)$/i, "email"],
  [/^(telefone|celular|whats?app)$/i, "phone"],
  [/^(empresa|nome da empresa)$/i, "company_name"],
];

export function formFieldKey(label: string, existing: string[] = []) {
  const semantic = semanticKeys.find(([pattern]) => pattern.test(label.trim()))?.[1];
  const base = (semantic || label)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "field";
  const used = new Set(existing);
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

export function formFieldIssues(field: FormField, fields: FormField[]) {
  const issues: string[] = [];
  if (!field.label.trim()) issues.push("Informe o rótulo do campo.");
  if (!/^[a-z][a-z0-9_]*$/.test(field.key))
    issues.push("A chave deve começar com uma letra e usar apenas letras, números e _.");
  if (fields.some((candidate) => candidate.id !== field.id && candidate.key === field.key))
    issues.push("Esta chave já está em uso.");
  if ((field.type === "select" || field.type === "radio") && !(field.options || []).some((option) => option.trim()))
    issues.push("Adicione ao menos uma opção.");
  return issues;
}

