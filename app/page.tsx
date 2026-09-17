import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { TierBadge } from "@/components/profile/TierBadge";
import { HomeSearch } from "@/components/search/HomeSearch";
import { MANDATORY_FILTERS, REQUIRED_AREAS } from "@/lib/config/categories";

/** Search examples: an ambiguous abbreviation, a Kazakhstan university, an international one (product-strategy §12). */
const EXAMPLES = ["MSU", "Назарбаев Университет", "ETH Zurich"];

const TIERS = [
  { tier: "verified", text: "есть сильное доказательство, что это именно этот вуз" },
  { tier: "likely", text: "доказательства есть, но их меньше" },
  { tier: "unconfirmed", text: "доказательств мало, скрыто по умолчанию" },
] as const;

/** P4 · #5 · home: value proposition, search with examples, coverage note, link to the methodology. */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-10 px-4 py-12 sm:px-6 sm:py-20">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Настоящие фото университета — у каждого есть источник, дата и уровень доверия
        </h1>
        <p className="text-muted-foreground">
          Введите название вуза: за полминуты соберём кампус, общежития, аудитории, библиотеки и город из открытых
          источников и покажем, почему доверяем каждому снимку.
        </p>
      </div>

      <div className="space-y-3">
        <HomeSearch examples={EXAMPLES} />
        <p className="text-sm text-muted-foreground">
          Лучше всего протестировано на вузах Казахстана, Центральной Азии и крупных международных университетах.
        </p>
        <Link
          href="/how-it-works"
          className="inline-flex items-center gap-1 text-sm font-medium underline-offset-3 hover:underline"
        >
          Как мы проверяем фото
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid gap-6 border-t pt-8 text-sm sm:grid-cols-2">
        <div className="space-y-2">
          <h2 className="font-medium">Уровни доверия</h2>
          <ul className="space-y-2">
            {TIERS.map(({ tier, text }) => (
              <li key={tier} className="flex flex-col items-start gap-1">
                <TierBadge tier={tier} />
                <span className="text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h2 className="font-medium">В профиле</h2>
          <p className="text-muted-foreground">
            Разделы: {REQUIRED_AREAS.map((c) => c.labelRu.toLowerCase()).join(", ")}. Фильтры:{" "}
            {MANDATORY_FILTERS.map((c) => `«${c.filterLabelRu}»`).join(", ")}.
          </p>
          <p className="text-muted-foreground">
            Если подтвердить фото нельзя, так и напишем — чужие снимки хуже честного «не нашли».
          </p>
        </div>
      </div>
    </main>
  );
}
