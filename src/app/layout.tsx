import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sobe — Transforme atenção em ação", template: "%s · Sobe" },
  description: "Entenda o que cada visitante quer e conduza-o até pedido, orçamento, agendamento, reserva ou atendimento.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  icons: { icon: "/brand/sobe-symbol.png", apple: "/brand/sobe-symbol.png" },
  openGraph: { title: "Sobe — Transforme atenção em ação", description: "Entenda o que cada visitante quer e conduza-o até pedido, orçamento, agendamento, reserva ou atendimento.", type: "website", locale: "pt_BR" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F7F7FA" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
