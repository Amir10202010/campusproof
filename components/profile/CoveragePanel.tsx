"use client";

import { CircleCheck, CircleDashed, Contrast, type LucideIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORIES, type CategoryConfig } from "@/lib/config/categories";
import type { CategoryCoverage, CategoryId } from "@/lib/types";
import { pluralRu } from "@/lib/ui/format";

export interface CoveragePanelProps {
  coverage: Record<CategoryId, CategoryCoverage>;
  onShowUnconfirmed?: (category: CategoryId) => void;
}

const STATUS: Record<CategoryCoverage["status"], { label: string; icon: LucideIcon; className: string }> = {
  good: { label: "Хорошо", icon: CircleCheck, className: "text-emerald-700" },
  thin: { label: "Мало фото", icon: Contrast, className: "text-amber-700" },
  none: { label: "Нет подтверждённых фото", icon: CircleDashed, className: "text-muted-foreground" },
};

/** P4 · #4 · per category good / thin / none with human text ("Нет проверенных фото общежитий. 1 неподтверждённое — показать"). */
export function CoveragePanel({ coverage, onShowUnconfirmed }: CoveragePanelProps) {
  const titleId = useId();
  const good = CATEGORIES.filter((category) => coverage[category.id].status === "good").length;

  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-xl border p-4">
      <div className="space-y-1">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          Что удалось подтвердить
        </h2>
        <p className="text-sm text-muted-foreground">
          Хорошо покрыто разделов: {good} из {CATEGORIES.length}. «Хорошо» — от 3 фото с уровнем «Проверено» или
          «Вероятно».
        </p>
      </div>
      <ul className="divide-y">
        {CATEGORIES.map((category) => (
          <CoverageRow
            key={category.id}
            category={category}
            coverage={coverage[category.id]}
            onShowUnconfirmed={onShowUnconfirmed}
          />
        ))}
      </ul>
    </section>
  );
}

function CoverageRow({
  category,
  coverage,
  onShowUnconfirmed,
}: {
  category: CategoryConfig;
  coverage: CategoryCoverage;
  onShowUnconfirmed?: (category: CategoryId) => void;
}) {
  const status = STATUS[coverage.status];
  const Icon = status.icon;
  const shown = coverage.verified + coverage.likely;
  const breakdown = [
    coverage.verified > 0 ? `проверено ${coverage.verified}` : null,
    coverage.likely > 0 ? `вероятно ${coverage.likely}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const showUnconfirmed = () => {
    onShowUnconfirmed?.(category.id);
    requestAnimationFrame(() =>
      document.getElementById(`category-${category.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  return (
    <li className="flex items-start gap-3 py-2.5 text-sm">
      <Icon className={`mt-0.5 size-4 shrink-0 ${status.className}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <a href={`#category-${category.id}`} className="font-medium underline-offset-3 hover:underline">
            {category.labelRu}
          </a>
          <span className={status.className}>{status.label}</span>
          {category.requiredArea ? <span className="text-xs text-muted-foreground">обязательный раздел</span> : null}
        </p>
        <p className="text-muted-foreground">
          {shown > 0
            ? `${shown} фото: ${breakdown}`
            : coverage.unconfirmed > 0
              ? `Нет проверенных фото. ${coverage.unconfirmed} ${pluralRu(coverage.unconfirmed, ["неподтверждённое", "неподтверждённых", "неподтверждённых"])} — можно посмотреть с предупреждением.`
              : "Не нашли снимков, происхождение которых можем подтвердить."}
          {shown > 0 && coverage.unconfirmed > 0 ? ` · ещё не подтверждено: ${coverage.unconfirmed}` : null}
        </p>
      </div>
      {coverage.unconfirmed > 0 && shown === 0 && onShowUnconfirmed ? (
        <Button variant="outline" size="sm" className="shrink-0" onClick={showUnconfirmed}>
          Показать
        </Button>
      ) : null}
    </li>
  );
}
