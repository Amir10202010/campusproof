import { wikimediaApi } from "@/lib/sources/wikimediaFetch";
import type { CandidateCard, EntityDetails, GeoPoint, ProfileFact, UniversityEntity } from "@/lib/types";

/**
 * P1 · issue #8 · wbgetentities for the university, then city + country in one light batched call, via wikimediaFetch.
 * entity: labels/aliases en/ru/kk, P17 country (+ P297 ISO code), P159/P131/P276 → city (+ coords),
 * P625 coords (fallback: coordinates of the Wikipedia article), P856 website → domains, P373 Commons category,
 * P154 logo, sitelinks → Wikipedia. ≤3 Wikimedia calls (0–1 after the resolver read the same item).
 * facts (RU labels): P571 "Основан", P2196 "Студентов", "Город", "Страна", "Сайт" — each with a Wikidata sourceUrl.
 */
export type GetEntity = (qid: string, signal: AbortSignal) => Promise<EntityDetails>;

export const getEntity: GetEntity = async (qid, signal) => {
  const raw = (await loadEntities([qid], signal)).get(qid);
  if (!raw) throw new Error(`Wikidata item ${qid} not found`);
  const [entity, articleCoords] = await Promise.all([
    buildUniversityEntity(raw, signal),
    coordinateClaim(raw) ? undefined : articleCoordinates(raw, signal).catch(() => undefined),
  ]);
  if (!entity.coords && articleCoords) entity.coords = articleCoords;
  return { entity, facts: buildFacts(raw, entity) };
};

export function buildFacts(raw: RawEntity, entity: UniversityEntity): ProfileFact[] {
  const source = (property: string) => `${wikidataUrl(raw.id)}#${property}`;
  const facts: ProfileFact[] = [];
  const founded = yearClaim(raw, "P571");
  if (founded) facts.push({ label: "Основан", value: founded, sourceUrl: source("P571") });
  const students = latestQuantity(raw, "P2196");
  if (students) {
    const value = new Intl.NumberFormat("ru-RU").format(students.amount);
    facts.push({
      label: "Студентов",
      value: students.year ? `${value} (${students.year})` : value,
      sourceUrl: source("P2196"),
    });
  }
  const cityProperty = ["P159", "P131", "P276"].find((p) => itemClaims(raw, p)[0] === entity.city?.qid);
  if (entity.city && cityProperty)
    facts.push({ label: "Город", value: entity.city.name, sourceUrl: source(cityProperty) });
  if (entity.country) facts.push({ label: "Страна", value: entity.country, sourceUrl: source("P17") });
  if (entity.website) facts.push({ label: "Сайт", value: entity.website, sourceUrl: source("P856") });
  return facts;
}

/** Coordinates of the ru/en/kk Wikipedia article — many items lack P625 while the article has them. */
async function articleCoordinates(raw: RawEntity, signal: AbortSignal): Promise<GeoPoint | undefined> {
  const lang = WIKIPEDIA_LANGS.find((l) => raw.sitelinks?.[`${l}wiki`]?.title);
  if (!lang) return undefined;
  const body = await wikimediaApi<{ query?: { pages?: { coordinates?: { lat: number; lon: number }[] }[] } }>(
    `${lang}.wikipedia.org`,
    { action: "query", prop: "coordinates", redirects: 1, titles: raw.sitelinks?.[`${lang}wiki`]?.title },
    signal,
  );
  const coords = body.query?.pages?.[0]?.coordinates?.[0];
  return coords ? { lat: coords.lat, lon: coords.lon } : undefined;
}

// ─── Wikidata client shared by the resolver (#7) and getEntity (#8) ────────────

export const WIKIDATA_HOST = "www.wikidata.org";
const LANGS = ["ru", "en", "kk"] as const;
const WIKIPEDIA_LANGS = ["ru", "en", "kk"] as const;

interface RawSnak {
  snaktype: string;
  datavalue?: { value: unknown };
}

interface RawClaim {
  mainsnak: RawSnak;
  rank: "preferred" | "normal" | "deprecated";
  qualifiers?: Record<string, RawSnak[]>;
}

/** Subset of a wbgetentities entity (formatversion 2). */
export interface RawEntity {
  id: string;
  missing?: boolean;
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, RawClaim[]>;
  sitelinks?: Record<string, { title: string }>;
}

export interface PlaceInfo {
  label?: string;
  coords?: GeoPoint;
}

/**
 * Per-instance memo: the resolver and getEntity read the same entities within one request, so the
 * second read costs no Wikimedia call. Short TTL — cross-request caching lives in Redis (#12).
 */
const MEMO_TTL_MS = 10 * 60_000;
const MEMO_MAX_ENTRIES = 500;
const entityMemo = new Map<string, { at: number; value: RawEntity }>();
const placeMemo = new Map<string, { at: number; value: PlaceInfo }>();
const countryCodeMemo = new Map<string, string | null>();

function recall<T>(memo: Map<string, { at: number; value: T }>, key: string): T | undefined {
  const hit = memo.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > MEMO_TTL_MS) {
    memo.delete(key);
    return undefined;
  }
  return hit.value;
}

function remember<T>(memo: Map<string, { at: number; value: T }>, key: string, value: T) {
  if (memo.size >= MEMO_MAX_ENTRIES) memo.delete(memo.keys().next().value as string);
  memo.set(key, { at: Date.now(), value });
}

/** Test hook: forget memoized Wikidata responses. */
export function clearWikidataMemo() {
  entityMemo.clear();
  placeMemo.clear();
  countryCodeMemo.clear();
}

/** wbgetentities for up to 50 ids per call: labels, aliases, descriptions, claims, sitelinks (ru/en/kk). */
export async function loadEntities(ids: string[], signal: AbortSignal): Promise<Map<string, RawEntity>> {
  const result = new Map<string, RawEntity>();
  const toFetch: string[] = [];
  for (const id of new Set(ids)) {
    const hit = recall(entityMemo, id);
    if (hit) result.set(id, hit);
    else toFetch.push(id);
  }
  for (let i = 0; i < toFetch.length; i += 50) {
    const chunk = toFetch.slice(i, i + 50);
    const body = await wikimediaApi<{ entities?: Record<string, RawEntity> }>(
      WIKIDATA_HOST,
      {
        action: "wbgetentities",
        ids: chunk.join("|"),
        props: "labels|aliases|descriptions|claims|sitelinks",
        languages: LANGS.join("|"),
      },
      signal,
    );
    for (const [id, entity] of Object.entries(body.entities ?? {})) {
      if (entity.missing) continue;
      remember(entityMemo, id, entity);
      result.set(id, entity);
    }
  }
  return result;
}

/**
 * Labels (RU with fallback) + primary coordinates of places (cities, countries) in one light call —
 * wbgetentities with claims would download whole country items (hundreds of KB).
 */
export async function loadPlaces(ids: string[], signal: AbortSignal): Promise<Map<string, PlaceInfo>> {
  const result = new Map<string, PlaceInfo>();
  const toFetch: string[] = [];
  for (const id of new Set(ids)) {
    const hit = recall(placeMemo, id);
    if (hit) result.set(id, hit);
    else toFetch.push(id);
  }
  for (let i = 0; i < toFetch.length; i += 50) {
    const chunk = toFetch.slice(i, i + 50);
    const body = await wikimediaApi<{
      query?: {
        pages?: {
          title: string;
          missing?: boolean;
          coordinates?: { lat: number; lon: number; primary?: boolean }[];
          entityterms?: { label?: string[] };
        }[];
      };
    }>(
      WIKIDATA_HOST,
      {
        action: "query",
        titles: chunk.join("|"),
        prop: "coordinates|entityterms",
        colimit: "max",
        wbetterms: "label",
        wbetlanguage: "ru",
      },
      signal,
    );
    for (const page of body.query?.pages ?? []) {
      if (page.missing) continue;
      const coords = page.coordinates?.find((c) => c.primary) ?? page.coordinates?.[0];
      const info: PlaceInfo = {
        label: page.entityterms?.label?.[0],
        coords: coords ? { lat: coords.lat, lon: coords.lon } : undefined,
      };
      remember(placeMemo, page.title, info);
      result.set(page.title, info);
    }
  }
  return result;
}

/** ISO 3166-1 alpha-2 code (P297) of a country via wbgetclaims — tiny compared to the country item. */
export async function loadCountryCode(countryQid: string, signal: AbortSignal): Promise<string | undefined> {
  if (countryCodeMemo.has(countryQid)) return countryCodeMemo.get(countryQid) ?? undefined;
  const body = await wikimediaApi<{ claims?: Record<string, RawClaim[]> }>(
    WIKIDATA_HOST,
    { action: "wbgetclaims", entity: countryQid, property: "P297" },
    signal,
  );
  const code = stringClaims({ id: countryQid, claims: body.claims }, "P297")[0]?.toUpperCase();
  countryCodeMemo.set(countryQid, code ?? null);
  return code;
}

// ─── Claim readers ─────────────────────────────────────────────────────────────

/** Preferred-rank claims if any, otherwise normal-rank ones; deprecated claims are ignored. */
function bestClaims(entity: RawEntity, property: string): RawClaim[] {
  const claims = (entity.claims?.[property] ?? []).filter((c) => c.rank !== "deprecated");
  const preferred = claims.filter((c) => c.rank === "preferred");
  return (preferred.length > 0 ? preferred : claims).filter((c) => c.mainsnak.snaktype === "value");
}

export function itemClaims(entity: RawEntity, property: string): string[] {
  return bestClaims(entity, property)
    .map((c) => (c.mainsnak.datavalue?.value as { id?: string } | undefined)?.id)
    .filter((id): id is string => typeof id === "string");
}

/** All P31 values including deprecated/normal ranks — used for type checks. */
export function instanceOf(entity: RawEntity): string[] {
  return (entity.claims?.P31 ?? [])
    .map((c) => (c.mainsnak.datavalue?.value as { id?: string } | undefined)?.id)
    .filter((id): id is string => typeof id === "string");
}

export function stringClaims(entity: RawEntity, property: string): string[] {
  return bestClaims(entity, property)
    .map((c) => c.mainsnak.datavalue?.value)
    .filter((value): value is string => typeof value === "string");
}

export function coordinateClaim(entity: RawEntity, property = "P625"): GeoPoint | undefined {
  for (const claim of bestClaims(entity, property)) {
    const value = claim.mainsnak.datavalue?.value as { latitude?: number; longitude?: number } | undefined;
    if (typeof value?.latitude === "number" && typeof value.longitude === "number") {
      return { lat: value.latitude, lon: value.longitude };
    }
  }
  return undefined;
}

/** Year of a time claim ("+2010-06-28T00:00:00Z" → "2010"). */
export function yearClaim(entity: RawEntity, property: string): string | undefined {
  for (const claim of bestClaims(entity, property)) {
    const time = (claim.mainsnak.datavalue?.value as { time?: string } | undefined)?.time;
    const year = time?.match(/^\+?(-?\d{1,4})-/)?.[1];
    if (year) return year.replace(/^0+(?=\d)/, "");
  }
  return undefined;
}

/** The value with the latest "point in time" (P585) qualifier, e.g. the most recent student count. */
export function latestQuantity(entity: RawEntity, property: string): { amount: number; year?: string } | undefined {
  let best: { amount: number; time: string } | undefined;
  for (const claim of bestClaims(entity, property)) {
    const amount = Number((claim.mainsnak.datavalue?.value as { amount?: string } | undefined)?.amount);
    if (!Number.isFinite(amount)) continue;
    const time = (claim.qualifiers?.P585?.[0]?.datavalue?.value as { time?: string } | undefined)?.time ?? "";
    if (!best || time > best.time) best = { amount, time };
  }
  if (!best) return undefined;
  return { amount: best.amount, year: best.time.match(/^\+?(\d{4})-/)?.[1] };
}

export function label(entity: RawEntity, lang?: string): string | undefined {
  if (lang) return entity.labels?.[lang]?.value;
  for (const l of LANGS) if (entity.labels?.[l]?.value) return entity.labels[l].value;
  return undefined;
}

/** Labels and aliases in ru/en/kk, for name matching. */
export function entityTerms(entity: RawEntity): { text: string; isLabel: boolean }[] {
  const labels = Object.values(entity.labels ?? {}).map((l) => ({ text: l.value, isLabel: true }));
  const aliases = Object.values(entity.aliases ?? {})
    .flat()
    .map((a) => ({ text: a.value, isLabel: false }));
  return [...labels, ...aliases];
}

export function sitelinkCount(entity: RawEntity): number {
  return Object.keys(entity.sitelinks ?? {}).length;
}

/** City of an institution: headquarters (P159), then administrative unit (P131), then location (P276). */
export function cityQid(entity: RawEntity): string | undefined {
  return itemClaims(entity, "P159")[0] ?? itemClaims(entity, "P131")[0] ?? itemClaims(entity, "P276")[0];
}

export function commonsFileUrl(fileName: string, width = 256): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName.replace(/ /g, "_"))}?width=${width}`;
}

export function wikidataUrl(qid: string): string {
  return `https://www.wikidata.org/wiki/${qid}`;
}

// ─── Builders ──────────────────────────────────────────────────────────────────

/** Loads city/country labels + city coordinates for several institutions in one call. */
export async function loadPlacesFor(entities: RawEntity[], signal: AbortSignal): Promise<Map<string, PlaceInfo>> {
  const ids = entities.flatMap((e) => [cityQid(e), itemClaims(e, "P17")[0]]).filter((id): id is string => !!id);
  return ids.length > 0 ? loadPlaces(ids, signal) : new Map();
}

export function toCandidateCard(entity: RawEntity, places: Map<string, PlaceInfo>): CandidateCard {
  const city = cityQid(entity);
  const country = itemClaims(entity, "P17")[0];
  const logo = stringClaims(entity, "P154")[0];
  return {
    qid: entity.id,
    name: label(entity) ?? entity.id,
    city: city ? places.get(city)?.label : undefined,
    country: (country && places.get(country)?.label) ?? "",
    founded: yearClaim(entity, "P571"),
    logoUrl: logo ? commonsFileUrl(logo, 128) : undefined,
  };
}

/** Full UniversityEntity: one light call for city/country + one tiny call for the ISO country code. */
export async function buildUniversityEntity(entity: RawEntity, signal: AbortSignal): Promise<UniversityEntity> {
  const countryQid = itemClaims(entity, "P17")[0];
  const [places, countryCode] = await Promise.all([
    loadPlacesFor([entity], signal).catch(() => new Map<string, PlaceInfo>()),
    countryQid ? loadCountryCode(countryQid, signal).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  const card = toCandidateCard(entity, places);
  const cityId = cityQid(entity);
  const cityInfo = cityId ? places.get(cityId) : undefined;

  const aliases = new Set(
    Object.values(entity.aliases ?? {})
      .flat()
      .map((a) => a.value),
  );
  const websites = stringClaims(entity, "P856");
  const commonsSitelink = entity.sitelinks?.commonswiki?.title;
  const logo = stringClaims(entity, "P154")[0];

  return {
    qid: entity.id,
    name: card.name,
    names: { en: label(entity, "en"), ru: label(entity, "ru"), kk: label(entity, "kk") },
    aliases: [...aliases],
    country: card.country,
    countryCode: countryCode ?? "",
    city:
      cityId && cityInfo?.label
        ? { name: cityInfo.label, qid: cityId, lat: cityInfo.coords?.lat, lon: cityInfo.coords?.lon }
        : undefined,
    coords: coordinateClaim(entity),
    website: websites[0],
    domains: [...new Set(websites.map(hostnameOf).filter((host): host is string => !!host))],
    commonsCategory:
      stringClaims(entity, "P373")[0] ??
      (commonsSitelink?.startsWith("Category:") ? commonsSitelink.slice("Category:".length) : undefined),
    wikipedia: WIKIPEDIA_LANGS.flatMap((lang) => {
      const title = entity.sitelinks?.[`${lang}wiki`]?.title;
      return title
        ? [{ lang, title, url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}` }]
        : [];
    }),
    logoUrl: logo ? commonsFileUrl(logo) : undefined,
  };
}

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
}
