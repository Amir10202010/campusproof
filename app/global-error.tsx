"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { StatusPage } from "@/components/layout/StatusPage";
import { Button } from "@/components/ui/button";
import "./globals.css";

/**
 * P4 · #35 · errors in the root layout itself. Replaces the whole document, so it renders its own <html>/<body>
 * and imports global styles; metadata exports are not supported here, hence the React <title>.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ru" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <title>Ошибка · CampusProof</title>
        <StatusPage
          icon={TriangleAlert}
          title="Сайт временно не открылся"
          text="Произошла ошибка при загрузке страницы. Попробуйте ещё раз или откройте главную заново."
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="lg" onClick={() => retry()}>
              <RotateCw aria-hidden="true" />
              Попробовать ещё раз
            </Button>
            <Button asChild size="lg" variant="outline">
              {/* A full reload on purpose: the root layout just failed, client navigation may be broken too. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/">На главную</a>
            </Button>
          </div>
        </StatusPage>
      </body>
    </html>
  );
}
