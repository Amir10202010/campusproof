"use client";

import Link from "next/link";
import type { CandidateCard } from "@/lib/types";
import { CandidateButton } from "./CandidateButton";

export interface PickListProps {
  query: string;
  candidates: CandidateCard[];
  onPick: (qid: string) => void;
}

/** P4 · #4 · "Какой университет вы имели в виду?" — cards with name, city, country, founded year, logo. */
export function PickList({ query, candidates, onPick }: PickListProps) {
  return (
    <section className="mx-auto max-w-3xl space-y-5 py-2">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Какой университет вы имели в виду?</h1>
        <p className="text-muted-foreground">
          Запросу «{query}» подходит несколько университетов. Выберите нужный — профиль соберём для него.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {candidates.map((candidate) => (
          <li key={candidate.qid}>
            <CandidateButton candidate={candidate} onPick={onPick} />
          </li>
        ))}
      </ul>
      <div className="space-y-2 rounded-xl border border-dashed p-4 text-sm">
        <p className="font-medium">Нужного нет в списке?</p>
        <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
          <li>Напишите полное официальное название, а не сокращение.</li>
          <li>Попробуйте название на английском языке.</li>
        </ul>
        <Link href="/" className="inline-block font-medium underline underline-offset-3">
          Новый поиск
        </Link>
      </div>
    </section>
  );
}
