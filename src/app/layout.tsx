import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SmartBio — O próximo passo da sua bio", template: "%s · SmartBio" },
  description: "Crie uma experiência que entende o visitante, recomenda o melhor caminho e conduz até a ação.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: { title: "SmartBio", description: "A bio que entende, recomenda e vende.", type: "website", locale: "pt_BR" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F7F7FA" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
