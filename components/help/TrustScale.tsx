import { X } from "lucide-react";
import { TierBadge } from "@/components/profile/TierBadge";
import { TIER_THRESHOLDS } from "@/lib/config/limits";
import { cn } from "@/lib/utils";

/** The scale runs to 100 so the bands can be read as a proportion; scores above it stay «Проверено». */
const MAX_POINTS = 100;

interface Band {
  id: string;
  from: number;
  to: number;
  tier?: "verified" | "likely" | "unconfirmed";
  label: string;
}

/**
 * Bands come from lib/config/limits.ts, so the picture cannot drift away from the code that scores.
 * Ordered low → high: the bar is read left to right, like the score adding up.
 */
const BANDS: Band[] = [
  { id: "rejected", from: 0, to: TIER_THRESHOLDS.unconfirmed, label: "Отклонено" },
  {
    id: "unconfirmed",
    from: TIER_THRESHOLDS.unconfirmed,
    to: TIER_THRESHOLDS.likely,
    tier: "unconfirmed",
    label: "Не подтверждено",
  },
  { id: "likely", from: TIER_THRESHOLDS.likely, to: TIER_THRESHOLDS.verified, tier: "likely", label: "Вероятно" },
  { id: "verified", from: TIER_THRESHOLDS.verified, to: MAX_POINTS, tier: "verified", label: "Проверено" },
];

const BAND_FILL: Record<string, string> = {
  rejected: "bg-[repeating-linear-gradient(135deg,var(--muted)_0_5px,var(--background)_5px_10px)]",
  unconfirmed: "bg-tier-unconfirmed",
  likely: "bg-tier-likely",
  verified: "bg-tier-verified",
};

/**
 * Where a total lands. Squared off rather than a capsule: it is a measuring bar, and rounded ends
 * would make thresholds that are exact look approximate.
 */
export function TrustScale({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex h-3 overflow-hidden rounded-sm ring-1 ring-border ring-inset" aria-hidden="true">
        {BANDS.map((band) => (
          <span
            key={band.id}
            className={cn("h-full border-r border-background/60 last:border-r-0", BAND_FILL[band.id])}
            style={{ width: `${((band.to - band.from) / MAX_POINTS) * 100}%` }}
          />
        ))}
      </div>
      {/* Ticks sit where the thresholds actually are, so the eye can measure the bands against them. */}
      <div className="relative h-4 font-mono text-xs text-muted-foreground" aria-hidden="true">
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

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
        {[...BANDS].reverse().map((band) => (
          <li key={band.id} className="flex items-center gap-2">
            {band.tier ? (
              <TierBadge tier={band.tier} />
            ) : (
              <span className="stamp border-destructive/35 bg-destructive-surface text-destructive-foreground">
                <X className="size-3.5 shrink-0" strokeWidth={3} aria-hidden="true" />
                {band.label}
              </span>
            )}
            <span className="font-mono text-xs text-muted-foreground">
              {band.to === MAX_POINTS ? `от ${band.from}` : `${band.from}–${band.to - 1}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
