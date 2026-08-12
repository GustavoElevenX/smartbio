import { Badge } from "@/components/ui/badge";
import type { ConversionActivationStatus } from "@/features/activations/activation.types";

const labels: Record<ConversionActivationStatus, string> = { draft: "Rascunho", scheduled: "Agendada", active: "Ativa", paused: "Pausada", ended: "Encerrada", archived: "Arquivada" };
const styles: Record<ConversionActivationStatus, string> = {
  draft: "bg-violet-50 text-violet-700",
  scheduled: "bg-amber-50 text-amber-700",
  active: "bg-emerald-50 text-emerald-700",
  paused: "bg-neutral-100 text-neutral-700",
  ended: "bg-neutral-100 text-neutral-700",
  archived: "bg-neutral-100 text-neutral-600",
};

export function ActivationStatus({ status }: { status: ConversionActivationStatus }) {
  return <Badge className={`border-0 ${styles[status]}`}>{labels[status]}</Badge>;
}
