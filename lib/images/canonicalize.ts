/**
 * P2 · issue #15 · lowercase host; strip utm_*, fbclid, gclid; Commons thumb URL → original file key;
 * strip size suffixes like `-1024x768`, `_thumb`, `?w=`. Two URLs of the same file → the same string.
 */
export type CanonicalizeImageUrl = (url: string) => string;

/** Tracking parameters: never part of the file identity. */
const TRACKING_PARAM =
  /^(?:utm_[a-z_]*|fbclid|gclid|yclid|ysclid|igshid|mc_[ce]id|_ga|_gl|spm|ref|referrer|source|from)$/i;

/** Size/format parameters used by image CDNs (`?w=640&q=80`). */
const SIZE_PARAM = /^(?:w|h|width|height|size|resize|fit|q|quality|dpr|crop|format|auto|sw|sh|rev|v|cb)$/i;

/** `photo-1024x768.jpg`, `photo_thumb.jpg`, `photo-scaled.jpg` → `photo.jpg`. */
const SIZE_SUFFIX =
  /[-_](?:\d{2,5}x\d{2,5}|thumbnail|thumb|small|medium|large|scaled|resized|preview)(?=\.[a-z0-9]{2,5}$)/i;

/** Retina suffix: `photo@2x.jpg` → `photo.jpg`. */
const RETINA_SUFFIX = /@[1-4]x(?=\.[a-z0-9]{2,5}$)/i;

/** `/wikipedia/commons/thumb/a/ab/File.jpg/640px-File.jpg` → `/wikipedia/commons/a/ab/File.jpg`. */
const WIKIMEDIA_THUMB = /^\/wikipedia\/([a-z-]+)\/thumb\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)\/.+$/i;

export const canonicalizeImageUrl: CanonicalizeImageUrl = (url) => {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return trimmed;

  // The same file over http and https is the same file.
  parsed.protocol = "https:";
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  parsed.port = "";
  parsed.hash = "";

  const thumb = WIKIMEDIA_THUMB.exec(parsed.pathname);
  if (thumb) parsed.pathname = `/wikipedia/${thumb[1]}/${thumb[2]}/${thumb[3]}/${thumb[4]}`;
  else parsed.pathname = parsed.pathname.replace(RETINA_SUFFIX, "").replace(SIZE_SUFFIX, "");

  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key) || SIZE_PARAM.test(key)) parsed.searchParams.delete(key);
  }
  parsed.searchParams.sort();

  return parsed.toString().replace(/\?$/, "");
};
