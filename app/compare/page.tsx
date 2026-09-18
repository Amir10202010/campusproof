import type { Metadata } from "next";
import { CompareView } from "@/components/compare/CompareView";
import { parseCompareParams } from "@/lib/ui/compare";

export const metadata: Metadata = {
  title: "Сравнение вузов",
  description: "Два сохранённых профиля рядом: покрытие по разделам, факты и лучшие проверенные фото.",
};

/** P4 · #38 · /compare?a=Q…&b=Q… — compares SAVED profiles only (no fresh pipeline runs, no quota spent). */
export default async function ComparePage({ searchParams }: PageProps<"/compare">) {
  const { a, b } = parseCompareParams(await searchParams);
  return <CompareView initialA={a} initialB={b} />;
}
