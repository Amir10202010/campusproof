import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#content"
          className="sr-only rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
        >
          Перейти к содержимому
        </a>
        <TooltipProvider>
          <SiteHeader />
          <div id="content" className="flex flex-1 flex-col">
            {children}
          </div>
          <SiteFooter />
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
