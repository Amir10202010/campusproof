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
      className="group flex h-full w-full cursor-pointer items-center gap-3 rounded-lg bg-card p-3 text-left ring-1 ring-border transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
    >
      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {candidate.logoUrl ? (
          <ExternalImage src={candidate.logoUrl} alt="" fallbackText="" className="size-full object-contain p-1" />
        ) : (
          <GraduationCap className="size-5 text-muted-foreground" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block leading-snug font-medium">{candidate.name}</span>
        {place ? <span className="block text-[0.9375rem] text-muted-foreground">{place}</span> : null}
        {candidate.founded ? (
          <span className="block font-mono text-xs text-muted-foreground">основан {candidate.founded}</span>
        ) : null}
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
}
