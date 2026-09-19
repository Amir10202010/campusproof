"use client";

import Link from "next/link";
import type { CandidateCard } from "@/lib/types";
import { CandidateButton } from "./CandidateButton";
import { Outcome, OutcomeHints } from "./Outcome";

export interface PickListProps {
  query: string;
  candidates: CandidateCard[];
  onPick: (qid: string) => void;
}

/** P4 · #4 · "Какой университет вы имели в виду?" — cards with name, city, country, founded year, logo. */
export function PickList({ query, candidates, onPick }: PickListProps) {
  // One card means a weak match, not a tie: the name found does not quite match what was typed.
  const single = candidates.length === 1;
  return (
    <Outcome
      title={single ? "Вы имели в виду этот университет?" : "Какой университет вы имели в виду?"}
      lead={
        single
          ? `Название этого вуза совпало с запросом «${query}» не полностью, поэтому сами профиль не открываем. Если это он — выберите его.`
          : `Запросу «${query}» подходит несколько университетов. Выберите нужный — профиль соберём для него.`
      }
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {candidates.map((candidate) => (
          <li key={candidate.qid}>
            <CandidateButton candidate={candidate} onPick={onPick} />
          </li>
        ))}
      </ul>
      <OutcomeHints
        title="Нужного нет в списке?"
        items={["Напишите полное официальное название, а не сокращение.", "Попробуйте название на английском языке."]}
      >
        <Link href="/" className="inline-block pt-1 font-medium underline underline-offset-4">
          Новый поиск
        </Link>
      </OutcomeHints>
    </Outcome>
  );
}
