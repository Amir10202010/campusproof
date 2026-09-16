import { LIMITS } from "@/lib/config/limits";
import { env } from "@/lib/env";
import { isNotImplemented } from "@/lib/notImplemented";
import { haversineM } from "@/lib/sources/geo";
import type {
  DegradedFlag,
  FetchedCandidate,
  PipelineInput,
  Photo,
  ProfileFact,
  RejectedItem,
  RunContext,
  ScoreResult,
  ScoringContext,
  SourceStatus,
  UniversityEntity,
  UniversityProfile,
  VisionObservation,
} from "@/lib/types";
import type { VisionItem } from "@/lib/vision/provider";
import { toPhotoOrRejected } from "./assemble";
import { createRunContext } from "./context";
import { computeCoverage } from "./coverage";
import { elapsedMs, TimeoutError, withTimeout } from "./deadline";
import type { PipelineDeps } from "./deps";
import type { Emit } from "./events";

/**
 * WALKING SKELETON of the profile pipeline (owner P1, issue #10; spec docs/architecture.md §4–§5).
 * It already runs every stage in order. A stage whose module still throws NotImplementedError is
 * reported honestly as `skipped` and the pipeline continues, so the product "lights up" as lanes merge.
 *
 * TODO(P1 #10): per-category quotas, best-first vision batches, weak-category web queries,
 *               per-stage budgets from docs/architecture.md §5.0, request logging to a sink.
 */
export async function runProfilePipeline(
  input: PipelineInput,
  deps: PipelineDeps,
  emit: Emit,
  signal: AbortSignal,
): Promise<UniversityProfile | null> {
  const ctx = createRunContext({ signal, simulate: input.simulate, now: deps.now() });
  const stages: Record<string, number> = {};
  const sources: SourceStatus[] = [];
  const degraded = new Set<DegradedFlag>();
  const rejected: RejectedItem[] = [];
  const photos: Photo[] = [];
  let firstPhotoMs: number | undefined;

  const wikimediaDown = ctx.simulate.includes("wikimedia_down");
  const webSearchDown = ctx.simulate.includes("web_search_down");
  const visionDown = ctx.simulate.includes("vision_down");

  // ── 1 · Resolve ──────────────────────────────────────────────────────────────
  const resolveStarted = deps.now();
  let entity: UniversityEntity;
  let facts: ProfileFact[] = [];
  try {
    const qid = input.qid;
    if (qid) {
      ({ entity, facts } = await withTimeout("getEntity", ctx, LIMITS.RESOLVE_TIMEOUT_MS, (s) =>
        deps.getEntity(qid, s),
      ));
    } else {
      const result = await withTimeout("resolve", ctx, LIMITS.RESOLVE_TIMEOUT_MS, (s) =>
        deps.resolveQuery(input.query ?? "", s),
      );
      if (result.status === "ambiguous") {
        emit({ type: "ambiguous", query: result.query, candidates: result.candidates });
        return null;
      }
      if (result.status === "not_found") {
        emit({ type: "not_found", query: result.query, suggestions: result.suggestions });
        return null;
      }
      entity = result.entity;
      const details = await optional(ctx, "getEntity", () =>
        withTimeout("getEntity", ctx, LIMITS.RESOLVE_TIMEOUT_MS, (s) => deps.getEntity(result.entity.qid, s)),
      );
      if (details) ({ entity, facts } = details);
    }
  } catch (error) {
    emit({
      type: "error",
      code: isNotImplemented(error)
        ? "not_implemented"
        : error instanceof TimeoutError
          ? "resolve_timeout"
          : "resolve_failed",
      message: isNotImplemented(error)
        ? error.message
        : "Не удалось определить университет. Попробуйте уточнить название.",
      retryable: !isNotImplemented(error),
    });
    return null;
  }
  stages.resolve = deps.now() - resolveStarted;
  emit({ type: "resolved", entity });

  // ── 2 · Cache ────────────────────────────────────────────────────────────────
  const cacheable = !input.refresh && ctx.simulate.length === 0;
  if (cacheable) {
    const cached = await optional(ctx, "getCachedProfile", () => deps.getCachedProfile(entity.qid));
    if (cached) {
      emit({ type: "done", profile: cached, cached: true });
      return cached;
    }
  }

  // ── 3 · Gather (parallel sources) ───────────────────────────────────────────
  emit({ type: "stage", stage: "gather", status: "start", ms: elapsedMs(ctx, deps.now()) });
  const gatherStarted = deps.now();
  const source = sourceRunner(ctx, deps, emit, sources, degraded);

  const summariesPromise = source(
    "wikipedia",
    wikimediaDown,
    (s) => deps.getSummaries(entity, s),
    (v) => v.length,
  );
  const descriptionPromise = summariesPromise.then((summaries) =>
    optional(ctx, "describeCampus", () =>
      withTimeout("description", ctx, LIMITS.GLOBAL_DEADLINE_MS, (s) =>
        deps.describeCampus({ entity, summaries: summaries ?? [], facts }, s),
      ),
    ),
  );
  const [commons, web, summaries] = await Promise.all([
    source(
      "commons",
      wikimediaDown,
      (s) => deps.gatherCommons(entity, { ...ctx, signal: s }),
      (v) => v.candidates.length,
    ),
    source(
      "web_search",
      webSearchDown,
      (s) => deps.gatherWebSearch(entity, { ...ctx, signal: s }),
      (v) => v.length,
    ),
    summariesPromise,
  ]);
  const candidates = [...(commons?.candidates ?? []), ...(web ?? [])];
  stages.gather = deps.now() - gatherStarted;
  emit({
    type: "stage",
    stage: "gather",
    status: "done",
    counts: { candidates: candidates.length },
    ms: elapsedMs(ctx, deps.now()),
  });

  // ── 4 · Fetch + prepare ─────────────────────────────────────────────────────
  emit({ type: "stage", stage: "fetch", status: "start", ms: elapsedMs(ctx, deps.now()) });
  const fetchStarted = deps.now();
  let fetched: FetchedCandidate[] = [];
  if (candidates.length > 0) {
    const result = await optional(ctx, "fetchCandidates", () =>
      withTimeout("fetch", ctx, LIMITS.GLOBAL_DEADLINE_MS, (s) =>
        deps.fetchCandidates(candidates, { ...ctx, signal: s }),
      ),
    );
    fetched = result?.fetched ?? [];
    rejected.push(...(result?.failed ?? []));
  }
  stages.fetch = deps.now() - fetchStarted;
  emit({
    type: "stage",
    stage: "fetch",
    status: "done",
    counts: { fetched: fetched.length },
    ms: elapsedMs(ctx, deps.now()),
  });

  // ── 5 · Dedup ───────────────────────────────────────────────────────────────
  const dedupStarted = deps.now();
  let kept = fetched;
  if (fetched.length > 0) {
    const result = await optional(ctx, "dedupeCandidates", async () => deps.dedupeCandidates(fetched));
    if (result) {
      kept = result.kept;
      rejected.push(...result.rejected);
    }
  }
  stages.dedup = deps.now() - dedupStarted;
  emit({
    type: "stage",
    stage: "dedup",
    status: "done",
    counts: { kept: kept.length, duplicates: fetched.length - kept.length },
    ms: elapsedMs(ctx, deps.now()),
  });

  // ── 6 · Verify (vision observations → scoring) ──────────────────────────────
  emit({ type: "stage", stage: "verify", status: "start", ms: elapsedMs(ctx, deps.now()) });
  const verifyStarted = deps.now();
  const retrievedAt = new Date(deps.now()).toISOString();
  const scoringContext: ScoringContext = { entity, visionAvailable: !visionDown };
  const scored = new Set<string>();
  let scoringImplemented = true;

  const scoreAndEmit = (items: FetchedCandidate[], observations: Map<string, VisionObservation> | null) => {
    if (!scoringImplemented) return;
    const batch: Photo[] = [];
    for (const item of items) {
      if (scored.has(item.id)) continue;
      let result: ScoreResult;
      try {
        result = deps.scoreCandidate(item, observations?.get(item.id) ?? null, scoringContext);
      } catch (error) {
        if (isNotImplemented(error)) {
          scoringImplemented = false; // no tiers → no photos: never show unscored images
          return;
        }
        log(ctx, "scoreCandidate", error);
        continue;
      }
      scored.add(item.id);
      const out = toPhotoOrRejected(item, result, retrievedAt);
      if ("photo" in out) batch.push(out.photo);
      else rejected.push(out.rejected);
    }
    if (batch.length > 0) {
      firstPhotoMs ??= elapsedMs(ctx, deps.now());
      photos.push(...batch);
      emit({ type: "photos", photos: batch });
    }
  };

  if (kept.length > 0) {
    let observations: Map<string, VisionObservation> | null = null;
    if (visionDown) {
      degraded.add("vision_unavailable");
    } else {
      const byId = new Map(kept.map((item) => [item.id, item]));
      try {
        observations = await withTimeout("vision", ctx, LIMITS.GLOBAL_DEADLINE_MS, (s) =>
          deps.observeAll(
            kept.map(toVisionItem),
            {
              entity,
              subcategories: commons?.subcategories ?? [],
              wikipediaExtract: summaries?.[0]?.extract.slice(0, 600),
            },
            deps.visionProvider,
            { ...ctx, signal: s },
            (batchObservations) => {
              const items = batchObservations
                .map((o) => byId.get(o.id))
                .filter((item): item is FetchedCandidate => item !== undefined);
              scoreAndEmit(items, new Map(batchObservations.map((o) => [o.id, o])));
            },
          ),
        );
      } catch (error) {
        degraded.add("vision_unavailable");
        if (!isNotImplemented(error)) log(ctx, "observeAll", error);
      }
    }
    scoreAndEmit(kept, observations); // everything not scored per batch (no observation / vision failed)
  }
  stages.verify = deps.now() - verifyStarted;
  emit({
    type: "stage",
    stage: "verify",
    status: "done",
    counts: { photos: photos.length, rejected: rejected.length, scoring: scoringImplemented ? 1 : 0 },
    ms: elapsedMs(ctx, deps.now()),
  });

  // ── 7 · Assemble ────────────────────────────────────────────────────────────
  const assembleStarted = deps.now();
  const description = (await descriptionPromise) ?? null;
  emit({ type: "description", description });
  if (rejected.length > 0) emit({ type: "rejected", items: rejected });

  const profile: UniversityProfile = {
    pipelineVersion: env.pipelineVersion,
    entity,
    facts,
    description,
    photos: sortPhotos(photos),
    rejected,
    coverage: computeCoverage(photos),
    sources,
    distanceToCityCenterM: distanceToCityCenter(entity),
    degraded: [...degraded],
    timings: { totalMs: 0, firstPhotoMs, stages },
    generatedAt: new Date(deps.now()).toISOString(),
  };
  stages.assemble = deps.now() - assembleStarted;
  profile.timings.totalMs = elapsedMs(ctx, deps.now());

  // Only complete, healthy profiles are cached: a degraded result must not live for 14 days.
  if (cacheable && degraded.size === 0 && scoringImplemented) {
    await optional(ctx, "saveProfile", () => deps.saveProfile(profile));
  }

  console.log(
    JSON.stringify({
      at: "pipeline",
      requestId: ctx.requestId,
      qid: entity.qid,
      totalMs: profile.timings.totalMs,
      stages,
      sources: sources.map((s) => `${s.source}:${s.status}`),
      photos: photos.length,
      rejected: rejected.length,
      degraded: profile.degraded,
    }),
  );
  emit({ type: "done", profile, cached: false });
  return profile;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function sourceRunner(
  ctx: RunContext,
  deps: PipelineDeps,
  emit: Emit,
  sources: SourceStatus[],
  degraded: Set<DegradedFlag>,
) {
  const degradedFlagFor: Record<string, DegradedFlag | undefined> = {
    commons: "wikimedia_unavailable",
    wikipedia: "wikimedia_unavailable",
    web_search: "web_search_unavailable",
  };

  return async function source<T>(
    name: string,
    simulatedDown: boolean,
    task: (signal: AbortSignal) => Promise<T>,
    count: (value: T) => number,
  ): Promise<T | null> {
    const started = deps.now();
    const finish = (status: SourceStatus["status"], candidates: number, note?: string) => {
      const entry: SourceStatus = { source: name, status, candidates, ms: deps.now() - started, note };
      sources.push(entry);
      emit({ type: "source", status: entry });
      const flag = degradedFlagFor[name];
      if (flag && (status === "timeout" || status === "error" || status === "simulated_down")) degraded.add(flag);
    };

    if (simulatedDown) {
      finish("simulated_down", 0, "Симуляция недоступного источника");
      return null;
    }
    try {
      const value = await withTimeout(name, ctx, LIMITS.ADAPTER_TIMEOUT_MS, task);
      finish("ok", count(value));
      return value;
    } catch (error) {
      if (isNotImplemented(error)) finish("skipped", 0, error.message);
      else if (error instanceof TimeoutError) finish("timeout", 0);
      else {
        log(ctx, name, error);
        finish("error", 0);
      }
      return null;
    }
  };
}

/** Runs an optional step: NotImplementedError / errors → null (errors are logged). */
async function optional<T>(ctx: RunContext, label: string, task: () => Promise<T>): Promise<T | null> {
  try {
    return await task();
  } catch (error) {
    if (!isNotImplemented(error)) log(ctx, label, error);
    return null;
  }
}

function log(ctx: RunContext, at: string, error: unknown) {
  console.error(
    JSON.stringify({ at, requestId: ctx.requestId, error: error instanceof Error ? error.message : String(error) }),
  );
}

function toVisionItem(candidate: FetchedCandidate): VisionItem {
  const meta = [
    candidate.sourceDomain,
    candidate.title,
    candidate.caption,
    candidate.categoryHint ? `hint: ${candidate.categoryHint}` : undefined,
  ]
    .filter(Boolean)
    .join(" | ");
  return { id: candidate.id, jpeg: candidate.prepared.jpeg, meta };
}

const TIER_ORDER = { verified: 0, likely: 1, unconfirmed: 2 } as const;

function sortPhotos(photos: Photo[]): Photo[] {
  return [...photos].sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.points - a.points);
}

function distanceToCityCenter(entity: UniversityEntity): number | undefined {
  const city = entity.city;
  if (!entity.coords || city?.lat === undefined || city.lon === undefined) return undefined;
  return Math.round(haversineM(entity.coords, { lat: city.lat, lon: city.lon }));
}
