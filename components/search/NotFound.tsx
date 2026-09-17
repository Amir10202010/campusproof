"use client";

import { SearchX } from "lucide-react";
import Link from "next/link";
import type { CandidateCard } from "@/lib/types";
import { CandidateButton } from "./CandidateButton";

export interface NotFoundProps {
  query: string;
  suggestions: CandidateCard[];
  onPick: (qid: string) => void;
}

/** P4 · #4 · what we tried, closest matches, an example of a good query. */
export function NotFound({ query, suggestions, onPick }: NotFoundProps) {
  return (
    <section className="mx-auto max-w-3xl space-y-5 py-2">
      <div className="space-y-2">
        <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Не нашли университет «{query}»</h1>
        <p className="text-muted-foreground">
          Мы искали по названиям и сокращениям университетов в Wikidata. Если не уверены, что нашли нужный вуз, мы не
          показываем фото — чужие снимки хуже честного «не нашли».
        </p>
      </div>

      {suggestions.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Возможно, вы искали</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {suggestions.map((candidate) => (
              <li key={candidate.qid}>
                <CandidateButton candidate={candidate} onPick={onPick} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2 rounded-xl border border-dashed p-4 text-sm">
        <p className="font-medium">Как искать</p>
        <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
          <li>Проверьте, нет ли опечаток в названии.</li>
          <li>Напишите полное название: «Казахский национальный университет имени аль-Фараби».</li>
          <li>Или по-английски: «Nazarbayev University».</li>
        </ul>
        <Link href="/" className="inline-block font-medium underline underline-offset-3">
          Новый поиск
        </Link>
      </div>
    </section>
  );
}
