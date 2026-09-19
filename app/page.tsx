import { ArrowRight, CalendarDays, ExternalLink, ScanSearch } from "lucide-react";
import Link from "next/link";
import { HomeSearch } from "@/components/search/HomeSearch";
import { REQUIRED_AREAS } from "@/lib/config/categories";

/** Search examples cover an ambiguous abbreviation, a local and an international university. */
const EXAMPLES = ["MSU", "Назарбаев Университет", "Harvard University"];

const PHOTO_DETAILS = [
  { icon: ExternalLink, title: "Источник", text: "Ссылка на страницу, где опубликован снимок." },
  { icon: CalendarDays, title: "Дата", text: "Когда сняли, опубликовали или нашли фото — с точной пометкой." },
  { icon: ScanSearch, title: "Доказательства", text: "Что связывает снимок с вузом и насколько этому можно доверять." },
];

/** P4 · home: start a search first; explain the evidence without making users learn the scorer. */
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="grid grid-cols-1 gap-12 pt-12 pb-14 sm:pt-20 sm:pb-20 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-end lg:gap-16 lg:pt-24">
        <div>
          <h1 className="font-display text-hero font-semibold text-balance">
            Ваш будущий вуз.
            <br />
            <span className="text-muted-foreground">В фотографиях.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Найдите университет. Посмотрите кампус, общежития и аудитории — с источниками и проверкой каждого снимка.
          </p>
          <div className="mt-8 sm:mt-10">
            <HomeSearch examples={EXAMPLES} />
          </div>
        </div>

        <div className="border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <h2 className="text-base font-semibold">У каждого фото — своя история</h2>
          <dl className="mt-6 space-y-6">
            {PHOTO_DETAILS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 gap-y-1">
                <dt className="col-span-2 flex gap-3 font-medium">
                  <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {title}
                </dt>
                <dd className="col-start-2 text-base leading-relaxed text-muted-foreground">{text}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/how-it-works"
            className="mt-6 inline-flex min-h-11 items-center gap-2 text-base font-medium underline-offset-4 hover:underline"
          >
            Как мы проверяем фото
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section
        aria-labelledby="profile-title"
        className="grid gap-8 border-t py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] lg:gap-16"
      >
        <div>
          <h2 id="profile-title" className="font-display text-display font-semibold text-balance">
            От кампуса до города
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            Всё в одном профиле. Откройте любое фото, чтобы увидеть источник и доказательства. Если снимков нет, скажем
            об этом — без случайных замен.
          </p>
        </div>
        <dl className="divide-y">
          {REQUIRED_AREAS.map((area) => (
            <div key={area.id} className="grid gap-x-6 gap-y-1 py-4 first:pt-0 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <dt className="text-lg font-medium">{area.labelRu}</dt>
              <dd className="text-base leading-relaxed text-muted-foreground">{area.descriptionRu}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
