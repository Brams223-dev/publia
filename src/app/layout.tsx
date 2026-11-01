import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { DEFAULT_LOCALE } from "@/config/markets";
import { messages } from "@/i18n";

export const metadata: Metadata = {
  title: { default: messages.meta.title, template: "%s · Publia" },
  description: messages.meta.description,
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
    <html lang={DEFAULT_LOCALE}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
