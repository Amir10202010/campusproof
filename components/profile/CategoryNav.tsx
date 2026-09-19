"use client";

import { useEffect, useState } from "react";
import type { CategoryConfig } from "@/lib/config/categories";
import type { CategoryCoverage, CategoryId } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface CategoryNavProps {
  /** Only the sections actually rendered on the page — every entry must have an anchor to jump to. */
  categories: readonly CategoryConfig[];
  coverage: Record<CategoryId, CategoryCoverage>;
  /** Photos currently visible in each section, after filters. */
  counts: Partial<Record<CategoryId, number>>;
}

const STATUS_DOT: Record<CategoryCoverage["status"], string> = {
  good: "bg-tier-verified",
  thin: "bg-warn",
  none: "bg-muted-foreground/35",
};

const STATUS_LABEL: Record<CategoryCoverage["status"], string> = {
  good: "хорошо покрыт",
  thin: "мало фото",
  none: "нет подтверждённых фото",
};

/**
 * Where you are in a profile that runs for several screens, and one click to any section. Desktop only:
 * on a phone the filter bar already sits above the stream and a second sticky rail would eat the photos.
 *
 * The marker follows the section the reader is actually looking at, so the rail reports position rather
 * than just offering links.
 */
export function CategoryNav({ categories, coverage, counts }: CategoryNavProps) {
  const active = useActiveSection(categories.map((category) => `category-${category.id}`));

  return (
    <nav aria-label="Разделы профиля" className="space-y-2">
      <p className="annotation">Разделы</p>
      <ul className="border-l">
        {categories.map((category) => {
          const id = `category-${category.id}`;
          const status = coverage[category.id].status;
          const count = counts[category.id] ?? 0;
          const isActive = active === id;
          return (
            <li key={category.id}>
              <a
                href={`#${id}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "-ml-px flex items-center gap-2 border-l py-1.5 pl-3 text-[0.8125rem] transition-colors",
                  "rounded-r-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid",
                  isActive
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[status])} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{category.labelRu}</span>
                <span className="font-mono text-[0.6875rem] text-muted-foreground tabular-nums">{count}</span>
                <span className="sr-only">
                  — {STATUS_LABEL[status]}, показано {count}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The topmost section currently intersecting the viewport, below the sticky header and filter bar.
 * Falls back to the first id until something is observed, so the rail is never blank.
 */
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join(",");

  useEffect(() => {
    const sections = key
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // The header and the filter bar are opaque and cover the top 145px; discount that, so the rail
      // marks the section the reader can actually see. IntersectionObserver takes px and %, never rem.
      { rootMargin: "-150px 0px -55% 0px", threshold: 0 },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [key]);

  return active ?? ids[0] ?? null;
}
