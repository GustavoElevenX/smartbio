import { Mail, MessageCircle, Phone, UserRound } from "lucide-react";
import type { CommercialOpportunity, ConversionGoal, EntryPoint } from "@/types";
import { OpportunityStatusBadge } from "./opportunity-status";

export function OpportunityDetails({
  opportunity,
  goal,
  entry,
}: {
  opportunity: CommercialOpportunity;
  goal?: ConversionGoal;
  entry?: EntryPoint;
}) {
  const whatsappPhone = opportunity.contactPhone?.replace(/\D/g, "");

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="text-xs font-bold text-[#0054fc]">
            {opportunity.projectName}
          </span>
          <h2 className="mt-1 text-2xl font-extrabold tracking-[-.035em]">
            {opportunity.title}
          </h2>
        </div>
        <OpportunityStatusBadge status={opportunity.status} />
      </div>

      {opportunity.activationId || opportunity.benefitClaimId ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {opportunity.activationId ? (
            <span className="rounded-full bg-[#eaf3ff] px-3 py-1 text-xs font-bold text-[#0054fc]">
              Ativação atribuída
            </span>
          ) : null}
          {opportunity.benefitClaimId ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-mono text-xs font-bold text-emerald-700">
              Benefício ·{" "}
              {String(
                opportunity.metadata.benefitClaimCode ||
                  opportunity.benefitClaimId,
              ).slice(0, 8)}
            </span>
          ) : null}
        </div>
      ) : null}

      <section
        aria-labelledby="opportunity-contact-title"
        className="mt-6 rounded-2xl bg-[#f1f7ff] p-4 sm:p-5"
      >
        <div className="flex items-center gap-2 text-[#0054fc]">
          <UserRound size={17} aria-hidden="true" />
          <h3
            id="opportunity-contact-title"
            className="text-xs font-bold uppercase tracking-[.1em]"
          >
            Contato
          </h3>
        </div>
        <strong className="mt-3 block text-lg">
          {opportunity.contactName || "Nome não informado"}
        </strong>
        <div className="mt-3 grid gap-2 text-sm">
          {opportunity.contactPhone ? (
            <a
              href={`tel:${opportunity.contactPhone}`}
              className="focus-ring flex min-h-11 items-center gap-2 rounded-xl px-2 text-[#26364a] hover:bg-white"
            >
              <Phone size={16} aria-hidden="true" />
              <span className="min-w-0 truncate">
                {opportunity.contactPhone}
              </span>
            </a>
          ) : null}
          {opportunity.contactEmail ? (
            <a
              href={`mailto:${opportunity.contactEmail}`}
              className="focus-ring flex min-h-11 items-center gap-2 rounded-xl px-2 text-[#26364a] hover:bg-white"
            >
              <Mail size={16} aria-hidden="true" />
              <span className="min-w-0 truncate">
                {opportunity.contactEmail}
              </span>
            </a>
          ) : null}
          {!opportunity.contactPhone && !opportunity.contactEmail ? (
            <p className="text-sm leading-6 text-[#625f69]">
              Telefone e e-mail não foram informados antes desta ação.
            </p>
          ) : null}
        </div>
        {whatsappPhone ? (
          <a
            href={`https://wa.me/${whatsappPhone}`}
            target="_blank"
            rel="noreferrer"
            className="focus-ring mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#147b58] px-4 text-sm font-bold text-white transition hover:bg-[#106648] sm:w-auto"
          >
            <MessageCircle size={16} aria-hidden="true" />
            Abrir conversa no WhatsApp
          </a>
        ) : null}
      </section>

      <dl className="mt-4 grid gap-3 rounded-2xl bg-[#f6f5f8] p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-[#6d6a75]">Origem</dt>
          <dd className="mt-1 font-semibold">
            {opportunity.attribution?.source || "Direto"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#6d6a75]">Meta</dt>
          <dd className="mt-1 font-semibold">
            {goal?.name || "Não atribuída"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#6d6a75]">Entrada</dt>
          <dd className="mt-1 font-semibold">
            {entry?.name || "Acesso geral"}
          </dd>
        </div>
      </dl>

      {opportunity.summary ? (
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-[.12em] text-[#65626d]">
            Contexto
          </h3>
          <p className="mt-2 text-sm leading-6">{opportunity.summary}</p>
        </div>
      ) : null}
    </div>
  );
}
