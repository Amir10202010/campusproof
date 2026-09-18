import { kvGet, kvSet } from "@/lib/cache/kv";
import { LIMITS } from "@/lib/config/limits";
import { env } from "@/lib/env";
import type { RunContext, VisionObservation } from "@/lib/types";
import type { VisionContext, VisionItem, VisionProvider } from "./provider";

/**
 * P2 · issue #18 · batches of LIMITS.VISION_BATCH_SIZE (grouped by category hint), 5 in parallel,
 * best candidates first, LIMITS.VISION_BATCH_TIMEOUT_MS per batch; on failure retry once with half
 * the batch; call onBatch as soon as each batch returns (the orchestrator streams photos from it).
 */
export type ObserveAll = (
  items: VisionItem[],
  context: VisionContext,
  provider: VisionProvider,
  ctx: RunContext,
  onBatch?: (observations: VisionObservation[]) => void,
) => Promise<Map<string, VisionObservation>>;

/** The free tier is small: the same image of the same university is never paid for twice. */
function cacheKey(context: VisionContext, item: VisionItem): string {
  return `vision:${env.visionModel}:${context.entity.qid}:${item.id}`;
}

/** Every key is out of quota (the provider rotates them) — further batches would fail too. */
function isQuotaError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /\b429\b|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(text);
}

/** Similar shots in one batch let the model spot near-duplicates ("near_duplicate_of"). */
function groupByHint(items: VisionItem[]): VisionItem[] {
  const groups = new Map<string, VisionItem[]>();
  for (const item of items) {
    const hint = /hint:\s*([a-z_]+)/i.exec(item.meta)?.[1] ?? "unknown";
    const group = groups.get(hint);
    if (group) group.push(item);
    else groups.set(hint, [item]);
  }
  return [...groups.values()].flat();
}

export const observeAll: ObserveAll = async (items, context, provider, ctx, onBatch) => {
  const observations = new Map<string, VisionObservation>();
  if (items.length === 0) return observations;

  // 1 · what we already know from earlier runs
  const cached = await Promise.all(items.map((item) => kvGet<VisionObservation>(cacheKey(context, item))));
  const pending: VisionItem[] = [];
  const fromCache: VisionObservation[] = [];
  items.forEach((item, index) => {
    const hit = cached[index];
    if (hit) {
      observations.set(item.id, { ...hit, id: item.id });
      fromCache.push({ ...hit, id: item.id });
    } else pending.push(item);
  });
  if (fromCache.length > 0) report(onBatch, fromCache);
  if (pending.length === 0) return observations;

  // 2 · everything else goes to the model in batches
  const batches: VisionItem[][] = [];
  const ordered = groupByHint(pending);
  for (let i = 0; i < ordered.length; i += LIMITS.VISION_BATCH_SIZE) {
    batches.push(ordered.slice(i, i + LIMITS.VISION_BATCH_SIZE));
  }

  let stopped = false;
  let lastError: unknown;
  let succeeded = 0;

  const ask = async (batch: VisionItem[]): Promise<VisionObservation[]> => {
    const left = ctx.deadlineAt - Date.now();
    if (left <= 0) throw new Error("Не осталось времени на визуальную проверку");
    const signal = AbortSignal.any([ctx.signal, AbortSignal.timeout(Math.min(LIMITS.VISION_BATCH_TIMEOUT_MS, left))]);
    const known = new Set(batch.map((item) => item.id));
    // Ignore anything the model invents: only ids we actually sent.
    return (await provider.observe(batch, context, signal)).filter((observation) => known.has(observation.id));
  };

  const runBatch = async (batch: VisionItem[]): Promise<void> => {
    if (stopped) return;
    let result: VisionObservation[];
    try {
      result = await ask(batch);
    } catch (error) {
      lastError = error;
      if (isQuotaError(error) || ctx.signal.aborted || Date.now() >= ctx.deadlineAt) {
        stopped = true;
        return;
      }
      if (batch.length < 2) return;
      // One bad image or one long request: split once and keep what comes back.
      const half = Math.ceil(batch.length / 2);
      const halves = await Promise.allSettled([ask(batch.slice(0, half)), ask(batch.slice(half))]);
      result = halves.flatMap((part) => (part.status === "fulfilled" ? part.value : []));
      for (const part of halves) if (part.status === "rejected") lastError = part.reason;
      if (result.length === 0) return;
    }

    succeeded += 1;
    for (const observation of result) {
      observations.set(observation.id, observation);
      void kvSet(cacheKey(context, { id: observation.id } as VisionItem), observation, LIMITS.VISION_CACHE_TTL_S);
    }
    if (result.length > 0) report(onBatch, result);
  };

  let index = 0;
  const lanes = Array.from({ length: Math.min(LIMITS.VISION_MAX_PARALLEL_BATCHES, batches.length) }, async () => {
    while (index < batches.length && !stopped) await runBatch(batches[index++]);
  });
  await Promise.all(lanes);

  // Nothing at all came back: let the orchestrator degrade the profile honestly.
  if (succeeded === 0 && observations.size === 0 && lastError) {
    // The UI shows a short, friendly note, so the raw provider message only lives here.
    console.error(
      JSON.stringify({ at: "observeAll", qid: context.entity.qid, error: String(lastError).slice(0, 400) }),
    );
    throw lastError;
  }
  return observations;
};

/**
 * The consumer scores and streams the batch. If it throws on one photo, that must not take the whole
 * visual check down with it: the rest of the observations are still good evidence.
 */
function report(onBatch: ((observations: VisionObservation[]) => void) | undefined, batch: VisionObservation[]): void {
  try {
    onBatch?.(batch);
  } catch (error) {
    console.error(JSON.stringify({ at: "observeAll.onBatch", error: String(error).slice(0, 300) }));
  }
}
