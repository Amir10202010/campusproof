import { LIMITS } from "@/lib/config/limits";
import type { RunContext, SimulateFlag } from "@/lib/types";

const SIMULATE_FLAGS: readonly SimulateFlag[] = ["web_search_down", "vision_down", "wikimedia_down"];

/** Parses `?simulate=web_search_down,vision_down` into known flags; unknown values are ignored. */
export function parseSimulate(value: string | null): SimulateFlag[] {
  if (!value) return [];
  return value
    .split(",")
    .map((flag) => flag.trim())
    .filter((flag): flag is SimulateFlag => (SIMULATE_FLAGS as readonly string[]).includes(flag));
}

export function createRunContext(options: {
  signal: AbortSignal;
  simulate?: SimulateFlag[];
  lang?: "ru" | "en";
  now?: number;
}): RunContext {
  const startedAt = options.now ?? Date.now();
  return {
    requestId: crypto.randomUUID(),
    startedAt,
    deadlineAt: startedAt + LIMITS.GLOBAL_DEADLINE_MS,
    signal: options.signal,
    simulate: options.simulate ?? [],
    lang: options.lang ?? "ru",
  };
}
