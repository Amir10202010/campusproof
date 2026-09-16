import { notImplemented } from "@/lib/notImplemented";
import type { EntityDetails } from "@/lib/types";

/**
 * P1 · issue #8 · wbgetentities (university + its city in one batched call) via wikimediaFetch.
 * entity: labels/aliases en/ru/kk, P17 country (+ P297 ISO code), P131 → city (+ P625 coords),
 * P625 coords, P856 website → domains, P373 Commons category, P154 logo, sitelinks → Wikipedia.
 * facts (RU labels): P571 "Основан", P2196 "Студентов", city "Город" — each with a Wikidata sourceUrl.
 */
export type GetEntity = (qid: string, signal: AbortSignal) => Promise<EntityDetails>;
export const getEntity: GetEntity = async () => notImplemented("getEntity", "P1", 8);
