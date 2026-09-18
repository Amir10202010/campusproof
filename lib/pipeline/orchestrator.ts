import { LIMITS } from "@/lib/config/limits";
import { env } from "@/lib/env";
import { isNotImplemented } from "@/lib/notImplemented";
import { haversineM } from "@/lib/sources/geo";
import { NotAUniversityError } from "@/lib/sources/wikidata";
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
import { elapsedMs, remainingMs, TimeoutError, withTimeout } from "./deadline";
import { sourceFailureReason, visionFailureReason, visionSkippedReason } from "./reasons";
import type { PipelineDeps } from "./deps";
import type { Emit } from "./events";

/**
 * WALKING SKELETON of the profile pipeline (owner P1, issue #10; spec docs/architecture.md §4–§5).
 * It already runs every stage in order. A stage whose module still throws NotImplementedError is
 * reported honestly as `skipped` and the pipeline continues, so the product "lights up" as lanes merge.
 *
 * Stage budgets (§5.0): fetch ≤ LIMITS.FETCH_STAGE_TIMEOUT_MS, vision = rest of the deadline minus
 * LIMITS.ASSEMBLE_RESERVE_MS; both stages receive their own `ctx.deadlineAt` and should return partial results by then.
 * TODO(P1 #10): tune on real data once fetch/scoring (P2) land; per-category quotas live in fetchCandidates (P2 #15).
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
  // Free-tier AI is not offered to visitors from the EEA/CH/UK (lib/pipeline/regions.ts) → honest degraded mode.
  const visionDown = ctx.simulate.includes("vision_down") || !input.aiAllowed;

  // ── 1 · Resolve ──────────────────────────────────────────────────────────────
  const resolveStarted = deps.now();
  const cacheable = !input.refresh && ctx.simulate.length === 0;
  let entity: UniversityEntity;
  let facts: ProfileFact[] = [];
  try {
    let resolved: UniversityEntity | undefined;
    if (!input.qid) {
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
      resolved = result.entity;
    }
    const qid = input.qid ?? (resolved as UniversityEntity).qid;

    // ── 2 · Cache ── checked before entity details: a saved profile costs no Wikimedia calls.
    const serveCached = async () => {
      const cached = await optional(ctx, "getCachedProfile", () => deps.getCachedProfile(qid));
      if (cached) {
        emit({ type: "resolved", entity: cached.entity });
        emit({ type: "done", profile: cached, cached: true });
      }
      return cached;
    };
    if (cacheable) {
      const cached = await serveCached();
      if (cached) return cached;
    }

    // Fresh runs spend free quotas: rate limit + daily budget. Over the limit → the saved profile or an honest message.
    const gate = deps.beforeFreshRun ? await optional(ctx, "beforeFreshRun", deps.beforeFreshRun) : null;
    if (gate && !gate.allowed) {
      const cached = cacheable ? null : await serveCached();
      if (cached) return cached;
      emit({
        type: "error",
        code: "rate_limited",
        message: gate.reason ?? "Слишком много новых проверок. Попробуйте позже.",
        retryable: true,
      });
      return null;
    }

    if (resolved) {
      entity = resolved;
      const details = await optional(ctx, "getEntity", () =>
        withTimeout("getEntity", ctx, LIMITS.RESOLVE_TIMEOUT_MS, (s) => deps.getEntity(qid, s)),
      );
      if (details) ({ entity, facts } = details);
    } else {
      ({ entity, facts } = await withTimeout("getEntity", ctx, LIMITS.RESOLVE_TIMEOUT_MS, (s) =>
        deps.getEntity(qid, s),
      ));
    }
  } catch (error) {
    if (error instanceof NotAUniversityError) {
      emit({
        type: "error",
        code: error.reason,
        message:
          error.reason === "not_found"
            ? `В Wikidata нет элемента ${error.qid}.`
            : `${error.qid} в Wikidata — не университет и не вуз, поэтому профиль не строим.`,
        retryable: false,
      });
      return null;
    }
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
        deps.describeCampus({ entity, summaries: summaries ?? [], facts, aiAllowed: input.aiAllowed }, s),
      ),
    ),
  );
  const [commons, web, openverse, summaries] = await Promise.all([
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
    source(
      "openverse",
      false,
      (s) => deps.gatherOpenverse(entity, { ...ctx, signal: s }),
      (v) => v.length,
    ),
    summariesPromise,
  ]);
  const candidates = [...(commons?.candidates ?? []), ...(web ?? []), ...(openverse ?? [])];
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
    const now = deps.now();
    const budget = Math.min(LIMITS.FETCH_STAGE_TIMEOUT_MS, remainingMs(ctx, now) - LIMITS.ASSEMBLE_RESERVE_MS);
    const stageDeadline = now + Math.max(0, budget);
    const result = await optional(ctx, "fetchCandidates", () =>
      withTimeout("fetch", ctx, Math.max(0, budget) + LIMITS.STAGE_GRACE_MS, (s) =>
        deps.fetchCandidates(candidates, { ...ctx, signal: s, deadlineAt: stageDeadline }),
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
      const out = toPhotoOrRejected(item, result, retrievedAt, entity.coords);
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
    // Vision gets what is left of the global deadline minus a reserve for scoring and assembling.
    const visionStarted = deps.now();
    const visionBudget = remainingMs(ctx, visionStarted) - LIMITS.ASSEMBLE_RESERVE_MS;
    /** The visual check is reported like a source, so the UI can say *why* it was unavailable. */
    const visionStatus = (status: SourceStatus["status"], candidates: number, note?: string) => {
      const entry: SourceStatus = { source: "vision", status, candidates, ms: deps.now() - visionStarted, note };
      sources.push(entry);
      emit({ type: "source", status: entry });
    };
    if (visionDown || visionBudget <= 0) {
      degraded.add("vision_unavailable");
      visionStatus(
        ctx.simulate.includes("vision_down") ? "simulated_down" : "skipped",
        0,
        visionSkippedReason(input, visionBudget),
      );
    } else {
      const byId = new Map(kept.map((item) => [item.id, item]));
      const stageDeadline = visionStarted + visionBudget;
      try {
        observations = await withTimeout("vision", ctx, visionBudget + LIMITS.STAGE_GRACE_MS, (s) =>
          deps.observeAll(
            kept.map(toVisionItem),
            {
              entity,
              subcategories: commons?.subcategories ?? [],
              wikipediaExtract: summaries?.[0]?.extract.slice(0, 600),
            },
            deps.visionProvider,
            { ...ctx, signal: s, deadlineAt: stageDeadline },
            (batchObservations) => {
              const items = batchObservations
                .map((o) => byId.get(o.id))
                .filter((item): item is FetchedCandidate => item !== undefined);
              scoreAndEmit(items, new Map(batchObservations.map((o) => [o.id, o])));
            },
          ),
        );
        visionStatus("ok", observations.size);
      } catch (error) {
        degraded.add("vision_unavailable");
        if (!isNotImplemented(error)) log(ctx, "observeAll", error);
        visionStatus(error instanceof TimeoutError ? "timeout" : "error", 0, visionFailureReason(error));
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
      else if (error instanceof TimeoutError) finish("timeout", 0, "Источник не ответил к дедлайну этапа");
      else {
        log(ctx, name, error);
        finish("error", 0, sourceFailureReason(error));
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
