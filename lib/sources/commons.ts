import { CATEGORIES } from "@/lib/config/categories";
import { LIMITS } from "@/lib/config/limits";
import { foldText } from "@/lib/resolver/normalize";
import { wikimediaApi, type WikimediaParams } from "@/lib/sources/wikimediaFetch";
import type { Candidate, CategoryId, DateKind, GeoPoint, RunContext, UniversityEntity } from "@/lib/types";

export interface CommonsGatherResult {
  candidates: Candidate[];
  /** Subcategory names (e.g. "Library of …") — passed to the vision model as context. */
  subcategories: string[];
}

/**
 * P1 · issue #9 · docs/architecture.md §5.2 (Commons adapter)
 * Category tree (≤4 subcategories), depicts search (haswbstatement:P180=QID), geosearch 1000 m,
 * city category; batched imageinfo + extmetadata (strip HTML). ≤8 Wikimedia calls. Respect ctx.signal.
 *
 * Calls (7 max, in parallel): subcategory list → files of ≤4 relevant subcategories (`incategory:A|B`),
 * files of the main category, depicts = university, geosearch around the campus, depicts = city
 * (or geosearch around the city center), images used in the ru/en Wikipedia article.
 */
export type GatherCommons = (entity: UniversityEntity, ctx: RunContext) => Promise<CommonsGatherResult>;

export const gatherCommons: GatherCommons = async (entity, ctx) => {
  const { signal } = ctx;
  const category = entity.commonsCategory;

  const subcategoryNames = category ? listSubcategories(category, signal) : Promise.resolve([]);
  const relevant = subcategoryNames.then((names) => pickRelevantSubcategories(names));
  const cityQid = entity.city?.qid;
  const cityCenter = entity.city?.lat !== undefined && entity.city.lon !== undefined ? entity.city : undefined;

  const [subcategories, subcategoryFiles, categoryFiles, depicts, nearby, city, articleImages] =
    await Promise.allSettled([
      subcategoryNames,
      relevant.then((names) =>
        names.length > 0
          ? queryFiles(
              {
                generator: "search",
                gsrsearch: `incategory:${names.map(underscore).join("|")}`,
                gsrnamespace: 6,
                gsrlimit: 50,
              },
              signal,
            )
          : [],
      ),
      category
        ? queryFiles(
            { generator: "categorymembers", gcmtitle: `Category:${category}`, gcmtype: "file", gcmlimit: 50 },
            signal,
          )
        : Promise.resolve([]),
      queryFiles(
        { generator: "search", gsrsearch: `haswbstatement:P180=${entity.qid}`, gsrnamespace: 6, gsrlimit: 50 },
        signal,
      ),
      entity.coords
        ? queryFiles(
            {
              generator: "geosearch",
              ggscoord: `${entity.coords.lat}|${entity.coords.lon}`,
              ggsradius: CAMPUS_RADIUS_M,
              ggsnamespace: 6,
              ggslimit: 50,
            },
            signal,
          )
        : Promise.resolve([]),
      cityFiles(cityQid, cityCenter, signal),
      articleFiles(entity.wikipedia, signal),
    ]);

  const settled = [subcategories, subcategoryFiles, categoryFiles, depicts, nearby, city, articleImages];
  if (settled.every((s) => s.status === "rejected")) throw (settled[0] as PromiseRejectedResult).reason;
  const value = <T>(s: PromiseSettledResult<T>, fallback: T): T => (s.status === "fulfilled" ? s.value : fallback);

  const fromArticle = value(articleImages, []);
  const used = new Set(fromArticle.map((file) => fileKey(file.title)));
  const relevantNames = new Set(await relevant.catch(() => []));
  const merged = new Map<string, Candidate>();
  const add = (files: CommonsFile[], origin: Origin) => {
    for (const file of files) {
      const candidate = toCandidate(file, origin, entity, used, relevantNames);
      if (!candidate) continue;
      const existing = merged.get(file.title);
      merged.set(file.title, existing ? mergeCandidates(existing, candidate) : candidate);
    }
  };
  add(fromArticle, "article");
  add(value(subcategoryFiles, []), "category");
  add(value(categoryFiles, []), "category");
  add(value(depicts, []), "depicts");
  add(value(nearby, []), "geosearch");
  add(value(city, []), "city");

  return {
    candidates: [...merged.values()],
    subcategories: value(subcategories, [])
      .filter((name) => !PEOPLE.test(name))
      .slice(0, 10),
  };
};

const COMMONS_HOST = "commons.wikimedia.org";

/** Thumbnail URL of a Commons file by name (logos from Wikidata P154 / the index). */
export function commonsFileUrl(fileName: string, width = 256): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName.replace(/ /g, "_"))}?width=${width}`;
}
const CAMPUS_RADIUS_M = 1_000;
const CITY_RADIUS_M = 2_000;
const MAX_SUBCATEGORIES = 4;
const IMAGE_WIDTH = 960;
const THUMB_WIDTH = 500;
const PHOTO_MIME = /^image\/(jpeg|png|tiff|webp)$/;

/** Not photos of places: logos, maps, documents, portraits (privacy) — whole words in file titles and categories. */
const NON_PHOTO_WORDS =
  "logos?|coats? of arms|seals?|emblems?|maps?|plans?|diagrams?|charts?|signatures?|documents?|portraits?|icons?|schemes?|" +
  "герб\\p{L}*|логотип\\p{L}*|эмблем\\p{L}*|карт[аыуе]|схем[аыуе]?|портрет\\p{L}*|печат[ьи]|подпис[ьи]|документ\\p{L}*";
export const NON_PHOTO = new RegExp(`(?<![\\p{L}\\p{N}])(?:${NON_PHOTO_WORDS})(?![\\p{L}\\p{N}])`, "iu");
const PEOPLE = /\b(people|persons|alumni|faculty members|rectors|presidents|portraits)\b|люди|выпускник/i;

type Origin = "category" | "depicts" | "geosearch" | "city" | "article";

interface CommonsFile {
  title: string;
  coordinates?: { lat: number; lon: number }[];
  imageinfo?: {
    url?: string;
    thumburl?: string;
    descriptionurl?: string;
    width?: number;
    height?: number;
    mime?: string;
    timestamp?: string;
    extmetadata?: Record<string, { value?: unknown }>;
  }[];
}

async function listSubcategories(category: string, signal: AbortSignal): Promise<string[]> {
  const body = await wikimediaApi<{ query?: { categorymembers?: { title: string }[] } }>(
    COMMONS_HOST,
    { action: "query", list: "categorymembers", cmtitle: `Category:${category}`, cmtype: "subcat", cmlimit: 100 },
    signal,
  );
  return (body.query?.categorymembers ?? []).map((m) => m.title.replace(/^Category:/, ""));
}

/** Up to 4 subcategories whose names hint at a photo category, one per category first; never people. */
export function pickRelevantSubcategories(names: string[]): string[] {
  const picked: string[] = [];
  const coveredCategories = new Set<CategoryId>();
  const hinted = names
    .filter((name) => !PEOPLE.test(name) && !NON_PHOTO.test(name))
    .map((name) => ({ name, hint: hintFromText(name) }))
    .filter((entry): entry is { name: string; hint: CategoryId } => entry.hint !== undefined);
  for (const pass of [true, false]) {
    for (const { name, hint } of hinted) {
      if (picked.length >= MAX_SUBCATEGORIES || picked.includes(name)) continue;
      if (pass && coveredCategories.has(hint)) continue;
      picked.push(name);
      coveredCategories.add(hint);
    }
  }
  return picked;
}

async function queryFiles(
  generator: WikimediaParams,
  signal: AbortSignal,
  host = COMMONS_HOST,
): Promise<CommonsFile[]> {
  const body = await wikimediaApi<{ query?: { pages?: CommonsFile[] } }>(
    host,
    {
      action: "query",
      ...generator,
      prop: "imageinfo|coordinates",
      iiprop: "url|size|mime|timestamp|extmetadata",
      iiurlwidth: IMAGE_WIDTH,
      iiextmetadatafilter:
        "DateTimeOriginal|DateTime|LicenseShortName|LicenseUrl|Artist|ImageDescription|ObjectName|Categories|GPSLatitude|GPSLongitude",
      iiextmetadatalanguage: "en",
      colimit: "max",
    },
    signal,
  );
  return body.query?.pages ?? [];
}

/** Images of the ru (else en) Wikipedia article: candidates and the "used on Wikipedia" provenance signal. */
async function articleFiles(articles: UniversityEntity["wikipedia"], signal: AbortSignal): Promise<CommonsFile[]> {
  const article = articles.find((w) => w.lang === "ru") ?? articles.find((w) => w.lang === "en");
  if (!article) return [];
  return queryFiles(
    { generator: "images", gimlimit: 50, titles: article.title, redirects: 1 },
    signal,
    `${article.lang}.wikipedia.org`,
  );
}

/**
 * City photos: the images of the city's own Wikipedia article (curated: skylines, landmarks) — much cleaner than
 * everything tagged "depicts this city". No article → files that depict the city; no city item → geosearch around it.
 */
async function cityFiles(
  cityQid: string | undefined,
  cityCenter: { lat?: number; lon?: number } | undefined,
  signal: AbortSignal,
): Promise<CommonsFile[]> {
  if (cityQid) {
    const article = await cityArticle(cityQid, signal).catch(() => undefined);
    if (article) return articleFiles([article], signal);
    return queryFiles(
      { generator: "search", gsrsearch: `haswbstatement:P180=${cityQid}`, gsrnamespace: 6, gsrlimit: 30 },
      signal,
    );
  }
  if (cityCenter?.lat === undefined || cityCenter.lon === undefined) return [];
  return queryFiles(
    {
      generator: "geosearch",
      ggscoord: `${cityCenter.lat}|${cityCenter.lon}`,
      ggsradius: CITY_RADIUS_M,
      ggsnamespace: 6,
      ggslimit: 30,
    },
    signal,
  );
}

/** ru (else en) Wikipedia article of the city, from its Wikidata sitelinks. */
async function cityArticle(
  cityQid: string,
  signal: AbortSignal,
): Promise<{ lang: string; title: string; url: string } | undefined> {
  const body = await wikimediaApi<{ entities?: Record<string, { sitelinks?: Record<string, { title: string }> }> }>(
    "www.wikidata.org",
    { action: "wbgetentities", ids: cityQid, props: "sitelinks", sitefilter: "ruwiki|enwiki" },
    signal,
  );
  const sitelinks = body.entities?.[cityQid]?.sitelinks;
  for (const lang of ["ru", "en"]) {
    const title = sitelinks?.[`${lang}wiki`]?.title;
    if (title) return { lang, title, url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}` };
  }
  return undefined;
}

function toCandidate(
  file: CommonsFile,
  origin: Origin,
  entity: UniversityEntity,
  usedOnWikipedia: Set<string>,
  relevantSubcategories: Set<string>,
): Candidate | null {
  const info = file.imageinfo?.[0];
  if (!info?.url || !info.descriptionurl || !PHOTO_MIME.test(info.mime ?? "")) return null;
  // Only Commons files: images hosted on a Wikipedia itself are often non-free (fair use) — we never show those,
  // they only count as the "used on Wikipedia" signal.
  if (hostOf(info.descriptionurl) !== COMMONS_HOST) return null;
  if (Math.min(info.width ?? 0, info.height ?? 0) < LIMITS.IMAGE_MIN_SHORT_SIDE_PX) return null;

  const meta = (key: string) => {
    const raw = info.extmetadata?.[key]?.value;
    return typeof raw === "string" || typeof raw === "number" ? stripHtml(String(raw)) : undefined;
  };
  const name = file.title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "");
  const fileCategories = (meta("Categories") ?? "").split("|").map((c) => c.trim());
  if (NON_PHOTO.test(`${name} ${fileCategories.join(" ")}`)) return null;

  const description = meta("ImageDescription")?.slice(0, 300);
  const title = meta("ObjectName") || name;
  const subcategoryHint = fileCategories.map((c) => relevantSubcategories.has(c) && hintFromText(c)).find(Boolean);
  const categoryHint: CategoryId | undefined =
    origin === "city"
      ? "city"
      : subcategoryHint || hintFromText(`${name} ${fileCategories.join(" ")} ${description ?? ""}`);

  const original = stripTracking(info.url);
  const thumb = info.thumburl ? stripTracking(info.thumburl) : undefined;
  const large = (info.width ?? 0) > IMAGE_WIDTH && thumb;
  return {
    imageUrl: large ? thumb : original,
    thumbUrl: large ? thumb.replace(`/${IMAGE_WIDTH}px-`, `/${THUMB_WIDTH}px-`) : original,
    sourcePageUrl: info.descriptionurl,
    sourceDomain: COMMONS_HOST,
    provider: "commons",
    title,
    caption: description,
    categoryHint,
    provenance: {
      commonsCategoryMatch: origin === "category",
      depictsQid: origin === "depicts",
      usedOnWikipedia: origin === "article" || usedOnWikipedia.has(fileKey(file.title)),
      pageMentionsName: origin !== "city" && mentionsName(`${title} ${name} ${description ?? ""}`, entity),
      sourceType: "encyclopedic",
    },
    geo: fileGeo(file, meta),
    date: fileDate(meta, info.timestamp),
    license: meta("LicenseShortName")
      ? { name: meta("LicenseShortName") as string, url: meta("LicenseUrl"), author: meta("Artist")?.slice(0, 120) }
      : undefined,
    width: info.width,
    height: info.height,
  };
}

function mergeCandidates(a: Candidate, b: Candidate): Candidate {
  return {
    ...a,
    categoryHint: a.categoryHint ?? b.categoryHint,
    provenance: {
      ...a.provenance,
      commonsCategoryMatch: a.provenance.commonsCategoryMatch || b.provenance.commonsCategoryMatch,
      depictsQid: a.provenance.depictsQid || b.provenance.depictsQid,
      usedOnWikipedia: a.provenance.usedOnWikipedia || b.provenance.usedOnWikipedia,
      pageMentionsName: a.provenance.pageMentionsName || b.provenance.pageMentionsName,
    },
  };
}

/** City keywords are ignored for university files: "square" or "street" in a campus photo is not the city. */
const HINT_ORDER: CategoryId[] = ["dormitory", "library", "classroom", "lab", "sports", "student_life", "campus"];

export function hintFromText(text: string): CategoryId | undefined {
  return HINT_ORDER.find((id) => CATEGORIES.find((c) => c.id === id)?.commonsKeywords.test(text));
}

/** Whole-word mention of the university's name (≥5 chars) or a distinctive alias (≥3 chars). */
export function mentionsName(text: string, entity: UniversityEntity): boolean {
  const haystack = ` ${foldText(text)} `;
  const names = [entity.names.en, entity.names.ru, entity.names.kk, entity.name].filter(Boolean) as string[];
  const needles = [
    ...names.map(foldText).filter((n) => n.length >= 5),
    ...entity.aliases.map(foldText).filter((a) => a.length >= 3),
  ];
  return needles.some((needle) => haystack.includes(` ${needle} `));
}

function fileGeo(file: CommonsFile, meta: (key: string) => string | undefined): GeoPoint | undefined {
  const primary = file.coordinates?.[0];
  if (primary) return { lat: primary.lat, lon: primary.lon };
  const lat = Number(meta("GPSLatitude"));
  const lon = Number(meta("GPSLongitude"));
  return Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0) ? { lat, lon } : undefined;
}

function fileDate(
  meta: (key: string) => string | undefined,
  uploadedAt: string | undefined,
): { value: string; kind: DateKind } | undefined {
  const taken = isoDate(meta("DateTimeOriginal"));
  if (taken) return { value: taken, kind: "taken" };
  const uploaded = isoDate(meta("DateTime")) ?? isoDate(uploadedAt);
  return uploaded ? { value: uploaded, kind: "uploaded" } : undefined;
}

/** "2014-06-09 09:59:12" / "2011-05-12" / "2019-11-02T10:00:00Z" → "2014-06-09"; year-month → "2014-06". */
export function isoDate(value: string | undefined): string | undefined {
  const match = value?.match(/\b(1[89]\d{2}|20\d{2})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?/);
  if (!match) return undefined;
  return match[3] ? `${match[1]}-${match[2]}-${match[3]}` : `${match[1]}-${match[2]}`;
}

/** Plain text from the HTML Commons puts into Artist / ImageDescription (never render source HTML). */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
      const lower = code.toLowerCase();
      if (lower.startsWith("#x")) return String.fromCodePoint(parseInt(lower.slice(2), 16));
      if (lower.startsWith("#")) return String.fromCodePoint(Number(lower.slice(1)));
      return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[lower] ?? entity;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** "File:Nazarbaev University.JPG" / "Файл:Nazarbaev_University.JPG" → "nazarbaev university.jpg". */
function fileKey(title: string): string {
  return title
    .replace(/^[^:]+:/, "")
    .replace(/_/g, " ")
    .toLowerCase();
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function underscore(name: string): string {
  return name.replace(/ /g, "_");
}

function stripTracking(url: string): string {
  const parsed = new URL(url);
  for (const key of [...parsed.searchParams.keys()]) if (key.startsWith("utm_")) parsed.searchParams.delete(key);
  return parsed.toString();
}
