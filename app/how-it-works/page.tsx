import { ArrowLeft, ArrowRight, Ban, ExternalLink, Minus, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { TrustScale } from "@/components/help/TrustScale";
import { CATEGORIES } from "@/lib/config/categories";
import { GEO, LIMITS } from "@/lib/config/limits";
import { formatDistanceRu, pluralRu } from "@/lib/ui/format";

export const metadata: Metadata = {
  title: "Как мы проверяем фото",
  description:
    "Откуда берутся фото, какие доказательства мы ищем, как считаются уровни доверия и чего сервис не умеет.",
};

const STEPS = [
  {
    title: "Название",
    text: "Находим университет в Wikidata по названию или сокращению. Если подходят несколько вузов, просим выбрать нужный.",
  },
  {
    title: "Поиск",
    text: "Собираем фото-кандидатов из Wikimedia Commons, веб-поиска и Openverse, факты и текст — из Wikidata и Википедии. Если источник не ответил вовремя, профиль строится без него, и мы об этом пишем.",
  },
  {
    title: "Проверка",
    text: "Скачиваем уменьшенные копии, убираем дубликаты. Нейросеть описывает, что на снимке, а правила начисляют баллы за доказательства и выставляют уровень.",
  },
  {
    title: "Категории",
    text: `Раскладываем фото по разделам: ${CATEGORIES.map((c) => c.labelRu.toLowerCase()).join(", ")}.`,
  },
  {
    title: "Профиль",
    text: "Показываем каждое фото с источником, датой и уровнем доверия. Пустые разделы не заполняем чужими снимками.",
  },
];

const SIGNALS: { title: string; icon: "plus" | "minus" | "ban"; items: string[] }[] = [
  {
    title: "Сильные доказательства",
    icon: "plus",
    items: [
      "В Wikimedia Commons отмечено, что на фото изображён этот университет",
      "Фото лежит в категории университета на Commons",
      `Геометка не дальше ${formatDistanceRu(GEO.STRONG_NEAR_CAMPUS_M)} от кампуса`,
      // geo_in_city is only added for the city section, and there it is strong (lib/scoring/signals.ts).
      "Снимок города с геометкой в черте города — для раздела «Город»",
      "Фото используется в статье Википедии об университете",
      "Фото опубликовано на официальном сайте (и не похоже на сток или рендер)",
      "На снимке читается название этого университета",
    ],
  },
  {
    title: "Средние и слабые",
    icon: "plus",
    items: [
      "Название вуза есть в заголовке, подписи или адресе страницы",
      "Тот же снимок нашёлся ещё на одном сайте",
      "Новостная статья, в которой упоминается университет",
      `Геометка в том же городе — до ${formatDistanceRu(GEO.SAME_CITY_M)}, для остальных разделов`,
      // visual_consistent: the model compares the scene with the context block of lib/vision/gemini.ts.
      "Сцена соответствует описанию вуза: городу, известным корпусам, статье Википедии",
    ],
  },
  {
    title: "Против",
    icon: "minus",
    items: [
      "Сцена не соответствует описанию",
      "Похоже на рендер или иллюстрацию — такая пометка видна на карточке",
      "Проверить удалось только маленькую копию",
    ],
  },
  {
    title: "Сразу отклоняем",
    icon: "ban",
    items: [
      `Геометка дальше ${formatDistanceRu(GEO.FAR_AWAY_M)} от кампуса`,
      "На снимке название другого вуза",
      // Only stock banks: a web-search hit on an aggregator (Pinterest) is scored like any unknown site.
      "Фото со стокового сайта (фотобанка)",
      "Не фотография: логотип, карта, документ, скриншот",
      "Крупный портрет человека",
    ],
  },
];

const SOURCES = [
  {
    name: "Wikidata",
    url: "https://www.wikidata.org",
    text: "какой это вуз, координаты кампуса и города, сайт, факты",
  },
  { name: "Википедия", url: "https://ru.wikipedia.org", text: "текст описания, каждое предложение со ссылкой" },
  {
    name: "Wikimedia Commons",
    url: "https://commons.wikimedia.org",
    text: "фото с открытыми лицензиями, категориями и геометками",
  },
  {
    name: "Serper",
    url: "https://serper.dev",
    text: "API веб-поиска картинок: официальные сайты, СМИ, блоги",
  },
  { name: "Openverse", url: "https://openverse.org", text: "каталог фото с открытыми лицензиями" },
  {
    name: "Google Gemini",
    url: "https://ai.google.dev",
    text: "бесплатная модель: описывает, что на снимке, и пишет краткое описание по источникам",
  },
];

const PROFILE_CACHE_DAYS = Math.round(LIMITS.PROFILE_CACHE_TTL_S / 86_400);
const DEADLINE_S = Math.round(LIMITS.GLOBAL_DEADLINE_MS / 1000);

/** P4 · #5 · methodology page: pipeline, signals and tiers in plain language (architecture §5.6), sources, limits. */
export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-14">
      <div className="max-w-2xl space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          CampusProof
        </Link>
        <h1 className="font-display text-[2rem] leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-[2.75rem]">
          Как мы проверяем фото
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
          CampusProof не показывает случайную выдачу поиска. У каждого фото есть источник, дата и уровень доверия, а за
          уровнем — список доказательств, который можно открыть кликом по фото.
        </p>
      </div>

      <Section eyebrow="Шаг за шагом" title="Путь от названия до профиля">
        <ol className="space-y-6 border-l pl-7">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative space-y-1">
              {/* The numbers are the pipeline's real order, not decoration: each step needs the one before it. */}
              <span
                aria-hidden="true"
                className="absolute top-0.5 -left-[2.125rem] flex size-7 items-center justify-center rounded-[4px] bg-foreground font-mono text-xs font-medium text-background"
              >
                {index + 1}
              </span>
              <p className="font-display text-title font-semibold">{step.title}</p>
              <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section eyebrow="Шкала доверия" title="Как баллы превращаются в уровень">
        <TrustScale />
        <p className="rounded-xl border bg-surface p-4 text-sm leading-relaxed">
          Баллы — это не вероятность, а сумма за найденные доказательства. Уровень выставляет код по заранее заданным
          правилам. Нейросеть только описывает, что видит на снимке, и оценку сама не ставит.
        </p>
      </Section>

      <Section eyebrow="Доказательства" title="Что мы ищем в каждом снимке">
        <div className="grid gap-8 sm:grid-cols-2">
          {SIGNALS.map((group) => (
            <div key={group.title} className="space-y-2.5">
              <h3 className="font-display text-[0.9375rem] font-semibold tracking-tight">{group.title}</h3>
              <ul className="space-y-2 text-sm">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2.5 leading-relaxed">
                    <SignalIcon kind={group.icon} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Если визуальная проверка недоступна, «Проверено» можно получить только по происхождению или геометке, а фото
          только из веб-поиска остаются не выше «Не подтверждено».
        </p>
      </Section>

      <Section eyebrow="Данные" title="Откуда берутся фото и факты">
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {SOURCES.map((source) => (
            <li key={source.name} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 font-medium underline-offset-4 hover:underline sm:w-44"
              >
                {source.name}
                <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
              </a>
              <span className="text-muted-foreground">{source.text}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Стоковые фотобанки не используем. Google Картинки, Instagram, Facebook, VK и 2ГИС не парсим — только
          официальные API и открытые данные.
        </p>
      </Section>

      <Section eyebrow="Честно" title="Чего сервис не умеет">
        <ul className="space-y-3 text-sm leading-relaxed">
          {[
            "Не определяем, сгенерировано ли фото нейросетью: опираемся на происхождение снимка — где он опубликован, кем и с какими метаданными.",
            "Для визуальной проверки и описания используем бесплатный Gemini. Его условия не разрешают бесплатный тариф для пользователей из Европейской экономической зоны (ЕС, Исландия, Лихтенштейн, Норвегия), Швейцарии и Великобритании. Поэтому для посетителей оттуда визуальная проверка отключена, а описание — цитата из Википедии. Профиль всё равно строится, а баннер предупреждает об ограничении.",
            "У фото из веба часто нет даты съёмки. Тогда пишем, когда снимок опубликован или когда мы его нашли, и не выдаём это за дату съёмки.",
            "Не просим нейросеть узнавать людей и не показываем крупные портреты.",
            "Лучше всего протестировано на вузах Казахстана, Центральной Азии и крупных международных университетах. У небольших вузов открытых фото бывает мало — тогда честно показываем пустые разделы.",
            `На сборку профиля есть общий лимит — ${DEADLINE_S} ${pluralRu(DEADLINE_S, ["секунда", "секунды", "секунд"])}: медленный источник не задерживает весь профиль. Готовый профиль сохраняется до ${PROFILE_CACHE_DAYS} ${pluralRu(PROFILE_CACHE_DAYS, ["дня", "дней", "дней"])}; у сохранённого видна дата создания и кнопка «Обновить».`,
          ].map((item) => (
            <li key={item} className="flex gap-2.5">
              <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-border" />
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <div className="mt-14 border-t pt-8">
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
        >
          Найти университет
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-14 border-t pt-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-10">
        <div className="space-y-1.5">
          <p className="annotation">{eyebrow}</p>
          <h2 className="font-display text-xl font-semibold tracking-tight text-balance">{title}</h2>
        </div>
        <div className="space-y-5">{children}</div>
      </div>
    </section>
  );
}

function SignalIcon({ kind }: { kind: "plus" | "minus" | "ban" }) {
  if (kind === "plus") return <Plus className="mt-1 size-3.5 shrink-0 text-ok" aria-hidden="true" />;
  if (kind === "minus") return <Minus className="mt-1 size-3.5 shrink-0 text-warn" aria-hidden="true" />;
  return <Ban className="mt-1 size-3.5 shrink-0 text-destructive" aria-hidden="true" />;
}
