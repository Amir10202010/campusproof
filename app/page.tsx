import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { TrustScale } from "@/components/help/TrustScale";
import { HomeSearch } from "@/components/search/HomeSearch";
import { MANDATORY_FILTERS, REQUIRED_AREAS } from "@/lib/config/categories";
import { LIMITS } from "@/lib/config/limits";

/** Search examples: an ambiguous abbreviation, a Kazakhstan university, an international one (product-strategy §12). */
const EXAMPLES = ["MSU", "Назарбаев Университет", "Harvard University"];

const DEADLINE_S = Math.round(LIMITS.GLOBAL_DEADLINE_MS / 1000);

/** P4 · #5 · home: value proposition, search with examples, the trust scale, link to the methodology. */
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-14 pb-4 sm:px-6 sm:pt-20">
      <section className="max-w-3xl">
        <h1 className="font-display text-[2rem] leading-[1.08] font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
          Настоящие фото университета — у каждого есть источник, дата и уровень доверия
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Введите название вуза. За полминуты соберём кампус, общежития, аудитории, библиотеки и город из открытых
          источников — и покажем, на чём основан каждый снимок.
        </p>

        <div className="mt-8 sm:mt-10">
          <HomeSearch examples={EXAMPLES} />
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          Лучше всего протестировано на вузах Казахстана, Центральной Азии и крупных международных университетах. Сборка
          профиля укладывается в {DEADLINE_S} секунд.
        </p>
      </section>

      {/* The instrument: how a pile of evidence turns into one of four verdicts. */}
      <section aria-labelledby="scale-title" className="mt-16 border-t pt-10 sm:mt-20">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-14">
          <div className="space-y-3">
            <p className="annotation">Шкала доверия</p>
            <h2 id="scale-title" className="font-display text-xl font-semibold tracking-tight text-balance sm:text-2xl">
              Баллы за доказательства решают, попадёт ли фото в профиль
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Каждый найденный признак — публикация на сайте вуза, геометка рядом с кампусом, снимок в статье Википедии
              — добавляет баллы. Уровень выставляют правила по сумме, а не нейросеть.
            </p>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
            >
              Как мы проверяем фото
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <TrustScale />
        </div>
      </section>

      <section aria-labelledby="profile-title" className="mt-16 border-t pt-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-14">
          <div className="space-y-3">
            <p className="annotation">Что в профиле</p>
            <h2
              id="profile-title"
              className="font-display text-xl font-semibold tracking-tight text-balance sm:text-2xl"
            >
              Пять обязательных разделов и четыре фильтра
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Разделы собираются для каждого вуза одинаково. Пустой раздел значит «не смогли подтвердить» — мы не
              подставляем туда чужие снимки.
            </p>
          </div>

          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <div className="space-y-2.5">
              <p className="annotation">Разделы</p>
              <dl className="divide-y text-sm">
                {REQUIRED_AREAS.map((area) => (
                  <div key={area.id} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 py-2">
                    <dt className="font-medium">{area.labelRu}</dt>
                    <dd className="text-xs leading-relaxed text-muted-foreground">{area.descriptionRu}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="space-y-2.5">
              <p className="annotation">Фильтры</p>
              <ul className="flex flex-wrap gap-1.5">
                {MANDATORY_FILTERS.map((filter) => (
                  <li key={filter.id} className="rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground">
                    {filter.filterLabelRu}
                  </li>
                ))}
              </ul>
              <p className="pt-1 text-sm leading-relaxed text-muted-foreground">
                Плюс переключатель «Показывать неподтверждённые» — по умолчанию такие снимки скрыты.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The product's actual position, given the weight it deserves. */}
      <section className="mt-16 border-t pt-10">
        <blockquote className="max-w-3xl font-display text-xl leading-snug font-medium tracking-tight text-balance sm:text-2xl">
          Если подтвердить фото нельзя, мы так и пишем.
          <span className="text-muted-foreground"> Чужие снимки хуже честного «не нашли».</span>
        </blockquote>
      </section>
    </main>
  );
}
