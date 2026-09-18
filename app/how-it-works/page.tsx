import { ArrowLeft, ArrowRight, Ban, ChevronRight, ExternalLink, Minus, Plus, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { TierBadge } from "@/components/profile/TierBadge";
import { CATEGORIES } from "@/lib/config/categories";
import { GEO, LIMITS, TIER_THRESHOLDS } from "@/lib/config/limits";
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
      `Геометка в том же городе — до ${formatDistanceRu(GEO.SAME_CITY_M)}`,
      "Сцена соответствует разделу: например, на фото действительно читальный зал",
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
      "Фото со стокового сайта или агрегатора",
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

/** «34 балла», «59 баллов»: thresholds come from lib/config/limits.ts, so the wording must follow the number. */
const points = (n: number) => `${n} ${pluralRu(n, ["балл", "балла", "баллов"])}`;

const PROFILE_CACHE_DAYS = Math.round(LIMITS.PROFILE_CACHE_TTL_S / 86_400);
const DEADLINE_S = Math.round(LIMITS.GLOBAL_DEADLINE_MS / 1000);

/** P4 · #5 · methodology page: pipeline, signals and tiers in plain language (architecture §5.6), sources, limits. */
export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-12 px-4 py-8 sm:px-6 sm:py-12">
      <div className="space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-3 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          CampusProof
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Как мы проверяем фото</h1>
        <p className="text-muted-foreground">
          CampusProof не показывает случайную выдачу поиска. У каждого фото есть источник, дата и уровень доверия, а за
          уровнем — список доказательств, который можно открыть кликом по фото.
        </p>
      </div>

      <Section title="Путь от названия до профиля">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium" aria-hidden="true">
          {STEPS.map((step, index) => (
            <span key={step.title} className="inline-flex items-center gap-1.5">
              <span className="rounded-full border px-2.5 py-1">{step.title}</span>
              {index < STEPS.length - 1 ? <ChevronRight className="size-4 text-muted-foreground" /> : null}
            </span>
          ))}
        </p>
        <ol className="space-y-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {index + 1}
              </span>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Уровни доверия">
        <ul className="space-y-3 text-sm">
          <TierRow badge={<TierBadge tier="verified" />}>
            от {TIER_THRESHOLDS.verified} баллов, есть хотя бы одно сильное доказательство и нет противоречий на снимке.
            Показываем сразу.
          </TierRow>
          <TierRow badge={<TierBadge tier="likely" />}>
            {TIER_THRESHOLDS.likely}–{points(TIER_THRESHOLDS.verified - 1)} или от {TIER_THRESHOLDS.verified} без
            сильного доказательства. Показываем с пометкой.
          </TierRow>
          <TierRow badge={<TierBadge tier="unconfirmed" />}>
            {TIER_THRESHOLDS.unconfirmed}–{points(TIER_THRESHOLDS.likely - 1)}. Скрыто, пока не включить «Показывать
            неподтверждённые».
          </TierRow>
          <TierRow
            badge={
              <span className="inline-flex h-5 items-center gap-1 rounded-4xl border border-red-200 bg-red-50 px-2 text-xs font-medium text-red-900">
                <X className="size-3" strokeWidth={2.5} aria-hidden="true" />
                Отклонено
              </span>
            }
          >
            меньше {TIER_THRESHOLDS.unconfirmed} баллов или причина из списка «Сразу отклоняем». В профиль не попадает;
            причина видна в разделе «Отфильтровано».
          </TierRow>
        </ul>
        <p className="rounded-xl bg-muted/60 p-4 text-sm">
          Баллы — это не вероятность, а сумма за найденные доказательства. Уровень выставляет код по заранее заданным
          правилам. Нейросеть только описывает, что видит на снимке, и оценку сама не ставит.
        </p>
      </Section>

      <Section title="Какие доказательства мы ищем">
        <div className="grid gap-6 sm:grid-cols-2">
          {SIGNALS.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="font-medium">{group.title}</h3>
              <ul className="space-y-1.5 text-sm">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <SignalIcon kind={group.icon} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Если визуальная проверка недоступна, «Проверено» можно получить только по происхождению или геометке, а фото
          только из веб-поиска остаются не выше «Не подтверждено».
        </p>
      </Section>

      <Section title="Источники">
        <ul className="divide-y rounded-xl border text-sm">
          {SOURCES.map((source) => (
            <li key={source.name} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-3">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 font-medium underline-offset-3 hover:underline sm:w-44"
              >
                {source.name}
                <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
              </a>
              <span className="text-muted-foreground">{source.text}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Стоковые фотобанки не используем. Google Картинки, Instagram, Facebook, VK и 2ГИС не парсим — только
          официальные API и открытые данные.
        </p>
      </Section>

      <Section title="Ограничения">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>
            Не определяем, сгенерировано ли фото нейросетью: опираемся на происхождение снимка — где он опубликован, кем
            и с какими метаданными.
          </li>
          <li>
            Для визуальной проверки и описания используем бесплатный Gemini. Его условия не разрешают бесплатный тариф
            для пользователей из Европейской экономической зоны (ЕС, Исландия, Лихтенштейн, Норвегия), Швейцарии и
            Великобритании. Поэтому для посетителей оттуда визуальная проверка отключена, а описание — цитата из
            Википедии. Профиль всё равно строится, а баннер предупреждает об ограничении.
          </li>
          <li>
            У фото из веба часто нет даты съёмки. Тогда пишем, когда снимок опубликован или когда мы его нашли, и не
            выдаём это за дату съёмки.
          </li>
          <li>Не просим нейросеть узнавать людей и не показываем крупные портреты.</li>
          <li>
            Лучше всего протестировано на вузах Казахстана, Центральной Азии и крупных международных университетах. У
            небольших вузов открытых фото бывает мало — тогда честно показываем пустые разделы.
          </li>
          <li>
            На сборку профиля есть общий лимит — {DEADLINE_S} {pluralRu(DEADLINE_S, ["секунда", "секунды", "секунд"])}:
            медленный источник не задерживает весь профиль. Готовый профиль сохраняется до {PROFILE_CACHE_DAYS}{" "}
            {pluralRu(PROFILE_CACHE_DAYS, ["дня", "дней", "дней"])}; у сохранённого видна дата создания и кнопка
            «Обновить».
          </li>
        </ul>
      </Section>

      <Link
        href="/"
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:outline-solid"
      >
        Найти университет
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function TierRow({ badge, children }: { badge: ReactNode; children: ReactNode }) {
  return (
    <li className="flex flex-col items-start gap-1.5 sm:flex-row sm:gap-3">
      <span className="shrink-0 sm:w-36">{badge}</span>
      <span className="text-muted-foreground">{children}</span>
    </li>
  );
}

function SignalIcon({ kind }: { kind: "plus" | "minus" | "ban" }) {
  if (kind === "plus") return <Plus className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />;
  if (kind === "minus") return <Minus className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />;
  return <Ban className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />;
}
