import { POINTS } from "@/lib/scoring/signals";
import { cn } from "@/lib/utils";

/**
 * The rules, not a worked example: every figure is read from POINTS in lib/scoring/signals.ts, so the
 * page cannot promise a number the scorer does not actually award. Wording follows the methodology
 * page. Server component — POINTS lives next to server-only geo helpers and must not reach the client.
 */
const ROWS: { signal: keyof typeof POINTS; label: string }[] = [
  { signal: "commons_depicts", label: "В Wikimedia Commons отмечено, что на фото этот вуз" },
  { signal: "commons_category", label: "Лежит в категории университета на Commons" },
  { signal: "geo_near_campus", label: "Геометка рядом с кампусом" },
  { signal: "geo_in_city", label: "Геометка в черте города — для раздела «Город»" },
  { signal: "wikipedia_use", label: "Используется в статье Википедии об университете" },
  { signal: "official_domain", label: "На официальном сайте вуза, без признаков стока или рендера" },
  { signal: "official_domain_weak", label: "На официальном сайте, но похоже на сток или рендер" },
  { signal: "visible_text_this", label: "На снимке читается название этого вуза" },
  { signal: "cross_source_match", label: "Тот же снимок нашёлся ещё на одном сайте" },
  { signal: "page_mentions_name", label: "Вуз упомянут в подписи или в адресе страницы" },
  { signal: "news_mentions_name", label: "Новостная статья упоминает университет" },
  { signal: "visual_consistent", label: "Сцена соответствует описанию вуза" },
  { signal: "geo_same_city", label: "Геометка в том же городе — для остальных разделов" },
  { signal: "visual_inconsistent", label: "Сцена не похожа на описание этого вуза" },
  { signal: "render", label: "Похоже на рендер или иллюстрацию, а не на фотографию" },
  { signal: "low_res", label: "Проверить удалось только маленькую копию" },
];

const sign = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

export function ScoringTable({ className }: { className?: string }) {
  return (
    <table className={cn("w-full border-collapse text-left", className)}>
      <caption className="sr-only">Сколько очков даёт каждый признак</caption>
      <thead>
        <tr className="border-b">
          <th scope="col" className="annotation w-20 pb-2.5 sm:w-28">
            Очки
          </th>
          <th scope="col" className="annotation pb-2">
            Признак
          </th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map(({ signal, label }) => {
          const value = POINTS[signal];
          return (
            <tr key={signal} className="border-b border-border/60 last:border-b-0">
              <td
                className={cn(
                  "py-3.5 pr-4 align-baseline font-mono text-lg font-medium tabular-nums",
                  value > 0 ? "text-foreground" : "text-destructive",
                )}
              >
                {sign(value)}
              </td>
              <td className="py-3.5 align-baseline text-base leading-snug text-muted-foreground">{label}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
