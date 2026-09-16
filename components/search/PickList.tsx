"use client";

import { ComponentStub } from "@/components/dev/ComponentStub";
import type { CandidateCard } from "@/lib/types";

export interface PickListProps {
  query: string;
  candidates: CandidateCard[];
  onPick: (qid: string) => void;
}

/** P4 · #4 · "Какой университет вы имели в виду?" — cards with name, city, country, founded year, logo. */
export function PickList(props: PickListProps) {
  return (
    <ComponentStub name="PickList" issue={4}>
      <div>Уточните запрос «{props.query}»:</div>
      {props.candidates.map((c) => (
        <button key={c.qid} type="button" className="block underline" onClick={() => props.onPick(c.qid)}>
          {c.name} — {[c.city, c.country].filter(Boolean).join(", ")}
        </button>
      ))}
    </ComponentStub>
  );
}
