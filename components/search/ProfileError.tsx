"use client";

import { Hourglass, RotateCw, SearchX, TriangleAlert, WifiOff, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HomeSearch } from "./HomeSearch";
import { Outcome } from "./Outcome";

export interface ProfileErrorProps {
  error: { code: string; message: string; retryable: boolean };
  /** Set when the university was already found before the run failed. */
  entityName?: string;
  onRetry?: () => void;
}

/** Headline per error code of the profile stream (lib/pipeline/orchestrator.ts, hooks/useProfileStream.ts). */
const ERROR_VIEW: Record<string, { title: string; icon: LucideIcon }> = {
  rate_limited: { title: "Новые проверки временно на паузе", icon: Hourglass },
  not_a_university: { title: "Это не университет", icon: SearchX },
  not_found: { title: "Университет не найден", icon: SearchX },
  bad_request: { title: "Укажите название университета", icon: SearchX },
  resolve_timeout: { title: "Не удалось определить университет", icon: TriangleAlert },
  resolve_failed: { title: "Не удалось определить университет", icon: TriangleAlert },
  stream_failed: { title: "Соединение прервалось", icon: WifiOff },
};

const FALLBACK = { title: "Не удалось собрать профиль", icon: TriangleAlert };

/**
 * P4 · the run ended with an error before any photo was shown: say what happened and what to do next,
 * instead of leaving the "searching…" skeleton on screen. Presentational; the container decides when to show it.
 * Shares the Outcome shell with PickList and NotFound, so the three terminal states read as one family.
 */
export function ProfileError({ error, entityName, onRetry }: ProfileErrorProps) {
  const { title, icon: Icon } = ERROR_VIEW[error.code] ?? FALLBACK;

  return (
    <Outcome
      icon={Icon}
      title={title}
      alert
      lead={
        <>
          {entityName ? <span className="mb-1 block font-medium text-foreground">{entityName}</span> : null}
          {error.message}
        </>
      }
    >
      {error.retryable && onRetry ? (
        <Button size="lg" className="h-10" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          Попробовать ещё раз
        </Button>
      ) : null}

      <div className="space-y-3 rounded-xl border border-dashed p-4 text-sm">
        <p className="font-medium">Найти другой университет</p>
        <HomeSearch examples={[]} />
        <Link href="/" className="inline-block font-medium underline underline-offset-4">
          На главную
        </Link>
      </div>

      {/* Useful when someone reports the problem; deliberately the quietest thing on the page. */}
      <p className="font-mono text-xs text-muted-foreground">код: {error.code}</p>
    </Outcome>
  );
}
