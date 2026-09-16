/**
 * Generic domain lists used to classify image sources (docs/architecture.md §5.2).
 * v0 — P2/P3 extend these. Rules only: never add per-university whitelists here.
 * Matching rule: a hostname matches a domain if it equals it or ends with "." + domain.
 */

/** Stock-photo sites: candidates from these are rejected, and their hashes feed the reuse detector. */
export const STOCK_DOMAINS = [
  "shutterstock.com",
  "istockphoto.com",
  "gettyimages.com",
  "depositphotos.com",
  "dreamstime.com",
  "alamy.com",
  "123rf.com",
  "freepik.com",
  "pexels.com",
  "unsplash.com",
  "pixabay.com",
  "stock.adobe.com",
  "vecteezy.com",
  "bigstockphoto.com",
  "canstockphoto.com",
  "rawpixel.com",
  "pond5.com",
  "storyblocks.com",
] as const;

export const ENCYCLOPEDIC_DOMAINS = ["wikipedia.org", "wikimedia.org", "wikidata.org"] as const;

export const SOCIAL_DOMAINS = [
  "instagram.com",
  "facebook.com",
  "vk.com",
  "ok.ru",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "t.me",
  "threads.net",
  "youtube.com",
] as const;

/** Re-posting aggregators: penalized, never treated as provenance. */
export const AGGREGATOR_DOMAINS = ["pinterest.com", "pinimg.com", "pinterest.ru"] as const;

/** News/media (Kazakhstan first). Provenance signal only when the page names the university. */
export const NEWS_DOMAINS = [
  "tengrinews.kz",
  "nur.kz",
  "zakon.kz",
  "inform.kz",
  "kazpravda.kz",
  "kursiv.media",
  "forbes.kz",
  "vlast.kz",
  "orda.kz",
  "kapital.kz",
  "khabar.kz",
  "24.kz",
  "el.kz",
  "ktk.kz",
  "lsm.kz",
  "bnews.kz",
  "dknews.kz",
  "sputnik.kz",
  "azattyq.org",
  "astanatimes.com",
  "bbc.com",
  "reuters.com",
  "theguardian.com",
] as const;

export function hostMatches(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return host === domain || host.endsWith(`.${domain}`);
}

export function hostInList(hostname: string, list: readonly string[]): boolean {
  return list.some((d) => hostMatches(hostname, d));
}
