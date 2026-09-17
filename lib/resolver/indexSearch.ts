import MiniSearch from "minisearch";
import rawIndex from "@/data/universities.min.json";
import { foldText, queryVariants } from "@/lib/resolver/normalize";
import { commonsFileUrl } from "@/lib/sources/commons";
import type { CandidateCard, UniversityEntity, UniversityIndexEntry } from "@/lib/types";

/**
 * P1 · issue #14 · MiniSearch over data/universities.min.json (built by P3, issue #24):
 * names + aliases, fuzzy ~0.2, prefix search, boosted by sitelinks. Load the index once per instance.
 */
export type SearchIndex = (query: string) => { entry: UniversityIndexEntry; score: number }[];

const MAX_HITS = 12;

export const searchIndex: SearchIndex = (query) => {
  const { search, entries } = getIndex();
  const scores = new Map<string, number>();
  for (const variant of queryVariants(query)) {
    // AND keeps multi-word queries precise; OR only when AND finds nothing (e.g. an extra word in the query).
    const hits = search.search(variant, { combineWith: "AND" });
    for (const hit of hits.length > 0 ? hits : search.search(variant, { combineWith: "OR" })) {
      scores.set(hit.id, Math.max(scores.get(hit.id) ?? 0, hit.score));
    }
  }
  return [...scores]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_HITS)
    .map(([qid, score]) => ({ entry: entries.get(qid) as UniversityIndexEntry, score }));
};

let loaded: { search: MiniSearch<IndexDocument>; entries: Map<string, UniversityIndexEntry> } | undefined;
let indexedQids: Set<string> | undefined;

/** True when the item is in the local index (built from P31/P279* higher-education institution). */
export function isIndexedUniversity(qid: string): boolean {
  indexedQids ??= new Set((rawIndex as UniversityIndexEntry[]).map((entry) => entry.qid));
  return indexedQids.has(qid);
}

interface IndexDocument {
  id: string;
  names: string;
  aliases: string;
}

export function getIndex() {
  if (!loaded) loaded = buildIndex(rawIndex as UniversityIndexEntry[]);
  return loaded;
}

export function buildIndex(index: UniversityIndexEntry[]) {
  const entries = new Map(index.map((entry) => [entry.qid, entry]));
  const search = new MiniSearch<IndexDocument>({
    fields: ["names", "aliases"],
    processTerm: (term) => foldText(term) || null,
    searchOptions: {
      boost: { names: 2 },
      // Abbreviations are short and exact ("KBTU" must not match "KSTU"); longer words tolerate typos.
      fuzzy: (term) => (term.length >= 5 ? 0.2 : false),
      prefix: (term) => term.length >= 4,
      boostDocument: (id) => 1 + 0.25 * Math.log10(1 + (entries.get(id)?.sitelinks ?? 0)),
    },
  });
  search.addAll(
    index.map((entry) => ({
      id: entry.qid,
      names: Object.values(entry.names).filter(Boolean).join(" | "),
      aliases: entry.aliases.join(" | "),
    })),
  );
  return { search, entries };
}

/** Labels and aliases of an index entry, in the shape used by the resolver's name matching. */
export function indexTerms(entry: UniversityIndexEntry): { text: string; isLabel: boolean }[] {
  return [
    ...Object.values(entry.names)
      .filter((name): name is string => Boolean(name))
      .map((text) => ({ text, isLabel: true })),
    ...entry.aliases.map((text) => ({ text, isLabel: false })),
  ];
}

const WIKIPEDIA_ORDER = ["ru", "en", "kk"];

/** UniversityEntity straight from the index — no Wikimedia calls. */
export function indexEntity(entry: UniversityIndexEntry): UniversityEntity {
  const city = entry.city;
  return {
    qid: entry.qid,
    name: entry.names.ru ?? entry.names.en ?? entry.names.kk ?? entry.qid,
    names: entry.names,
    aliases: entry.aliases,
    country: entry.country,
    countryCode: entry.countryCode,
    city: city ? { name: city.name, qid: city.qid, lat: city.lat, lon: city.lon } : undefined,
    coords: entry.coords,
    website: entry.website,
    domains: entry.domains,
    commonsCategory: entry.commonsCategory,
    wikipedia: [...entry.wikipedia]
      .sort((a, b) => rank(a.lang) - rank(b.lang))
      .map((article) => ({
        lang: article.lang,
        title: article.title,
        url: `https://${article.lang}.wikipedia.org/wiki/${encodeURIComponent(article.title.replace(/ /g, "_"))}`,
      })),
    logoUrl: entry.logo ? commonsFileUrl(entry.logo) : undefined,
  };
}

export function indexCard(entry: UniversityIndexEntry): CandidateCard {
  return {
    qid: entry.qid,
    name: entry.names.ru ?? entry.names.en ?? entry.names.kk ?? entry.qid,
    city: entry.city?.name,
    country: entry.country,
    founded: entry.inception,
    logoUrl: entry.logo ? commonsFileUrl(entry.logo, 128) : undefined,
  };
}

function rank(lang: string): number {
  const index = WIKIPEDIA_ORDER.indexOf(lang);
  return index === -1 ? WIKIPEDIA_ORDER.length : index;
}
