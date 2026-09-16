"use client";

import { ComponentStub } from "@/components/dev/ComponentStub";
import type { CandidateCard } from "@/lib/types";

export interface NotFoundProps {
  query: string;
  suggestions: CandidateCard[];
  onPick: (qid: string) => void;
}

/** P4 · #4 · what we tried, closest matches, an example of a good query. */
export function NotFound(props: NotFoundProps) {
  return (
    <ComponentStub name="NotFound" issue={4}>
      <div>По запросу «{props.query}» университет не найден.</div>
      {props.suggestions.map((c) => (
        <button key={c.qid} type="button" className="block underline" onClick={() => props.onPick(c.qid)}>
          {c.name}
        </button>
      ))}
    </ComponentStub>
  );
}
