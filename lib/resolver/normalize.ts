import { notImplemented } from "@/lib/notImplemented";

/**
 * P1 · issue #7 · docs/architecture.md §5.1
 * NFKC → lowercase → fold diacritics and Kazakh letters (ә ғ қ ң ө ұ ү һ і) → strip punctuation
 * and filler words (университет, university, univer, uni) → collapse spaces.
 */
export type NormalizeQuery = (query: string) => string;
export const normalizeQuery: NormalizeQuery = () => notImplemented("normalizeQuery", "P1", 7);

/** The normalized query plus a Cyrillic↔Latin transliteration variant, deduplicated. */
export type QueryVariants = (query: string) => string[];
export const queryVariants: QueryVariants = () => notImplemented("queryVariants", "P1", 7);
