import { MANDATORY_FILTERS, REQUIRED_AREAS } from "@/lib/config/categories";

/**
 * Temporary home page. P4 replaces it with the real search experience (docs/product-strategy.md §12).
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-24">
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">LOCUS Startup Hackathon 2026 · Кейс 01</p>
        <h1 className="text-4xl font-semibold tracking-tight">CampusProof</h1>
        <p className="text-lg text-muted-foreground">
          Введите название университета — и получите проверенные фотографии с источниками, а не случайную выдачу поиска.
        </p>
      </div>

      {/* Temporary plain form (works without JS). P4 · #5 replaces it with <SearchBox>. */}
      <form action="/search" method="get" className="flex gap-2">
        <input
          name="q"
          required
          maxLength={120}
          placeholder="Название университета, например KBTU"
          className="h-10 flex-1 rounded-md border px-3 text-sm"
        />
        <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Найти
        </button>
      </form>
      <p className="text-xs text-muted-foreground">
        Сервис в разработке: этапы пайплайна подключаются по мере готовности.
      </p>

      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="mb-2 font-medium">Разделы профиля</p>
          <ul className="space-y-1 text-muted-foreground">
            {REQUIRED_AREAS.map((c) => (
              <li key={c.id}>{c.labelRu}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 font-medium">Фильтры</p>
          <ul className="space-y-1 text-muted-foreground">
            {MANDATORY_FILTERS.map((c) => (
              <li key={c.id}>{c.filterLabelRu}</li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
