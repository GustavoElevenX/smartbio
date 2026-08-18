import { CalendarDays, CircleDollarSign, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { OpportunityStatusBadge } from "./opportunity-status";
import type { CommercialOpportunity } from "@/types";

const sourceLabel: Record<CommercialOpportunity["sourceType"], string> = {
  lead: "Formulário",
  quote: "Orçamento",
  booking: "Agendamento",
  order: "Pedido",
  reservation: "Reserva",
  routed_contact: "Contato encaminhado",
};

export function OpportunityCard({
  opportunity,
  selected,
  onSelect,
}: {
  opportunity: CommercialOpportunity;
  selected: boolean;
  onSelect: () => void;
}) {
  const contact = opportunity.contactPhone || opportunity.contactEmail;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "focus-ring w-full rounded-2xl border bg-white p-4 text-left transition hover:border-[#9fc3ff] hover:shadow-[0_14px_35px_rgba(31,27,54,.07)]",
        selected
          ? "border-[#0186fc] shadow-[0_14px_35px_rgba(0,84,252,.09)]"
          : "border-[#e3e1e8]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-bold uppercase tracking-[.12em] text-[#65626d]">
            {sourceLabel[opportunity.sourceType]}
          </span>
          <h3 className="mt-1 truncate font-extrabold">{opportunity.title}</h3>
          <p className="mt-1 truncate text-xs font-semibold text-[#55525d]">
            {opportunity.contactName || "Nome não informado"}
          </p>
          {contact ? (
            <span className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-[#65626d]">
              {opportunity.contactPhone ? (
                <Phone size={13} aria-hidden="true" />
              ) : (
                <Mail size={13} aria-hidden="true" />
              )}
              <span className="truncate">{contact}</span>
            </span>
          ) : (
            <span className="mt-2 block text-xs text-[#77747f]">
              Contato não informado
            </span>
          )}
        </div>
        <OpportunityStatusBadge status={opportunity.status} />
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-xs text-[#65626d]">
        <span className="flex items-center gap-1.5">
          <CalendarDays size={13} aria-hidden="true" />
          {new Intl.DateTimeFormat("pt-BR").format(
            new Date(opportunity.createdAt),
          )}
        </span>
        {opportunity.estimatedValue != null ? (
          <span className="flex items-center gap-1.5">
            <CircleDollarSign size={13} aria-hidden="true" />
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: opportunity.currency,
            }).format(opportunity.estimatedValue)}
          </span>
        ) : null}
      </div>
    </button>
  );
}
