import type { Metadata, Viewport } from "next";
import { resolveAppUrl } from "@/lib/app-url";
import "./globals.css";

const description = "Transforme a atenção que sua empresa gera nas redes em uma estrutura digital preparada para levar o cliente à próxima ação.";

const directionContract = `
IMPECCABLE_DIRECTION 430f8e2e
THESIS: A atenção difusa é recortada até virar uma ação clara; recusamos o hero SaaS com celular e uma parede de cards.
OWN-WORLD: Noite mineral, nuvens brancas, cortes prateados, índigo para percurso e verde mint para ação; placas têm cantos recortados e linhas técnicas finas.
STORY: O visitante entende que a SOBE organiza a intenção, acredita que a jornada respeita sua operação e inicia o próprio roteiro.
FIRST VIEWPORT: Headline e CTAs ocupam a esquerda; um portal de nuvens domina a direita; atração, intenção e ação formam a linha inferior.
FORM: Arquitetura da Atenção, alternativa escolhida pelo usuário, seed 430f8e2e.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
`.trim();

export const metadata: Metadata = {
  title: { default: "SOBE — Transforme atração em ação", template: "%s · Sobe" },
  description,
  metadataBase: new URL(resolveAppUrl()),
  openGraph: { title: "SOBE — Transforme atração em ação", description, type: "website", locale: "pt_BR" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#07172F" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.currentScript?.parentNode?.insertBefore(document.createComment(${JSON.stringify(directionContract)}), document.currentScript);`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
