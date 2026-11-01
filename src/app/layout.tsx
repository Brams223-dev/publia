import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Publia — Le studio marketing IA des commerces de proximité",
    template: "%s · Publia",
  },
  description:
    "Une photo, une idée, et Publia crée votre contenu marketing professionnel grâce à l'IA : publications, visuels, vidéos et YouTube.",
};

export const viewport: Viewport = {
  themeColor: "#6B55D9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
