import { wikimediaApi } from "@/lib/sources/wikimediaFetch";
import type { UniversityEntity, WikipediaSummary } from "@/lib/types";

/**
 * P1 · issue #8 · plain-text intros (ru first, then en; kk only when neither exists) of the entity's
 * Wikipedia articles, one Action API call per language, in parallel, via wikimediaFetch.
 * A failing language is skipped; if every language fails the error is thrown so the source shows as down.
 */
export type GetSummaries = (entity: UniversityEntity, signal: AbortSignal) => Promise<WikipediaSummary[]>;

const PREFERRED_LANGS = ["ru", "en"];
export const MAX_EXTRACT_CHARS = 1_500;

export const getSummaries: GetSummaries = async (entity, signal) => {
  const preferred = PREFERRED_LANGS.flatMap((lang) => entity.wikipedia.filter((article) => article.lang === lang));
  const articles = preferred.length > 0 ? preferred : entity.wikipedia.slice(0, 1);
  if (articles.length === 0) return [];

  const settled = await Promise.allSettled(articles.map((article) => fetchSummary(article, signal)));
  const summaries = settled.flatMap((s) => (s.status === "fulfilled" && s.value ? [s.value] : []));
  const failure = settled.find((s): s is PromiseRejectedResult => s.status === "rejected");
  if (summaries.length === 0 && failure) throw failure.reason;
  return summaries;
};

async function fetchSummary(
  article: UniversityEntity["wikipedia"][number],
  signal: AbortSignal,
): Promise<WikipediaSummary | null> {
  const body = await wikimediaApi<{
    query?: { pages?: { title: string; missing?: boolean; extract?: string; canonicalurl?: string }[] };
  }>(
    `${article.lang}.wikipedia.org`,
    {
      action: "query",
      prop: "extracts|info",
      inprop: "url",
      exintro: 1,
      explaintext: 1,
      redirects: 1,
      titles: article.title,
    },
    signal,
  );
  const page = body.query?.pages?.[0];
  const extract = clipExtract(page?.extract ?? "");
  if (!page || page.missing || !extract) return null;
  return { lang: article.lang, title: page.title, url: page.canonicalurl ?? article.url, extract };
}

/** Collapses whitespace, drops brackets emptied by removed templates, cuts at a sentence end. */
export function clipExtract(text: string, max = MAX_EXTRACT_CHARS): string {
  const clean = text
    .replace(/\(\s*[,;]?\s*\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > max / 3 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}
