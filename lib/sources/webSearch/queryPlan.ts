import { notImplemented } from "@/lib/notImplemented";
import type { UniversityEntity } from "@/lib/types";
import type { SearchQuery } from "./types";

/**
 * P2 · issue #16 · ≤ LIMITS.WEB_SEARCH_MAX_QUERIES queries from lib/config/categories.ts templates
 * (en/ru/kk names from the entity) + `site:<official domain>` queries. Use the S3 findings (docs/spikes.md).
 */
export type PlanQueries = (entity: UniversityEntity) => SearchQuery[];
export const planQueries: PlanQueries = () => notImplemented("planQueries", "P2", 16);
