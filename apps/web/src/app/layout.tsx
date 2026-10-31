import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { QueryProvider } from "@/providers/QueryProvider";
import "lenis/dist/lenis.css";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700", "800", "900"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://victorengineer.dev"
  ),
  title: "Victor Engineer | Rastreador de Entretenimiento",
  description:
    "Showcase personal y centro de mando para videojuegos, cine y series de tiempo con enriquecimiento contextual por Gemini IA.",
  icons: {
    icon: [{ url: "/brand/ve-isotipo-red.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/ve-isotipo-red.svg", type: "image/svg+xml" }],
    shortcut: "/brand/ve-isotipo-red.svg",
  },
  openGraph: {
    title: "Victor Engineer | Rastreador de Entretenimiento",
    description:
      "Centro de comando y telemetría para videojuegos, cinefilia y series de tiempo con enriquecimiento contextual por Gemini IA.",
    siteName: "Victor Engineer Entertainment",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Victor Engineer | Rastreador de Entretenimiento",
    description:
      "Centro de comando y telemetría para videojuegos, cinefilia y series de tiempo con enriquecimiento contextual por Gemini IA.",
  },
};

import { ThemeProvider } from "@/providers/ThemeProvider";
import { SmoothScroll } from "@/components/layout/SmoothScroll";
import { ScrollToTop } from "@/components/layout/ScrollToTop";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`dark ${outfit.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-zinc-50 dark:bg-[#09090B] font-sans text-zinc-900 dark:text-zinc-100 antialiased selection:bg-rose-500/20 selection:text-rose-400 min-h-screen">
        <ThemeProvider defaultTheme="system">
          <SmoothScroll>
            <QueryProvider>{children}</QueryProvider>
            <ScrollToTop />
          </SmoothScroll>
        </ThemeProvider>
      </body>
    </html>
  );
}

