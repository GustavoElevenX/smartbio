import type { ReactNode } from "react";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/header";

type LegalPageProps = {
  title: string;
  description: string;
  updatedAt: string;
  children: ReactNode;
};

export function LegalPage({
  title,
  description,
  updatedAt,
  children,
}: LegalPageProps) {
  return (
    <>
      <MarketingHeader />
      <main className="min-h-screen bg-[#f7f8fa]">
        <div className="container-shell pb-24 pt-36 sm:pb-32 sm:pt-44">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,.72fr)_minmax(0,1.28fr)] lg:gap-20">
            <header className="lg:sticky lg:top-32 lg:self-start">
              <h1 className="max-w-xl text-balance text-5xl font-extrabold tracking-[-.04em] text-[#07172f] sm:text-6xl">
                {title}
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-[#536178]">
                {description}
              </p>
              <p className="mt-8 text-sm font-semibold text-[#536178]">
                Atualizado em {updatedAt}
              </p>
            </header>

            <article className="border-t border-[#cbd3dc] text-[#405064] [&_a]:font-semibold [&_a]:text-[#0054fc] [&_a]:underline [&_a]:decoration-[#9dbaff] [&_a]:underline-offset-4 [&_a]:transition [&_a:hover]:text-[#003fbf] [&_a:focus-visible]:rounded-sm [&_a:focus-visible]:outline-3 [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-[#8eb0ff] [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:tracking-[-.025em] [&_h2]:text-[#07172f] [&_li]:leading-7 [&_p]:leading-7 [&_section]:border-b [&_section]:border-[#cbd3dc] [&_section]:py-8 sm:[&_section]:py-10">
              {children}
            </article>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
