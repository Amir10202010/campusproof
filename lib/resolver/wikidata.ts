import { normalizeQuery, queryVariants } from "@/lib/resolver/normalize";
import {
  entityTerms,
  HIGHER_EDUCATION_CLASSES,
  isHigherEducation,
  loadEntities,
  loadPlacesFor,
  sitelinkCount,
  toCandidateCard,
  WIKIDATA_HOST,
  type RawEntity,
} from "@/lib/sources/wikidata";
import { wikimediaApi } from "@/lib/sources/wikimediaFetch";
import type { CandidateCard } from "@/lib/types";

/**
 * P1 · issue #7 · live Wikidata search (wbsearchentities in en + ru) via lib/sources/wikimediaFetch.ts.
 * Keep only higher-education institutions (P31 → Q38723 / Q3918, or a description that says so).
 */
export { HIGHER_EDUCATION_CLASSES, isHigherEducation };

export type SearchWikidata = (query: string, signal: AbortSignal) => Promise<CandidateCard[]>;

export const searchWikidata: SearchWikidata = async (query, signal) => {
  const ranked = await searchWikidataRanked(query, signal);
  return toCandidateCards(ranked.slice(0, MAX_CARDS), signal);
};

export const MAX_CARDS = 6;
const SEARCH_LIMIT = 10;
const MAX_CANDIDATES = 8;

/** The most common classes, used as a server-side filter in the full-text search. */
const SEARCH_FILTER_CLASSES = [...HIGHER_EDUCATION_CLASSES].slice(0, 20);

export interface RankedCandidate {
  qid: string;
  entity: RawEntity;
  /** 0..1 — how well the query matches a label or alias. */
  match: number;
  /** 0..1 — log-scaled sitelink count. */
  popularity: number;
  score: number;
}

/**
 * Prefix search (labels/aliases, all languages) for the query and its transliteration + full-text search
 * restricted to higher-education classes (catches "Satpaev" → Satbayev University). Then one batched
 * wbgetentities call to filter by P31 and rank by name match and popularity.
 */
export async function searchWikidataRanked(query: string, signal: AbortSignal): Promise<RankedCandidate[]> {
  return (await searchWikidataDetailed(query, signal)).ranked;
}

/** Ranked universities + ids of the other items found (a city, a person…), used for not_found suggestions. */
export async function searchWikidataDetailed(
  query: string,
  signal: AbortSignal,
): Promise<{ ranked: RankedCandidate[]; otherIds: string[] }> {
  const raw = query.trim();
  const variants = queryVariants(raw);
  if (variants.length === 0) return { ranked: [], otherIds: [] };

  const searches: Promise<string[]>[] = [filteredSearch(raw, signal), prefixSearch(raw, signal)];
  if (variants[1]) searches.push(prefixSearch(variants[1], signal));
  const settled = await Promise.allSettled(searches);
  if (settled.every((s) => s.status === "rejected")) throw (settled[0] as PromiseRejectedResult).reason;

  const ids = interleave(settled.map((s) => (s.status === "fulfilled" ? s.value : []))).slice(0, MAX_CANDIDATES);
  if (ids.length === 0) return { ranked: [], otherIds: [] };

  const entities = await loadEntities(ids, signal);
  const found = ids.flatMap((id) => entities.get(id) ?? []);
  return {
    ranked: rankCandidates(variants, found.filter(isHigherEducation)),
    otherIds: found.filter((entity) => !isHigherEducation(entity)).map((entity) => entity.id),
  };
}

/**
 * Suggestions for not_found (never auto-selected — an honest "not found" beats a wrong university):
 * typos via fuzzy full-text search (`harvrad~`), kept only when a name is really close;
 * universities located in the place the query named ("Алматы" → universities with P131/P159 = Almaty).
 */
export async function suggestWikidata(
  query: string,
  otherIds: string[],
  signal: AbortSignal,
): Promise<RankedCandidate[]> {
  const variants = queryVariants(query);
  const fuzzyTerms = significantWords(normalizeQuery(query))
    .filter((word) => word.length >= 3)
    .map((word) => `${word}~`)
    .join(" ");
  const places = otherIds.slice(0, 2).flatMap((id) => [`P131=${id}`, `P159=${id}`]);
  const [fuzzy, located] = await Promise.allSettled([
    fuzzyTerms ? filteredSearch(fuzzyTerms, signal) : Promise.resolve([]),
    places.length > 0 ? filteredSearch(`haswbstatement:${places.join("|")}`, signal) : Promise.resolve([]),
  ]);
  const fuzzyIds = fuzzy.status === "fulfilled" ? fuzzy.value : [];
  const locatedIds = located.status === "fulfilled" ? located.value : [];
  if (fuzzyIds.length + locatedIds.length === 0) return [];

  const entities = await loadEntities([...new Set([...fuzzyIds, ...locatedIds])].slice(0, MAX_CANDIDATES), signal);
  const pick = (ids: string[]) => ids.flatMap((id) => entities.get(id) ?? []).filter(isHigherEducation);
  const close = pick(fuzzyIds).filter(
    (entity) => fuzzySimilarity(variants, entityTerms(entity)) >= MIN_FUZZY_SIMILARITY,
  );
  const local = pick(locatedIds).sort((a, b) => sitelinkCount(b) - sitelinkCount(a));
  const unique = [...new Map([...close, ...local].map((entity) => [entity.id, entity])).values()];
  return unique.slice(0, MAX_CARDS).map((entity) => rankCandidates(variants, [entity])[0]);
}

export const MIN_FUZZY_SIMILARITY = 0.75;
const FILLER_LIKE = ["university", "университет"];

/** Drops words that are misspelled filler words ("univrsity"), so they don't dilute the similarity. */
function significantWords(text: string): string[] {
  const words = text.split(" ").filter(Boolean);
  const kept = words.filter((word) => !(word.length >= 5 && FILLER_LIKE.some((f) => editDistance(word, f) <= 2)));
  return kept.length > 0 ? kept : words;
}

/** Best similarity (0..1) between the query and any label/alias: whole strings or word by word. */
export function fuzzySimilarity(variants: string[], terms: { text: string }[]): number {
  let best = 0;
  for (const term of terms) {
    const nameWords = significantWords(normalizeQuery(term.text));
    for (const variant of variants) {
      const queryWords = significantWords(variant);
      best = Math.max(best, similarity(queryWords.join(" "), nameWords.join(" ")));
      const long = queryWords.filter((word) => word.length >= 3);
      if (long.length > 0) {
        const perWord = long.map((q) => Math.max(0, ...nameWords.map((n) => similarity(q, n))));
        best = Math.max(best, perWord.reduce((sum, v) => sum + v, 0) / perWord.length);
      }
    }
  }
  return best;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length);
}

/** Optimal string alignment distance (Levenshtein + adjacent transpositions: "harvrad" → "harvard" = 1). */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Round-robin merge of ranked id lists without duplicates: the best hits of every search survive the cap. */
export function interleave(lists: string[][]): string[] {
  const seen = new Set<string>();
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let i = 0; i < longest; i++) for (const list of lists) if (list[i]) seen.add(list[i]);
  return [...seen];
}

/** 0..1 — log-scaled sitelink count (150+ Wikipedia articles ≈ 1). */
export function popularityOf(sitelinks: number): number {
  return Math.min(1, Math.log10(sitelinks + 1) / Math.log10(151));
}

export function rankCandidates(variants: string[], entities: RawEntity[]): RankedCandidate[] {
  return entities
    .map((entity) => {
      const match = matchQuality(variants, entityTerms(entity));
      const popularity = popularityOf(sitelinkCount(entity));
      return { qid: entity.id, entity, match, popularity, score: 0.7 * match + 0.3 * popularity };
    })
    .sort((a, b) => b.score - a.score);
}

/** 1 exact label · 0.95 exact alias · 0.75 one name starts the other · 0.6 all query words present · 0.4 search hit only. */
export function matchQuality(variants: string[], terms: { text: string; isLabel: boolean }[]): number {
  let best = 0.4;
  for (const term of terms) {
    const name = normalizeQuery(term.text);
    if (!name) continue;
    for (const variant of variants) {
      if (name === variant) best = Math.max(best, term.isLabel ? 1 : 0.95);
      else if (name.startsWith(`${variant} `) || variant.startsWith(`${name} `)) best = Math.max(best, 0.75);
      else if (wordsCovered(variant, name)) best = Math.max(best, 0.6);
    }
  }
  return best;
}

/** Every query word starts some word of the name ("сатпаев" ⊂ "… имени к и сатпаева"). */
function wordsCovered(query: string, name: string): boolean {
  const nameWords = name.split(" ");
  return query.split(" ").every((word) => word.length >= 2 && nameWords.some((w) => w.startsWith(word)));
}

export async function toCandidateCards(ranked: RankedCandidate[], signal: AbortSignal): Promise<CandidateCard[]> {
  if (ranked.length === 0) return [];
  const entities = ranked.map((r) => r.entity);
  const places = await loadPlacesFor(entities, signal).catch(() => new Map());
  return entities.map((entity) => toCandidateCard(entity, places));
}

async function prefixSearch(search: string, signal: AbortSignal): Promise<string[]> {
  const lang = /\p{Script=Cyrillic}/u.test(search) ? "ru" : "en";
  const body = await wikimediaApi<{ search?: { id: string }[] }>(
    WIKIDATA_HOST,
    { action: "wbsearchentities", type: "item", search, language: lang, uselang: lang, limit: SEARCH_LIMIT },
    signal,
  );
  return (body.search ?? []).map((hit) => hit.id);
}

/** Full-text search restricted to higher-education classes; `search` may contain CirrusSearch operators. */
async function filteredSearch(search: string, signal: AbortSignal): Promise<string[]> {
  const cleaned = search.replace(/["\\]/g, " ").trim();
  const filter = `haswbstatement:${SEARCH_FILTER_CLASSES.map((id) => `P31=${id}`).join("|")}`;
  const body = await wikimediaApi<{ query?: { search?: { title: string }[] } }>(
    WIKIDATA_HOST,
    {
      action: "query",
      list: "search",
      srsearch: `${cleaned} ${filter}`,
      srnamespace: 0,
      srlimit: SEARCH_LIMIT,
      srprop: "",
    },
    signal,
  );
  return (body.query?.search ?? []).map((hit) => hit.title).filter((title) => /^Q\d+$/.test(title));
}
