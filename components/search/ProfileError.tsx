"use client";

import { ArrowRight, RotateCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export interface ProfileErrorProps {
  error: { code: string; message: string; retryable: boolean };
  query?: string;
  /** Present only for errors worth retrying (a broken stream, a rate limit, an internal error). */
  onRetry?: () => void;
}

/**
 * P4 · a run that ended before the university was even identified. The profile layout has nothing to
 * put in it at that point, so it is replaced by what the visitor can act on: what happened, and what
 * to do next. Same shape as NotFound, so the three terminal states of a search look like one family.
 */
export function ProfileError({ error, query, onRetry }: ProfileErrorProps) {
  return (
    <section className="mx-auto max-w-3xl space-y-5 py-2">
      <div className="space-y-2">
        <TriangleAlert className="size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {query ? `Не удалось собрать профиль «${query}»` : "Не удалось собрать профиль"}
        </h1>
        <p className="text-muted-foreground">{error.message}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {error.retryable && onRetry ? (
          <Button onClick={onRetry}>
            <RotateCw aria-hidden="true" />
            Попробовать ещё раз
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href="/">Искать другой вуз</Link>
        </Button>
        <Link
          href="/how-it-works"
          className="inline-flex items-center gap-1 text-sm font-medium underline-offset-3 hover:underline"
        >
          Как мы проверяем фото
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {/* Useful when someone reports the problem; deliberately the quietest thing on the page. */}
      <p className="font-mono text-xs text-muted-foreground">код ошибки: {error.code}</p>
    </section>
  );
}
