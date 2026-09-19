import type { Metadata, Viewport } from "next";
import { Geist, Golos_Text, JetBrains_Mono } from "next/font/google";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/** Prose. Neutral on purpose: it has to disappear behind long Russian sentences. */
const geist = Geist({ variable: "--font-geist", subsets: ["latin", "cyrillic"], display: "swap" });

/**
 * Headings and figures. Cyrillic-native (Paratype), institutional — the voice of a record.
 * No `weight`, so next/font serves the variable axis: one file per subset instead of one per weight.
 */
const golos = Golos_Text({ variable: "--font-golos", subsets: ["latin", "cyrillic"], display: "swap" });

/** Machine facts: domains, timestamps, counts, error codes. The margin of the contact sheet. */
const mono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin", "cyrillic"], display: "swap" });

const TITLE = "CampusProof — проверенный визуальный профиль университета";
const DESCRIPTION =
  "Введите название университета и получите проверенные фотографии кампуса, общежитий, аудиторий, библиотек и города с источниками.";

export const metadata: Metadata = {
  metadataBase: new URL("https://campusproof.vercel.app"),
  title: { default: TITLE, template: "%s · CampusProof" },
  description: DESCRIPTION,
  applicationName: "CampusProof",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "CampusProof",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/** Paint the browser chrome with the page, so the dark theme has no white seam at the top. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#101118" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${geist.variable} ${golos.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#content"
          className="sr-only rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
        >
          Перейти к содержимому
        </a>
        <ThemeProvider>
          <TooltipProvider>
            <SiteHeader />
            <div id="content" className="flex flex-1 flex-col">
              {children}
            </div>
            <SiteFooter />
          </TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
