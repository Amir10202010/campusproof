import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { DegradedFlag } from "@/lib/types";

export interface DegradedBannerProps {
  degraded: DegradedFlag[];
  /** The visual check answered for some photos only (source status "partial"): the banner says so. */
  visionPartial?: boolean;
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

/** Most photos were checked, some were not (#118): "недоступна" would overstate it. */
const VISION_PARTIAL_TEXT_RU = {
  title: "Визуальная проверка прошла не для всех фото",
  text: "Часть снимков модель не успела посмотреть — обычно кончается бесплатная квота Gemini. Для них «Проверено» дают только источник или геометка, а фото только из веб-поиска — не выше «Не подтверждено». Такой профиль не сохраняется.",
};

/** P4 · #4 · one honest banner per flag (texts in docs/architecture.md §8.3). Renders nothing when empty. */
export function DegradedBanner({ degraded, visionPartial = false }: DegradedBannerProps) {
  if (degraded.length === 0) return null;
  return (
    <div className="space-y-2">
      {[...new Set(degraded)].map((flag) => {
        const { title, text } =
          flag === "vision_unavailable" && visionPartial ? VISION_PARTIAL_TEXT_RU : DEGRADED_TEXT_RU[flag];
        return (
          <Alert key={flag} className="border-amber-300 bg-amber-50 text-amber-950">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription className="text-amber-950/80">{text}</AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
