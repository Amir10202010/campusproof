import { notImplemented } from "@/lib/notImplemented";
import type { SourceType, UniversityEntity } from "@/lib/types";

export interface DomainClass {
  sourceType: SourceType;
  isStock: boolean;
  isAggregator: boolean;
}

/** P2 · issue #16 · uses lib/config/domains.ts lists + entity.domains (official). */
export type ClassifyDomain = (hostname: string, entity: UniversityEntity) => DomainClass;
export const classifyDomain: ClassifyDomain = () => notImplemented("classifyDomain", "P2", 16);
