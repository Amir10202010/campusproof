"use client";

import { SearchX } from "lucide-react";
import Link from "next/link";
import type { CandidateCard } from "@/lib/types";
import { CandidateButton } from "./CandidateButton";
import { Outcome, OutcomeHints } from "./Outcome";

export interface NotFoundProps {
  query: string;
  suggestions: CandidateCard[];
  onPick: (qid: string) => void;
}

/** P4 · #4 · what we tried, closest matches, an example of a good query. */
export function NotFound({ query, suggestions, onPick }: NotFoundProps) {
  return (
    <Outcome
      icon={SearchX}
      title={`Не нашли университет «${query}»`}
      lead="Мы искали по названиям и сокращениям университетов в Wikidata. Если не уверены, что нашли нужный вуз, мы не показываем фото — чужие снимки хуже честного «не нашли»."
    >
      {suggestions.length > 0 ? (
        <div className="space-y-2.5">
          <h2 className="annotation">Возможно, вы искали</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {suggestions.map((candidate) => (
              <li key={candidate.qid}>
                <CandidateButton candidate={candidate} onPick={onPick} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <OutcomeHints
        title="Как искать"
        items={[
          "Проверьте, нет ли опечаток в названии.",
          "Напишите полное название: «Казахский национальный университет имени аль-Фараби».",
          "Или по-английски: «Nazarbayev University».",
        ]}
      >
        <Link href="/" className="inline-block pt-1 font-medium underline underline-offset-4">
          Новый поиск
        </Link>
      </OutcomeHints>
    </Outcome>
  );
}
