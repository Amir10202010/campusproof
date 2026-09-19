"use client";

import { CircleCheck, CircleDashed, Contrast, ExternalLink, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PhotoCard } from "@/components/profile/PhotoCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CategoryCoverage, Photo } from "@/lib/types";
import type { CompareColumn } from "@/lib/ui/compare";
import { displayHost, formatDateTimeRu, formatDistanceRu, safeHttpUrl } from "@/lib/ui/format";

export interface CompareTableProps {
  columns: [CompareColumn, CompareColumn];
  onOpenPhoto?: (photo: Photo) => void;
}

const COVERAGE_STATUS: Record<CategoryCoverage["status"], { label: string; icon: LucideIcon; className: string }> = {
  good: { label: "хорошо", icon: CircleCheck, className: "text-ok" },
  thin: { label: "мало фото", icon: Contrast, className: "text-warn" },
  none: { label: "нет подтверждённых", icon: CircleDashed, className: "text-muted-foreground" },
};

interface Cell {
  key: string;
  title: string;
  render: (column: CompareColumn) => ReactNode;
}

/**
 * P4 · #38 · two saved profiles side by side: rows are aligned on desktop, tabs on phones.
 * Presentational — data comes from lib/ui/compare.ts; photos open the evidence dialog through onOpenPhoto.
 */
export function CompareTable({ columns, onOpenPhoto }: CompareTableProps) {
  const cells: Cell[] = [
    { key: "about", title: "Вуз", render: (column) => <About column={column} /> },
    { key: "facts", title: "Факты", render: (column) => <Facts column={column} /> },
    { key: "coverage", title: "Что удалось подтвердить", render: (column) => <Coverage column={column} /> },
    ...columns[0].areas.map((area, index) => ({
      key: area.category.id,
      title: `${area.category.labelRu}: лучшие фото`,
      render: (column: CompareColumn) => <AreaPhotos column={column} index={index} onOpenPhoto={onOpenPhoto} />,
    })),
  ];

  return (
    <section aria-label="Сравнение" className="space-y-4">
      {/* Desktop: one grid per row, so both cells of a row share the same height. */}
      <div className="hidden space-y-6 sm:block">
        {cells.map((cell) => (
          <div key={cell.key} className="space-y-2">
            <h2 className="annotation border-b pb-1.5">{cell.title}</h2>
            <div className="grid grid-cols-2 gap-6">
              {columns.map((column) => (
                <div key={column.qid} className="min-w-0">
                  {cell.render(column)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Phones: one university at a time. */}
      <Tabs defaultValue={columns[0].qid} className="sm:hidden">
        <TabsList className="w-full">
          {columns.map((column) => (
            <TabsTrigger key={column.qid} value={column.qid} className="min-w-0">
              <span className="truncate">{column.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {columns.map((column) => (
          <TabsContent key={column.qid} value={column.qid} className="space-y-5 pt-2">
            {cells.map((cell) => (
              <div key={cell.key} className="space-y-2">
                <h2 className="annotation border-b pb-1.5">{cell.title}</h2>
                {cell.render(column)}
              </div>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

function About({ column }: { column: CompareColumn }) {
  const website = safeHttpUrl(column.website);
  return (
    <div className="space-y-1 text-sm">
      <Link
        href={`/u/${column.qid}`}
        className="font-display text-lg leading-snug font-semibold tracking-tight underline-offset-4 hover:underline"
      >
        {column.name}
      </Link>
      {column.place ? <p className="text-muted-foreground">{column.place}</p> : null}
      {website ? (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {displayHost(website)}
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      ) : null}
      <p className="text-muted-foreground">
        {column.distanceToCityCenterM !== undefined
          ? `≈ ${formatDistanceRu(column.distanceToCityCenterM)} до центра города по прямой`
          : "Расстояние до центра города неизвестно"}
      </p>
      <p className="text-xs text-muted-foreground">
        Проверено: {column.totals.verified} · вероятно: {column.totals.likely} · сохранённый профиль от{" "}
        <time dateTime={column.generatedAt} className="font-mono" suppressHydrationWarning>
          {formatDateTimeRu(column.generatedAt)}
        </time>
      </p>
    </div>
  );
}

function Facts({ column }: { column: CompareColumn }) {
  if (column.facts.length === 0) return <p className="text-sm text-muted-foreground">Фактов в источниках нет</p>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {column.facts.map((fact) => {
        const href = safeHttpUrl(fact.sourceUrl);
        return (
          <div key={`${fact.label}-${fact.value}`} className="contents">
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="min-w-0 break-words">
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                  {fact.value}
                </a>
              ) : (
                fact.value
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function Coverage({ column }: { column: CompareColumn }) {
  return (
    <ul className="space-y-1 text-sm">
      {column.coverage.map(({ category, coverage }) => {
        const status = COVERAGE_STATUS[coverage.status];
        const Icon = status.icon;
        return (
          <li key={category.id} className="flex items-center gap-2">
            <Icon className={`size-4 shrink-0 ${status.className}`} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{category.labelRu}</span>
            <span className={`shrink-0 text-xs ${status.className}`}>
              {status.label}
              {coverage.verified + coverage.likely > 0 ? ` · ${coverage.verified + coverage.likely}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function AreaPhotos({
  column,
  index,
  onOpenPhoto,
}: {
  column: CompareColumn;
  index: number;
  onOpenPhoto?: (photo: Photo) => void;
}) {
  const area = column.areas[index];
  if (area.photos.length === 0) return <p className="text-sm text-muted-foreground">Нет проверенных фото</p>;
  return (
    <div className="space-y-2">
      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {area.photos.map((photo) => (
          <li key={photo.id}>
            <PhotoCard photo={photo} onOpen={onOpenPhoto} />
          </li>
        ))}
      </ul>
      {area.shownTotal > area.photos.length ? (
        <Link
          href={`/u/${column.qid}#category-${area.category.id}`}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Ещё {area.shownTotal - area.photos.length} в профиле
        </Link>
      ) : null}
    </div>
  );
}
