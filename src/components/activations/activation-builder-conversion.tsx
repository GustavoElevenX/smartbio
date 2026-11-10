import type { ActivationBuilderState } from "./activation-builder-types";

const policies = [
  ["redemption_marks_conversion", "Resgate confirma a conversão"],
  ["manual_conversion", "Conversão manual"],
  ["external_conversion", "Conversão externa"],
] as const;

const limits = [
  ["maxClaims", "Total de solicitações"],
  ["maxRedemptions", "Total de resgates"],
  ["maxClaimsPerCustomer", "Solicitações por cliente"],
  ["maxRedemptionsPerCustomer", "Resgates por cliente"],
] as const;

export function ActivationBuilderConversion({ state, onChange }: { state: ActivationBuilderState; onChange: (patch: Partial<ActivationBuilderState>) => void }) {
  return <div className="space-y-6">
    <fieldset className="space-y-3"><legend className="mb-3 font-extrabold">Política de conversão</legend>{policies.map(([value, label]) => <label key={value} className="flex min-h-12 items-center gap-3 rounded-xl border border-[#e1e0e7] bg-white px-4 font-bold"><input type="radio" checked={state.conversionPolicy === value} onChange={() => onChange({ conversionPolicy: value })}/>{label}</label>)}</fieldset>
    <fieldset><legend className="font-extrabold">Limites</legend><p className="mt-1 text-sm text-[#707079]">Deixe o total vazio para não aplicar um limite global.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{limits.map(([key, label]) => <label key={key} className="text-sm font-bold">{label}<input type="number" min="1" step="1" value={state[key]} onChange={(event) => onChange({ [key]: event.target.value })} className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-[#dcdbe3] px-4"/></label>)}</div></fieldset>
  </div>;
}
