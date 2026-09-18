"use client";

import { CircleCheck, ExternalLink, Globe, History, LoaderCircle, MapPin, RefreshCw, Scale } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
    <header className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1.5">
          <h1
            className={
              entity
                ? "text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
                : "text-2xl font-semibold tracking-tight text-muted-foreground sm:text-3xl"
            }
          >
            {entity?.name ?? "Ищем университет…"}
          </h1>
          {entity ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {place ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {place}
                </span>
              ) : null}
              {website ? (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline-offset-3 hover:text-foreground hover:underline"
                >
                  <Globe className="size-3.5" aria-hidden="true" />
                  {displayHost(website)}
                </a>
              ) : null}
              {props.distanceToCityCenterM !== undefined ? (
                <span>≈ {formatDistanceRu(props.distanceToCityCenterM)} до центра города по прямой</span>
              ) : null}
              {isQid(entity.qid) ? (
                <Link
                  href={compareHref(entity.qid)}
                  className="inline-flex items-center gap-1 underline-offset-3 hover:text-foreground hover:underline"
                >
                  <Scale className="size-3.5" aria-hidden="true" />
                  Сравнить с другим вузом
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
        <RunStatus {...props} />
      </div>

      {facts.length > 0 ? (
        <ul className="flex flex-wrap gap-2 text-sm" aria-label="Факты об университете">
          {facts.map((fact) => (
            <li key={`${fact.label}-${fact.value}`}>
              <FactChip fact={fact} />
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}

function RunStatus({ startedAt, finishedMs, cached, generatedAt, originalTotalMs, onRefresh }: ProfileHeaderProps) {
  if (cached) {
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-muted/50 px-3 py-2 text-sm">
        <span className="inline-flex items-start gap-1.5">
          <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>
            <span className="font-medium">Сохранённый профиль</span>
            {generatedAt ? (
              <span className="block text-xs text-muted-foreground">
                создан{" "}
                <time dateTime={generatedAt} suppressHydrationWarning>
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
      <p className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
        <CircleCheck className="size-4 text-emerald-700" aria-hidden="true" />
        Завершено за <span className="font-medium text-foreground tabular-nums">{formatSecondsRu(finishedMs)}</span>
      </p>
    );
  }

  if (startedAt === null) return null;
  return (
    <p className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
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
    <span className="min-w-12 font-medium text-foreground tabular-nums" aria-hidden="true">
      {formatSecondsRu(Math.max(0, now - startedAt))}
    </span>
  );
}

function FactChip({ fact }: { fact: ProfileFact }) {
  const href = safeHttpUrl(fact.sourceUrl);
  const content = (
    <>
      <span className="text-muted-foreground">{fact.label}</span>
      <span className="font-medium">{fact.value}</span>
    </>
  );
  const chipClass = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1";
  if (!href) return <span className={chipClass}>{content}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Источник: ${displayHost(href)}`}
      className={`${chipClass} transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:outline-solid`}
    >
      {content}
      <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">(источник: {displayHost(href)})</span>
    </a>
  );
}
