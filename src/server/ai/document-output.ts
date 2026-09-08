import { z } from "zod";

// Editor drafts contain extensible content/configuration objects. Keep that
// document inside a closed transport envelope, then validate the actual
// document with its full domain schema before it can be applied.
export const documentOutputSchema = z.object({ documentJson: z.string().min(2) });

export function documentOutputInstruction<T>(schema: z.ZodType<T>) {
  return `Retorne documentJson como uma string contendo um objeto JSON válido (sem cercas Markdown). O objeto deve obedecer ao contrato abaixo. Omita campos opcionais desconhecidos; não use null onde o contrato não permitir. Os objetos de conteúdo continuam sujeitos à validação de domínio.\nCONTRATO_JSON: ${JSON.stringify(z.toJSONSchema(schema, { io: "input" }))}`;
}

export function parseDocumentOutput<T>(schema: z.ZodType<T>, output: z.infer<typeof documentOutputSchema>): T {
  return schema.parse(JSON.parse(output.documentJson));
}
