import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { DegradedFlag } from "@/lib/types";

export interface DegradedBannerProps {
  degraded: DegradedFlag[];
}

/** Texts follow docs/architecture.md §8.3 and the degraded scoring rules in §5.6. */
const DEGRADED_TEXT_RU: Record<DegradedFlag, { title: string; text: string }> = {
  web_search_unavailable: {
    title: "Веб-поиск недоступен",
    text: "Ищем только в открытых фотоархивах и энциклопедиях, поэтому фото может быть меньше.",
  },
  vision_unavailable: {
    title: "Визуальная проверка недоступна",
    text: "«Проверено» получают только фото, подтверждённые источником или геометкой. Фото только из веб-поиска — не выше «Не подтверждено».",
  },
  wikimedia_unavailable: {
    title: "Wikimedia недоступна",
    text: "Wikidata, Википедия и Wikimedia Commons не ответили, поэтому подтвердить удаётся меньше фото.",
  },
};

/** P4 · #4 · one honest banner per flag (texts in docs/architecture.md §8.3). Renders nothing when empty. */
export function DegradedBanner({ degraded }: DegradedBannerProps) {
  if (degraded.length === 0) return null;
  return (
    <div className="space-y-2">
      {[...new Set(degraded)].map((flag) => (
        <Alert key={flag} className="border-amber-300 bg-amber-50 text-amber-950">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{DEGRADED_TEXT_RU[flag].title}</AlertTitle>
          <AlertDescription className="text-amber-950/80">{DEGRADED_TEXT_RU[flag].text}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
