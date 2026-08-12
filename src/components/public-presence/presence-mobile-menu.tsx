"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import type { PresenceAction } from "@/features/presence/presence.types";
import { PresenceActionButton } from "./presence-action-button";

interface MobileNavigationLink {
  href: string;
  label: string;
}

export function PresenceMobileMenu({
  links,
  action,
  pageId,
  actionHref,
}: {
  links: MobileNavigationLink[];
  action?: PresenceAction;
  pageId: string;
  actionHref?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!links.length && !action) return null;
  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="presence-mobile-navigation"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        onClick={() => setOpen((current) => !current)}
        className="inline-grid size-11 place-items-center rounded-[var(--presence-button-radius)] border border-black/10 bg-[var(--presence-bg)] text-[var(--presence-fg)] transition hover:border-black/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--presence-primary)]/25"
      >
        {open ? <X aria-hidden /> : <Menu aria-hidden />}
      </button>
      {open ? (
        <nav
          id="presence-mobile-navigation"
          aria-label="Navegação mobile"
          className="absolute inset-x-0 top-full border-b border-black/10 bg-[var(--presence-bg)] px-5 py-5 shadow-[0_18px_45px_rgba(20,18,28,.14)]"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {links.map((link) => (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center rounded-[var(--presence-button-radius)] px-3 text-base font-bold text-[var(--presence-fg)] transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--presence-primary)]/20"
              >
                {link.label}
              </Link>
            ))}
            {action ? (
              <div className="mt-3 border-t border-black/10 pt-4">
                <PresenceActionButton
                  action={action}
                  context={{ pageId }}
                  pageHref={actionHref}
                  onAction={() => setOpen(false)}
                  className="w-full"
                />
              </div>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
