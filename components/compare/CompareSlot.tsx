"use client";

import { ArrowRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CandidateButton } from "@/components/search/CandidateButton";
import { SearchBox } from "@/components/search/SearchBox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CandidateCard } from "@/lib/types";
import type { CompareSlotLoad, CompareSlotSearch } from "@/lib/ui/compare";
import { formatDateTimeRu } from "@/lib/ui/format";

export interface CompareSlotProps {
  label: string;
  qid?: string;
  name?: string;
  search: CompareSlotSearch;
  load: CompareSlotLoad;
  onSearch: (query: string) => void;
  onPick: (qid: string, name?: string) => void;
  onClear: () => void;
}

/** P4 · #38 · one side of /compare: search → pick → the saved profile's state. Presentational; CompareView fetches. */
export function CompareSlot({ label, qid, name, search, load, onSearch, onPick, onClear }: CompareSlotProps) {
  const change = (
    <Button variant="ghost" size="sm" onClick={onClear}>
      <RotateCcw aria-hidden="true" />
      Выбрать другой
    </Button>
  );

  if (load.status === "empty") {
    return (
      <Card label={label}>
        <SearchBox loading={search.status === "searching"} onSubmit={onSearch} />
        {search.status === "ambiguous" ? (
          <Choices title={`Уточните, какой вуз «${search.query}»:`} candidates={search.candidates} onPick={onPick} />
        ) : null}
        {search.status === "not_found" ? (
          search.suggestions.length > 0 ? (
            <Choices title={`Не нашли «${search.query}». Возможно:`} candidates={search.suggestions} onPick={onPick} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Не нашли «{search.query}». Попробуйте полное название или название на английском.
            </p>
          )
        ) : null}
        {search.status === "error" ? (
          <p className="text-sm text-muted-foreground">Поиск сейчас не отвечает. Попробуйте ещё раз.</p>
        ) : null}
      </Card>
    );
  }

  const title = load.status === "ready" ? load.profile.entity.name : (name ?? qid);

  if (load.status === "loading") {
    return (
      <Card label={label} title={title}>
        <p className="text-sm text-muted-foreground" aria-busy="true">
          Загружаем сохранённый профиль…
        </p>
        <Skeleton className="h-4 w-2/3" />
      </Card>
    );
  }

  if (load.status === "ready") {
    const { entity, generatedAt } = load.profile;
    return (
      <Card label={label} title={title}>
        <p className="text-sm text-muted-foreground">
          {[entity.city?.name, entity.country].filter(Boolean).join(", ")}
          {" · "}сохранённый профиль от{" "}
          <time dateTime={generatedAt} className="font-mono text-sm" suppressHydrationWarning>
            {formatDateTimeRu(generatedAt)}
          </time>
        </p>
        <div>{change}</div>
      </Card>
    );
  }

  return (
    <Card label={label} title={title}>
      {load.status === "not_cached" ? (
        <>
          <p className="text-sm">
            Профиль этого вуза ещё не сохранён. Откройте его — он соберётся примерно за полминуты — и вернитесь к
            сравнению.
          </p>
          <p className="text-xs text-muted-foreground">
            Сохраняем только полные профили: если во время проверки какой-то источник был недоступен, профиль не
            сохранится.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={`/u/${qid}`}>
                Открыть профиль
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            {change}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {load.status === "not_implemented"
              ? "Сравнение скоро будет доступно."
              : "Не удалось загрузить сохранённый профиль. Попробуйте позже."}
          </p>
          <div>{change}</div>
        </>
      )}
    </Card>
  );
}

function Card({ label, title, children }: { label: string; title?: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="space-y-1">
        <p className="annotation">{label}</p>
        {title ? <p className="font-display text-lg leading-snug font-semibold tracking-tight">{title}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Choices({
  title,
  candidates,
  onPick,
}: {
  title: string;
  candidates: CandidateCard[];
  onPick: (qid: string, name?: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{title}</p>
      <ul className="space-y-2">
        {candidates.map((candidate) => (
          <li key={candidate.qid}>
            <CandidateButton candidate={candidate} onPick={(qid) => onPick(qid, candidate.name)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
