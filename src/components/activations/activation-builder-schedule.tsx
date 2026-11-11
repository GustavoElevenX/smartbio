import type { ActivationBuilderState } from "./activation-builder-types";

export function ActivationBuilderSchedule({ state, onChange, timezone }: {
  state: ActivationBuilderState; onChange: (patch: Partial<ActivationBuilderState>) => void; timezone: string;
}) {
  return <div className="grid gap-5 sm:grid-cols-2">
    <label><span className="text-sm font-bold">Início</span><input type="datetime-local" value={state.startsAt} onChange={(event) => onChange({ startsAt: event.target.value })} className="mt-2 min-h-12 w-full rounded-xl border border-[#dcdbe3] px-4" /></label>
    <label><span className="text-sm font-bold">Fim</span><input type="datetime-local" value={state.endsAt} onChange={(event) => onChange({ endsAt: event.target.value })} className="mt-2 min-h-12 w-full rounded-xl border border-[#dcdbe3] px-4" /></label>
    <p className="text-sm text-[#707079] sm:col-span-2">Horários no fuso do negócio: {timezone.replaceAll("_", " ")}. A campanha começa e termina automaticamente.</p>
  </div>;
}
