import { getCachedProfile, saveProfile, type GetCachedProfile, type SaveProfile } from "@/lib/cache/profileCache";
import { describeCampus, type DescribeCampus } from "@/lib/describe/description";
import { dedupeCandidates, type DedupeCandidates } from "@/lib/images/dedup";
import { fetchCandidates, type FetchCandidates } from "@/lib/images/fetchAll";
import { resolveQuery, type ResolveQuery } from "@/lib/resolver/resolve";
import { scoreCandidate, type ScoreCandidate } from "@/lib/scoring/score";
import { gatherCommons, type GatherCommons } from "@/lib/sources/commons";
import { gatherWebSearch, type GatherWebSearch } from "@/lib/sources/webSearch";
import { getEntity, type GetEntity } from "@/lib/sources/wikidata";
import { getSummaries, type GetSummaries } from "@/lib/sources/wikipedia";
import { createClaudeVisionProvider } from "@/lib/vision/claude";
import { observeAll, type ObserveAll } from "@/lib/vision/observeAll";
import type { VisionProvider } from "@/lib/vision/provider";

/**
 * Everything the orchestrator needs, injected. Real implementations in createDefaultDeps();
 * tests pass fakes (tests/pipeline.test.ts). Owner: P1. The types come from each lane's module,
 * so a signature change in any lane breaks `npm run typecheck` here — contracts can't drift silently.
 */
export interface PipelineDeps {
  resolveQuery: ResolveQuery; // P1 #7/#14
  getEntity: GetEntity; // P1 #8
  getSummaries: GetSummaries; // P1 #8
  gatherCommons: GatherCommons; // P1 #9
  gatherWebSearch: GatherWebSearch; // P2 #16
  fetchCandidates: FetchCandidates; // P2 #15
  dedupeCandidates: DedupeCandidates; // P2 #17
  visionProvider: VisionProvider; // P2 #18
  observeAll: ObserveAll; // P2 #18
  scoreCandidate: ScoreCandidate; // P2 #17/#19
  describeCampus: DescribeCampus; // P1 #20
  getCachedProfile: GetCachedProfile; // P1 #12
  saveProfile: SaveProfile; // P1 #12
  now: () => number;
}

export function createDefaultDeps(): PipelineDeps {
  return {
    resolveQuery,
    getEntity,
    getSummaries,
    gatherCommons,
    gatherWebSearch,
    fetchCandidates,
    dedupeCandidates,
    visionProvider: createClaudeVisionProvider(),
    observeAll,
    scoreCandidate,
    describeCampus,
    getCachedProfile,
    saveProfile,
    now: () => Date.now(),
  };
}
