import { X } from "lucide-react";
import { TierBadge } from "@/components/profile/TierBadge";
import { TIER_THRESHOLDS } from "@/lib/config/limits";
import { pluralRu } from "@/lib/ui/format";
import { cn } from "@/lib/utils";

/** The scale runs to 100 so the bands can be read as a proportion; scores above it stay «Проверено». */
const MAX_POINTS = 100;

interface Band {
  id: string;
  from: number;
  to: number;
  tier?: "verified" | "likely" | "unconfirmed";
  label: string;
  meaning: string;
}

/**
 * Bands come from lib/config/limits.ts, so the picture cannot drift away from the code that scores.
 * Ordered low → high: the bar is read left to right, like the score adding up.
 */
const BANDS: Band[] = [
  {
    id: "rejected",
    from: 0,
    to: TIER_THRESHOLDS.unconfirmed,
    label: "Отклонено",
    meaning: "В профиль не попадает. Причину видно в разделе «Отфильтровано».",
  },
  {
    id: "unconfirmed",
    from: TIER_THRESHOLDS.unconfirmed,
    to: TIER_THRESHOLDS.likely,
    tier: "unconfirmed",
    label: "Не подтверждено",
    meaning: "Скрыто, пока вы сами не включите «Показывать неподтверждённые».",
  },
  {
    id: "likely",
    from: TIER_THRESHOLDS.likely,
    to: TIER_THRESHOLDS.verified,
    tier: "likely",
    label: "Вероятно",
    meaning: "Доказательств меньше или нет ни одного сильного. Показываем с пометкой.",
  },
  {
    id: "verified",
    from: TIER_THRESHOLDS.verified,
    to: MAX_POINTS,
    tier: "verified",
    label: "Проверено",
    meaning: "Есть сильное доказательство и нет противоречий на снимке. Показываем сразу.",
  },
];

const BAND_FILL: Record<string, string> = {
  rejected: "bg-[repeating-linear-gradient(135deg,var(--muted)_0_5px,var(--background)_5px_10px)]",
  unconfirmed: "bg-tier-unconfirmed",
  likely: "bg-tier-likely",
  verified: "bg-tier-verified",
};

const points = (n: number) => `${n} ${pluralRu(n, ["балл", "балла", "баллов"])}`;

/**
 * The signature instrument: how a pile of evidence becomes a verdict. Every number on it is read from
 * the scoring config, never typed in — the scale and the pipeline cannot disagree.
 */
export function TrustScale({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <div className="flex h-2.5 overflow-hidden rounded-full ring-1 ring-border ring-inset" aria-hidden="true">
          {BANDS.map((band) => (
            <span
              key={band.id}
              className={cn("h-full border-r border-background/60 last:border-r-0", BAND_FILL[band.id])}
              style={{ width: `${((band.to - band.from) / MAX_POINTS) * 100}%` }}
            />
          ))}
        </div>
        {/* Ticks sit where the thresholds actually are, so the eye can measure the bands against them. */}
        <div className="relative h-4 font-mono text-[0.6875rem] text-muted-foreground" aria-hidden="true">
          {BANDS.map((band) => (
            <span
              key={band.id}
              className="absolute -translate-x-1/2 first:translate-x-0"
              style={{ left: `${(band.from / MAX_POINTS) * 100}%` }}
            >
              {band.from}
            </span>
          ))}
          <span className="absolute right-0">{MAX_POINTS}+</span>
        </div>
      </div>

      <ul className="grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
        {[...BANDS].reverse().map((band) => (
          <li key={band.id} className="flex flex-col items-start gap-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {band.tier ? (
                <TierBadge tier={band.tier} />
              ) : (
                <span className="inline-flex h-5 items-center gap-1 rounded-4xl border border-destructive/35 bg-destructive-surface px-2 text-xs font-medium text-destructive-foreground">
                  <X className="size-3" strokeWidth={2.5} aria-hidden="true" />
                  {band.label}
                </span>
              )}
              <span className="font-mono text-[0.6875rem] text-muted-foreground">
                {band.to === MAX_POINTS ? `от ${points(band.from)}` : `${band.from}–${band.to - 1}`}
              </span>
            </span>
            <span className="text-sm leading-relaxed text-muted-foreground">{band.meaning}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
