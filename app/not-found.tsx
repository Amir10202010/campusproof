import { ArrowRight, SearchX } from "lucide-react";
import Link from "next/link";
import { StatusPage } from "@/components/layout/StatusPage";
import { HomeSearch } from "@/components/search/HomeSearch";
import { Button } from "@/components/ui/button";

/** P4 · #35 · unmatched URLs and notFound() (e.g. /u/bad): Russian 404 with search right on the page. */
export default function NotFound() {
  return (
    <StatusPage
      icon={SearchX}
      code="404"
      title="Страница не найдена"
      text="Возможно, в адресе опечатка или ссылка устарела. Найдите университет заново — профиль соберётся за полминуты."
    >
      <HomeSearch examples={[]} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Button asChild variant="outline">
          <Link href="/">На главную</Link>
        </Button>
        <Link
          href="/how-it-works"
          className="inline-flex items-center gap-1 text-sm font-medium underline-offset-3 hover:underline"
        >
          Как мы проверяем фото
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </StatusPage>
  );
}
