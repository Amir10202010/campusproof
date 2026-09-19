import Link from "next/link";
import { Logo } from "./Logo";

const DATA_SOURCES = [
  { name: "Wikidata", url: "https://www.wikidata.org" },
  { name: "Wikipedia", url: "https://www.wikipedia.org" },
  { name: "Wikimedia Commons", url: "https://commons.wikimedia.org" },
  { name: "Openverse", url: "https://openverse.org" },
  { name: "Serper", url: "https://serper.dev" },
];

const REPOSITORY_URL = "https://github.com/Amir10202010/campusproof";

const LINK = "underline-offset-4 transition-colors hover:text-foreground hover:underline";

/** P4 · #36 · data sources, AI provider, hackathon and repository. */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 text-[0.9375rem] sm:grid-cols-[1.6fr_1fr_1fr] sm:px-6">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs leading-relaxed text-muted-foreground">
            Проверенные фото университетов: у каждого снимка есть источник, дата и уровень доверия.
          </p>
          <Link href="/how-it-works" className={`inline-block font-medium ${LINK}`}>
            Как мы проверяем фото
          </Link>
        </div>

        <div className="space-y-3">
          <h2 className="annotation">Источники данных</h2>
          <ul className="space-y-1.5 text-muted-foreground">
            {DATA_SOURCES.map((source) => (
              <li key={source.name}>
                <a href={source.url} target="_blank" rel="noopener noreferrer" className={LINK}>
                  {source.name}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="annotation">О проекте</h2>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>AI: Google Gemini (бесплатный тариф)</li>
            <li>LOCUS Startup Hackathon 2026 · кейс 1</li>
            <li>
              <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
                Код на GitHub
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
