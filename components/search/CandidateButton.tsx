"use client";

import { ChevronRight, GraduationCap } from "lucide-react";
import { ExternalImage } from "@/components/profile/ExternalImage";
import type { CandidateCard } from "@/lib/types";

/** P4 · one university card in PickList / NotFound: logo, name, city and country, founding year. */
export function CandidateButton({ candidate, onPick }: { candidate: CandidateCard; onPick: (qid: string) => void }) {
  const place = [candidate.city, candidate.country].filter(Boolean).join(", ");
  return (
    <button
      type="button"
      onClick={() => onPick(candidate.qid)}
      className="flex h-full w-full cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-foreground/25 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:outline-solid"
    >
      <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
        {candidate.logoUrl ? (
          <ExternalImage src={candidate.logoUrl} alt="" fallbackText="" className="size-full object-contain p-1" />
        ) : (
          <GraduationCap className="size-6 text-muted-foreground" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block leading-snug font-medium">{candidate.name}</span>
        {place ? <span className="block text-sm text-muted-foreground">{place}</span> : null}
        {candidate.founded ? (
          <span className="block text-xs text-muted-foreground">основан: {candidate.founded}</span>
        ) : null}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}
