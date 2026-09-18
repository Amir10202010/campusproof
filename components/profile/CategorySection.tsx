"use client";

import { Images } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryConfig } from "@/lib/config/categories";
import { LIMITS } from "@/lib/config/limits";
import type { CategoryCoverage, Photo } from "@/lib/types";
import { sortForDisplay } from "@/lib/ui/filters";
import { pluralRu } from "@/lib/ui/format";
import { TIER_LABEL_RU } from "@/lib/ui/labels";
import { PhotoCard } from "./PhotoCard";

export interface CategorySectionProps {
  category: CategoryConfig;
  photos: Photo[]; // already filtered for this category
  coverage: CategoryCoverage;
  onOpenPhoto?: (photo: Photo) => void;
  /** The run is still going: an empty section means "not checked yet", not "nothing we could confirm". */
  loading?: boolean;
}

const TIERS = ["verified", "likely", "unconfirmed"] as const;

/** P4 · #3 · title + description from config, counts, grid (2 cols mobile / 4 desktop), honest empty state. */
export function CategorySection({ category, photos, coverage, onOpenPhoto, loading }: CategorySectionProps) {
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => sortForDisplay(photos), [photos]);
  const shown = expanded ? sorted : sorted.slice(0, LIMITS.PHOTOS_PER_CATEGORY_DISPLAY);
  const tierCounts = TIERS.map((tier) => ({ tier, count: photos.filter((p) => p.tier === tier).length })).filter(
    ({ count }) => count > 0,
  );
  const titleId = `category-${category.id}-title`;

  return (
    <section id={`category-${category.id}`} aria-labelledby={titleId} className="scroll-mt-28 space-y-3">
      <div className="space-y-0.5">
        <h2 id={titleId} className="flex items-baseline gap-2 text-lg font-semibold tracking-tight">
          {category.labelRu}
          <span className="text-sm font-normal text-muted-foreground tabular-nums">{photos.length} фото</span>
        </h2>
        <p className="text-sm text-muted-foreground">{category.descriptionRu}</p>
        {tierCounts.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {tierCounts.map(({ tier, count }) => `${TIER_LABEL_RU[tier]}: ${count}`).join(" · ")}
          </p>
        ) : null}
      </div>

      {photos.length === 0 ? (
        loading ? (
          <PendingCategory />
        ) : (
          <EmptyCategory coverage={coverage} />
        )
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((photo) => (
            <li key={photo.id}>
              <PhotoCard photo={photo} onOpen={onOpenPhoto} />
            </li>
          ))}
        </ul>
      )}

      {sorted.length > LIMITS.PHOTOS_PER_CATEGORY_DISPLAY ? (
        <Button variant="outline" size="sm" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Свернуть" : `Показать ещё ${sorted.length - LIMITS.PHOTOS_PER_CATEGORY_DISPLAY}`}
        </Button>
      ) : null}
    </section>
  );
}

/**
 * While the run is going, an empty section is not a verdict. Showing the finished wording early made
 * eight sections look like eight failures at the moment the pipeline was still downloading images.
 */
function PendingCategory() {
  return (
    <ul aria-busy="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((index) => (
        <li key={index} className="overflow-hidden rounded-xl border">
          <Skeleton className="aspect-4/3 w-full rounded-none" />
          <div className="space-y-1.5 px-2.5 py-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </li>
      ))}
      <li className="sr-only">Ищем фото для этого раздела…</li>
    </ul>
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
    <div className="flex items-start gap-3 rounded-xl border border-dashed px-4 py-3 text-sm">
      <Images className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
