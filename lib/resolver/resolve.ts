import { notImplemented } from "@/lib/notImplemented";
import type { ResolveResult } from "@/lib/types";

/**
 * P1 · issue #7 (v0: Wikidata) → issue #14 (v1: local index first, Wikidata fallback).
 * One clear leader → "resolved"; several close candidates → "ambiguous" (≤6 cards);
 * nothing → "not_found" with suggestions. Timeout: LIMITS.RESOLVE_TIMEOUT_MS.
 */
export type ResolveQuery = (query: string, signal: AbortSignal) => Promise<ResolveResult>;
export const resolveQuery: ResolveQuery = async () => notImplemented("resolveQuery", "P1", 7);
