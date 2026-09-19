"use client";

import { ChevronDown, Images } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CategoryConfig } from "@/lib/config/categories";
import { LIMITS } from "@/lib/config/limits";
import type { CategoryCoverage, Photo } from "@/lib/types";
import { sortForDisplay } from "@/lib/ui/filters";
import { pluralRu } from "@/lib/ui/format";
import { TIER_LABEL_RU } from "@/lib/ui/labels";
import { cn } from "@/lib/utils";
import { PhotoCard } from "./PhotoCard";

export interface CategorySectionProps {
  category: CategoryConfig;
  photos: Photo[]; // already filtered for this category
  coverage: CategoryCoverage;
  onOpenPhoto?: (photo: Photo) => void;
}

const TIERS = ["verified", "likely", "unconfirmed"] as const;

const TIER_DOT: Record<(typeof TIERS)[number], string> = {
  verified: "bg-tier-verified",
  likely: "bg-warn",
  unconfirmed: "bg-muted-foreground/45",
};

/** P4 · #3 · title + description from config, counts, grid (2 cols mobile / 4 desktop), honest empty state. */
export function CategorySection({ category, photos, coverage, onOpenPhoto }: CategorySectionProps) {
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => sortForDisplay(photos), [photos]);
  const shown = expanded ? sorted : sorted.slice(0, LIMITS.PHOTOS_PER_CATEGORY_DISPLAY);
  const tierCounts = TIERS.map((tier) => ({ tier, count: photos.filter((p) => p.tier === tier).length })).filter(
    ({ count }) => count > 0,
  );
  const titleId = `category-${category.id}-title`;

  return (
    <section id={`category-${category.id}`} aria-labelledby={titleId} className="scroll-mt-40 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-2.5">
        <div className="min-w-0 space-y-0.5">
          <h2 id={titleId} className="flex items-baseline gap-2.5 font-display text-lg font-semibold tracking-tight">
            {category.labelRu}
            <span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">{photos.length}</span>
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">{category.descriptionRu}</p>
        </div>
        {tierCounts.length > 0 ? (
          <ul className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-muted-foreground">
            {tierCounts.map(({ tier, count }) => (
              <li key={tier} className="inline-flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", TIER_DOT[tier])} aria-hidden="true" />
                {TIER_LABEL_RU[tier]}
                <span className="font-mono tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {photos.length === 0 ? (
        <EmptyCategory coverage={coverage} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((photo) => (
            <li key={photo.id}>
              <PhotoCard photo={photo} onOpen={onOpenPhoto} />
            </li>
          ))}
        </ul>
      )}

      {sorted.length > LIMITS.PHOTOS_PER_CATEGORY_DISPLAY ? (
        <Button variant="outline" size="sm" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} aria-hidden="true" />
          {expanded ? "Свернуть" : `Показать ещё ${sorted.length - LIMITS.PHOTOS_PER_CATEGORY_DISPLAY}`}
        </Button>
      ) : null}
    </section>
  );
}

/** Honest empty state: we say what we could not confirm, never that the place doesn't exist. */
function EmptyCategory({ coverage }: { coverage: CategoryCoverage }) {
  const shownByDefault = coverage.verified + coverage.likely;
  let title = "Пока нет проверенных фото";
  let hint = "Показываем только снимки, происхождение которых можем подтвердить.";
  if (shownByDefault > 0) {
    title = "Нет фото под выбранные фильтры";
    hint = `Скрыто фильтрами: ${shownByDefault}.`;
  } else if (coverage.unconfirmed > 0) {
    const noun = pluralRu(coverage.unconfirmed, ["неподтверждённое", "неподтверждённых", "неподтверждённых"]);
    hint = `Есть ${coverage.unconfirmed} ${noun} фото — включите «Показывать неподтверждённые».`;
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed px-4 py-3.5 text-sm">
      <Images className="mt-0.5 size-4.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
