"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { FileUp, ListPlus } from "lucide-react";
import { SourceUploader } from "@/components/ai-setup/source-uploader";
import { Label, Textarea } from "@/components/ui/field";
import type { SourceReference } from "@/features/ai-setup/ai-setup.schema";
import type { InitialSetupForm } from "@/components/ai-setup/ai-conversation";

interface BusinessOfferingInputProps {
  form: InitialSetupForm;
  sources: SourceReference[];
  setupSessionId?: string;
  projectId?: string;
  disabled: boolean;
  onFormChange: Dispatch<SetStateAction<InitialSetupForm>>;
  onSourcesChange: (sources: SourceReference[]) => void;
}

const offeringOptions = [
  ["products", "Produtos"],
  ["services", "Serviços"],
  ["both", "Ambos"],
] as const;

export function BusinessOfferingInput({ form, sources, setupSessionId, projectId, disabled, onFormChange, onSourcesChange }: BusinessOfferingInputProps) {
  const [chosenMethod, setChosenMethod] = useState<"text" | "material" | null>(null);
  const method = chosenMethod ?? (form.offerDetails?.trim() ? "text" : sources.length ? "material" : null);
  const hasProducts = form.offeringType === "products" || form.offeringType === "both";
  const offerLabel = form.offeringType === "services" ? "Seus serviços" : form.offeringType === "both" ? "Seus produtos e serviços" : "Seus produtos";

  return (
    <div className="mt-6 border-t border-[#dfe6ee] pt-6">
      <h2 className="text-lg font-extrabold tracking-[-.025em] text-[#07172f]">O que seu negócio oferece</h2>
      <p className="mt-1 text-sm leading-6 text-[#526171]">Comece pelo essencial. A Sobe organiza os detalhes e você revisa antes de criar.</p>

      <div className="mt-5">
        <Label htmlFor="ai-description">O que você vende e como atende?</Label>
        <Textarea id="ai-description" className="min-h-28" value={form.description} onChange={(event) => onFormChange((current) => ({ ...current, description: event.target.value }))} placeholder="Conte em poucas palavras o que seu negócio faz, para quem e como atende." disabled={disabled} aria-describedby="ai-description-hint" />
        <p id="ai-description-hint" className="mt-2 text-xs leading-5 text-[#526171]">Uma descrição breve basta. A SOBE propõe os caminhos comerciais e você confirma antes de criar.</p>
      </div>
      <details className="mt-5 border-t border-[#dfe6ee] pt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[#07172f]">Detalhar ofertas e revenda (opcional)</summary>
      <fieldset className="mt-4">
        <legend className="text-sm font-bold text-[#07172f]">Você vende produtos, serviços ou ambos?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {offeringOptions.map(([value, label]) => (
            <label key={value} className={`focus-within:ring-2 focus-within:ring-[#0054fc] inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-4 text-sm font-semibold ${form.offeringType === value ? "border-[#0054fc] bg-[#eaf3ff] text-[#0054fc]" : "border-[#d7e1ec] bg-white text-[#536178]"}`}>
              <input type="radio" name="offeringType" value={value} checked={form.offeringType === value} onChange={() => onFormChange((current) => ({ ...current, offeringType: value }))} disabled={disabled} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6">
        <h3 className="text-sm font-bold text-[#07172f]">{offerLabel}</h3>
        <p className="mt-1 text-xs leading-5 text-[#526171]">Como prefere contar o que oferece? Pode combinar texto e materiais, sem cadastrar tudo de novo.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button type="button" aria-pressed={method === "text"} onClick={() => setChosenMethod("text")} disabled={disabled} className={`focus-ring min-h-20 rounded-xl border p-4 text-left transition ${method === "text" ? "border-[#0054fc] bg-[#eaf3ff]" : "border-[#d7e1ec] bg-white hover:border-[#8cb4fc]"}`}>
            <span className="flex items-center gap-2 text-sm font-bold text-[#07172f]"><ListPlus size={17} aria-hidden="true" /> Escrever ou colar</span>
            <span className="mt-1 block text-xs leading-5 text-[#526171]">Uma lista simples, anotações ou texto livre.</span>
          </button>
          <button type="button" aria-pressed={method === "material"} onClick={() => setChosenMethod("material")} disabled={disabled} className={`focus-ring min-h-20 rounded-xl border p-4 text-left transition ${method === "material" ? "border-[#0054fc] bg-[#eaf3ff]" : "border-[#d7e1ec] bg-white hover:border-[#8cb4fc]"}`}>
            <span className="flex items-center gap-2 text-sm font-bold text-[#07172f]"><FileUp size={17} aria-hidden="true" /> Aproveitar material pronto</span>
            <span className="mt-1 block text-xs leading-5 text-[#526171]">Foto, PDF, planilha CSV ou link do catálogo{sources.length ? ` · ${sources.length} enviado${sources.length === 1 ? "" : "s"}` : ""}.</span>
          </button>
        </div>

        {method === "text" ? (
          <div className="mt-4">
            <Label htmlFor="ai-offer-details">{offerLabel}</Label>
            <Textarea id="ai-offer-details" className="min-h-36" maxLength={6000} value={form.offerDetails || ""} onChange={(event) => onFormChange((current) => ({ ...current, offerDetails: event.target.value }))} placeholder={form.offeringType === "services" ? "Um serviço por linha, se quiser. Conte modalidades, duração e preço somente se souber." : "Pode ser só uma lista: nome de cada item e, se souber, sabores, tamanhos, modelos ou preços."} disabled={disabled} aria-describedby="ai-offer-details-hint" />
            <p id="ai-offer-details-hint" className="mt-2 text-xs leading-5 text-[#526171]">Não precisa preencher todas as características. A Sobe usa o que você informou; detalhes ausentes podem ser acrescentados depois.</p>
          </div>
        ) : method === "material" ? (
          <div className="mt-4">
            {form.offerDetails?.trim() ? <p className="mt-2 text-xs font-semibold text-[#0054fc]">Seu texto já escrito também será considerado.</p> : null}
          </div>
        ) : (
          <p className="mt-3 text-xs leading-5 text-[#526171]">Pode começar apenas com a descrição acima e completar o catálogo depois. Sem itens identificáveis, a Sobe não monta uma compra fictícia.</p>
        )}
        {(method === "material" || sources.length > 0) ? <div className="mt-4"><SourceUploader sources={sources} setupSessionId={setupSessionId} projectId={projectId} onChange={onSourcesChange} disabled={disabled} /><p className="mt-2 text-xs leading-5 text-[#526171]">Revise o que foi importado. A Sobe não cria preços, variações ou disponibilidade que não estejam no material.</p></div> : null}
      </div>

      {hasProducts ? (
        <fieldset className="mt-6 border-t border-[#dfe6ee] pt-5">
          <legend className="text-sm font-bold text-[#07172f]">Você também fornece produtos para revenda?</legend>
          <p className="mt-1 text-xs leading-5 text-[#526171]">Se sim, não precisa repetir o catálogo. Conte apenas o que muda para o revendedor.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {([[true, "Sim"], [false, "Não"]] as const).map(([value, label]) => (
              <label key={label} className={`focus-within:ring-2 focus-within:ring-[#0054fc] inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-4 text-sm font-semibold ${form.resaleAvailable === value ? "border-[#0054fc] bg-[#eaf3ff] text-[#0054fc]" : "border-[#d7e1ec] bg-white text-[#536178]"}`}>
                <input type="radio" name="resaleAvailable" checked={form.resaleAvailable === value} onChange={() => onFormChange((current) => ({ ...current, resaleAvailable: value }))} disabled={disabled} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
          {form.resaleAvailable ? (
            <div className="mt-4">
              <Label htmlFor="ai-resale-details">O que o revendedor precisa saber? (se souber)</Label>
              <Textarea id="ai-resale-details" className="min-h-24" maxLength={2000} value={form.resaleDetails || ""} onChange={(event) => onFormChange((current) => ({ ...current, resaleDetails: event.target.value }))} placeholder="Quais itens são para revenda? Há pedido mínimo, embalagem diferente ou outro contato?" disabled={disabled} aria-describedby="ai-resale-details-hint" />
              <p id="ai-resale-details-hint" className="mt-2 text-xs leading-5 text-[#526171]">Se ainda não definiu as condições, a Sobe pode orientar o visitante a consultar o negócio; não vai presumir que todos os itens são para revenda.</p>
            </div>
          ) : null}
        </fieldset>
      ) : null}
      </details>
    </div>
  );
}
