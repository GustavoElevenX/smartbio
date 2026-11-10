import type { ActivationBuilderState } from "./activation-builder-types";

const placements = [
  ["announcement_bar", "Barra superior"], ["hero_override", "Destaque principal"],
  ["section_badge", "Selo de seção"], ["product_badge", "Selo de produto"],
  ["service_badge", "Selo de serviço"], ["conversion_cta", "Botão de conversão"],
  ["journey_banner", "Faixa da jornada"], ["floating_cta", "Botão flutuante"],
] as const;

export function ActivationBuilderPlacements({ state, onChange }: { state: ActivationBuilderState; onChange: (patch: Partial<ActivationBuilderState>) => void }) {
  return <div className="space-y-6">
    <fieldset><legend className="font-extrabold">Página da campanha</legend><div className="mt-3 space-y-2">
      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-[#e1e0e7] px-4 font-bold"><input type="radio" name="advanced-surface" checked={state.surfaceMode === "exclusive"} onChange={() => onChange({ surfaceMode: "exclusive" })}/>Somente link exclusivo</label>
      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-[#e1e0e7] px-4 font-bold"><input type="radio" name="advanced-surface" checked={state.surfaceMode === "exclusive_and_home"} onChange={() => onChange({ surfaceMode: "exclusive_and_home" })}/>Assumir temporariamente o link principal</label>
    </div></fieldset>
    <label className="block max-w-xs text-sm font-bold">Prioridade entre campanhas<input type="number" min="-1000" max="1000" step="1" value={state.priority} onChange={(event) => onChange({ priority: event.target.value })} className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-[#dcdbe3] px-4"/></label>
    <fieldset><legend className="font-extrabold">Posicionamentos na presença</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{placements.map(([value, label]) => <label key={value} className="flex min-h-12 items-center gap-3 rounded-xl border border-[#e1e0e7] bg-white px-4 font-bold"><input type="checkbox" checked={state.placements.includes(value)} onChange={(event) => onChange({ placements: event.target.checked ? [...state.placements, value] : state.placements.filter((item) => item !== value) })}/>{label}</label>)}</div></fieldset>
  </div>;
}
