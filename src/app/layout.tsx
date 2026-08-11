import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Virou — Transforme atenção em ação", template: "%s · Virou" },
  description: "Entenda o que cada visitante quer e conduza-o até pedido, orçamento, agendamento, reserva ou atendimento.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: { title: "Virou — Transforme atenção em ação", description: "Entenda o que cada visitante quer e conduza-o até pedido, orçamento, agendamento, reserva ou atendimento.", type: "website", locale: "pt_BR" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F7F7FA" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
