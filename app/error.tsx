"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { StatusPage } from "@/components/layout/StatusPage";
import { Button } from "@/components/ui/button";

/** P4 · #35 · runtime errors inside the root layout: plain message, retry, link home. Details go to the console only. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      icon={TriangleAlert}
      title="Что-то пошло не так"
      text="Страница не открылась из-за ошибки на нашей стороне. Попробуйте ещё раз — обычно это помогает. Если нет, начните с главной."
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" onClick={() => retry()}>
          <RotateCw aria-hidden="true" />
          Попробовать ещё раз
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">На главную</Link>
        </Button>
      </div>
    </StatusPage>
  );
}
