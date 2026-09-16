import type { RunContext } from "@/lib/types";

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms} ms`);
    this.name = "TimeoutError";
  }
}

export function remainingMs(ctx: RunContext, now = Date.now()): number {
  return Math.max(0, ctx.deadlineAt - now);
}

export function elapsedMs(ctx: RunContext, now = Date.now()): number {
  return now - ctx.startedAt;
}

/**
 * Runs `task` with its own AbortSignal that fires on the stage timeout, on the global deadline,
 * or when the request is aborted (client disconnected). The task must pass the signal to fetch().
 */
export async function withTimeout<T>(
  label: string,
  ctx: RunContext,
  timeoutMs: number,
  task: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const budget = Math.min(timeoutMs, remainingMs(ctx));
  const controller = new AbortController();
  const onAbort = () => controller.abort(ctx.signal.reason);
  if (ctx.signal.aborted) controller.abort(ctx.signal.reason);
  else ctx.signal.addEventListener("abort", onAbort, { once: true });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new TimeoutError(label, budget);
      controller.abort(error);
      reject(error);
    }, budget);
  });

  try {
    return await Promise.race([task(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
    ctx.signal.removeEventListener("abort", onAbort);
  }
}
