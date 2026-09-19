"use client";

import { CircleCheck, ExternalLink, Globe, History, LoaderCircle, MapPin, RefreshCw, Scale } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProfileFact, UniversityEntity } from "@/lib/types";
import { compareHref, isQid } from "@/lib/ui/compare";
import { displayHost, formatDateTimeRu, formatDistanceRu, formatSecondsRu, safeHttpUrl } from "@/lib/ui/format";

export interface ProfileHeaderProps {
  entity: UniversityEntity | null;
  facts: ProfileFact[];
  startedAt: number | null; // live timer starts here
  finishedMs: number | null; // null while streaming
  cached: boolean;
  generatedAt?: string; // for the "saved profile" badge
  originalTotalMs?: number; // how long the cached profile originally took
  distanceToCityCenterM?: number;
  onRefresh?: () => void;
}

const TIMER_TICK_MS = 100;

const META_LINK =
  "inline-flex items-center gap-1.5 underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid rounded-sm";

/**
 * P4 · #4 · name, city/country, website, facts with source links, LIVE timer (tick every 100 ms while
 * finishedMs is null), badge "Сохранённый профиль · создан … за … с · Обновить" when cached,
 * "≈ N км до центра по прямой".
 */
export function ProfileHeader(props: ProfileHeaderProps) {
  const { entity, facts } = props;
  const website = safeHttpUrl(entity?.website);
  const place = [entity?.city?.name, entity?.country].filter(Boolean).join(", ");

  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="min-w-0 space-y-3">
        {entity ? (
          <h1 className="font-display text-[1.75rem] leading-[1.1] font-semibold tracking-[-0.025em] text-balance sm:text-4xl">
            {entity.name}
          </h1>
        ) : (
          // The name is the anchor of the page; while it is unknown, hold its space instead of
          // printing a placeholder sentence where the title will be.
          <div className="space-y-2" aria-busy="true">
            <p className="sr-only">Ищем университет…</p>
            <Skeleton aria-hidden="true" className="h-8 w-72 max-w-full sm:h-10" />
            <Skeleton aria-hidden="true" className="h-4 w-44" />
          </div>
        )}

        {entity ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            {place ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                {place}
              </span>
            ) : null}
            {website ? (
              <a href={website} target="_blank" rel="noopener noreferrer" className={META_LINK}>
                <Globe className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="font-mono text-[0.8125rem]">{displayHost(website)}</span>
              </a>
            ) : null}
            {props.distanceToCityCenterM !== undefined ? (
              <span>≈ {formatDistanceRu(props.distanceToCityCenterM)} до центра города по прямой</span>
            ) : null}
            {isQid(entity.qid) ? (
              <Link href={compareHref(entity.qid)} className={META_LINK}>
                <Scale className="size-3.5 shrink-0" aria-hidden="true" />
                Сравнить с другим вузом
              </Link>
            ) : null}
          </div>
        ) : null}

        {facts.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5 text-sm" aria-label="Факты об университете">
            {facts.map((fact) => (
              <li key={`${fact.label}-${fact.value}`}>
                <FactChip fact={fact} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <RunStatus {...props} />
    </header>
  );
}

function RunStatus({ startedAt, finishedMs, cached, generatedAt, originalTotalMs, onRefresh }: ProfileHeaderProps) {
  if (cached) {
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-surface px-3 py-2.5 text-sm">
        <span className="inline-flex items-start gap-2">
          <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>
            <span className="font-medium">Сохранённый профиль</span>
            {generatedAt ? (
              <span className="block text-xs text-muted-foreground">
                создан{" "}
                <time dateTime={generatedAt} className="font-mono" suppressHydrationWarning>
                  {formatDateTimeRu(generatedAt)}
                </time>
                {originalTotalMs !== undefined ? ` за ${formatSecondsRu(originalTotalMs)}` : null}
              </span>
            ) : null}
          </span>
        </span>
        {onRefresh ? (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw aria-hidden="true" />
            Обновить
          </Button>
        ) : null}
      </div>
    );
  }

  if (finishedMs !== null) {
    return (
      <p className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-ok-border bg-ok-surface px-3 py-1.5 text-sm text-ok">
        <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
        Собрано за <span className="font-mono font-medium tabular-nums">{formatSecondsRu(finishedMs)}</span>
      </p>
    );
  }

  if (startedAt === null) return null;
  return (
    <p className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border bg-surface px-3 py-1.5 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      Собираем профиль
      <LiveTimer key={startedAt} startedAt={startedAt} />
    </p>
  );
}

/** Real elapsed time since the stream started — no fake progress. */
function LiveTimer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TIMER_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="min-w-11 font-mono font-medium text-foreground tabular-nums" aria-hidden="true">
      {formatSecondsRu(Math.max(0, now - startedAt))}
    </span>
  );
}

function FactChip({ fact }: { fact: ProfileFact }) {
  const href = safeHttpUrl(fact.sourceUrl);
  const content = (
    <>
      <span className="text-muted-foreground">{fact.label}</span>
      <span className="font-medium tabular-nums">{fact.value}</span>
    </>
  );
  const chipClass = "inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-[0.8125rem]";
  if (!href) return <span className={chipClass}>{content}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Источник: ${displayHost(href)}`}
      className={`${chipClass} transition-colors hover:border-foreground/25 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid`}
    >
      {content}
      <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">(источник: {displayHost(href)})</span>
    </a>
  );
}
