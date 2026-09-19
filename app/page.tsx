import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ScoringTable } from "@/components/help/ScoringTable";
import { TrustScale } from "@/components/help/TrustScale";
import { HomeSearch } from "@/components/search/HomeSearch";
import { MANDATORY_FILTERS, REQUIRED_AREAS } from "@/lib/config/categories";
import { LIMITS } from "@/lib/config/limits";

/** Search examples: an ambiguous abbreviation, a Kazakhstan university, an international one (product-strategy §12). */
const EXAMPLES = ["MSU", "Назарбаев Университет", "Harvard University"];

const DEADLINE_S = Math.round(LIMITS.GLOBAL_DEADLINE_MS / 1000);

/** P4 · #5 · home: value proposition, search with examples, the scoring rules, link to the methodology. */
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="pt-16 pb-14 sm:pt-24 sm:pb-20">
        <h1 className="max-w-5xl font-display text-hero font-semibold text-balance">
          Настоящие фото университета — у каждого есть источник, дата и уровень доверия
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Введите название вуза. За полминуты соберём кампус, общежития, аудитории, библиотеки и город из открытых
          источников — и покажем, на чём основан каждый снимок.
        </p>

        <div className="mt-10 max-w-3xl sm:mt-12">
          <HomeSearch examples={EXAMPLES} />
        </div>

        <p className="mt-5 max-w-2xl text-[0.9375rem] text-muted-foreground">
          Лучше всего протестировано на вузах Казахстана, Центральной Азии и крупных международных университетах. Сборка
          профиля укладывается в {DEADLINE_S} секунд.
        </p>
      </section>

      {/*
        The one thing worth remembering: the actual scoring table. Every figure comes from the code
        that scores, so the landing page cannot promise arithmetic the pipeline does not perform.
      */}
      <section aria-labelledby="scoring-title" className="border-t py-14 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="annotation">Как это считается</p>
            <h2 id="scoring-title" className="mt-3 font-display text-display font-semibold text-balance">
              Мы показываем свою арифметику
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Уровень доверия — не мнение нейросети. Каждый найденный признак добавляет или отнимает очки по
              фиксированным правилам, и уровень выставляет код по сумме. Вот эти правила целиком.
            </p>
            <div className="mt-8">
              <TrustScale />
            </div>
            <Link
              href="/how-it-works"
              className="mt-8 inline-flex items-center gap-2 text-base font-medium underline-offset-4 hover:underline"
            >
              Как мы проверяем фото
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <ScoringTable />
        </div>
      </section>

      <section aria-labelledby="profile-title" className="border-t py-14 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className="annotation">Что в профиле</p>
            <h2 id="profile-title" className="mt-3 font-display text-display font-semibold text-balance">
              Пять обязательных разделов и четыре фильтра
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Разделы собираются для каждого вуза одинаково. Пустой раздел значит «не смогли подтвердить» — мы не
              подставляем туда чужие снимки.
            </p>
          </div>

          <div className="space-y-10">
            <dl className="divide-y border-y">
              {REQUIRED_AREAS.map((area) => (
                <div key={area.id} className="grid gap-x-6 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <dt className="font-display text-title font-semibold">{area.labelRu}</dt>
                  <dd className="text-[0.9375rem] leading-relaxed text-muted-foreground">{area.descriptionRu}</dd>
                </div>
              ))}
            </dl>
            <div>
              <p className="annotation">Фильтры</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {MANDATORY_FILTERS.map((filter) => (
                  <li key={filter.id} className="rounded-md border bg-card px-3 py-1.5 text-[0.9375rem]">
                    {filter.filterLabelRu}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
                Плюс переключатель «Показывать неподтверждённые» — по умолчанию такие снимки скрыты.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The product's actual position, given the weight it deserves. */}
      <section className="border-t py-14 sm:py-20">
        <blockquote className="max-w-4xl font-display text-display leading-tight font-medium text-balance">
          Если подтвердить фото нельзя, мы так и пишем.
          <span className="text-muted-foreground"> Чужие снимки хуже честного «не нашли».</span>
        </blockquote>
      </section>
    </main>
  );
}
