import { CATEGORY_BY_ID } from "@/lib/config/categories";
import type { UniversityProfile } from "@/lib/types";

/**
 * Step 1 (owner: P1 · community feature, Этап 4): the CODE collects facts with sources, deterministically,
 * from a completed profile's own recorded evidence — no model involved here. Step 2 (see gemini caller in
 * the route) only rewrites this list into prose; it must not add anything not in this list.
 */
export interface KnowFact {
  text: string;
  sourceUrl?: string;
  sourceLabel: string;
}

const MAX_REJECT_REASONS = 3;

export function collectFacts(profile: UniversityProfile): KnowFact[] {
  const facts: KnowFact[] = [];

  // From Wikipedia/Wikidata (already sourced, via getEntity/getSummaries → lib/describe/description.ts's own inputs).
  for (const fact of profile.facts) {
    facts.push({ text: `${fact.label}: ${fact.value}`, sourceUrl: fact.sourceUrl, sourceLabel: "Wikidata" });
  }

  // Sections without a single confirmed ("verified"/"likely") photo — our own pipeline evidence.
  const emptySections = Object.entries(profile.coverage)
    .filter(([, coverage]) => coverage.status === "none")
    .map(([id]) => CATEGORY_BY_ID[id as keyof typeof CATEGORY_BY_ID]?.labelRu ?? id);
  if (emptySections.length > 0) {
    facts.push({
      text: `Пока нет подтверждённых фото в разделах: ${emptySections.join(", ")}.`,
      sourceLabel: "данные пайплайна CampusProof",
    });
  }

  // Sections where every shown photo comes only from the university's own official domain.
  const byCategory = new Map<string, typeof profile.photos>();
  for (const photo of profile.photos) {
    const list = byCategory.get(photo.category) ?? [];
    list.push(photo);
    byCategory.set(photo.category, list);
  }
  const officialOnly: string[] = [];
  for (const [id, photos] of byCategory) {
    if (photos.length > 0 && photos.every((p) => p.sourceType === "official")) {
      officialOnly.push(CATEGORY_BY_ID[id as keyof typeof CATEGORY_BY_ID]?.labelRu ?? id);
    }
  }
  if (officialOnly.length > 0) {
    facts.push({
      text: `В разделах «${officialOnly.join("», «")}» все фото — только с официального сайта вуза, независимого подтверждения нет.`,
      sourceLabel: "данные пайплайна CampusProof",
    });
  }

  // Distance from campus to city center.
  if (typeof profile.distanceToCityCenterM === "number") {
    facts.push({
      text: `Расстояние от кампуса до центра города: ~${Math.round(profile.distanceToCityCenterM / 100) / 10} км.`,
      sourceLabel: "координаты Wikidata",
    });
  }

  // How many candidates were filtered out, and the top reasons.
  if (profile.rejected.length > 0) {
    const byReason = new Map<string, number>();
    for (const item of profile.rejected) byReason.set(item.reason, (byReason.get(item.reason) ?? 0) + 1);
    const top = [...byReason.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_REJECT_REASONS)
      .map(([reason, count]) => `${reason} (${count})`)
      .join(", ");
    facts.push({
      text: `Отсеяно кандидатов в фото: ${profile.rejected.length}. Основные причины: ${top}.`,
      sourceLabel: "данные пайплайна CampusProof",
    });
  }

  return facts;
}
