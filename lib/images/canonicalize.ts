import { notImplemented } from "@/lib/notImplemented";

/**
 * P2 · issue #15 · lowercase host; strip utm_*, fbclid, gclid; Commons thumb URL → original file key;
 * strip size suffixes like `-1024x768`, `_thumb`, `?w=`. Two URLs of the same file → the same string.
 */
export type CanonicalizeImageUrl = (url: string) => string;
export const canonicalizeImageUrl: CanonicalizeImageUrl = () => notImplemented("canonicalizeImageUrl", "P2", 15);
