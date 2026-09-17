import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/cache/kv";
import { env } from "@/lib/env";

/**
 * P1 · issue #13 · @upstash/ratelimit: fresh (non-cached) runs per client (20 / 10 min)
 * + a global daily counter (MAX_FRESH_PROFILES_PER_DAY). Cached views are never limited.
 * Protects the free quotas (Gemini requests/day, Serper credits). Redis missing, down or slow → no limits.
 */
export type AllowFreshRun = (clientKey: string) => Promise<{ allowed: boolean; reason?: string }>;

export const FRESH_RUNS_PER_CLIENT = 20;
const CLIENT_WINDOW = "10 m";
const REDIS_TIMEOUT_MS = 1_000;

export const RATE_LIMITED_MESSAGE =
  "Слишком много новых проверок с вашего адреса за 10 минут. Сохранённые профили открываются без ограничений — попробуйте позже.";
export const DAILY_BUDGET_MESSAGE =
  "Дневной лимит новых проверок исчерпан: сервис работает на бесплатных квотах. Сохранённые профили доступны, новые — завтра.";

let limiters: { perClient: Ratelimit; daily: Ratelimit } | null | undefined;

function getLimiters() {
  if (limiters === undefined) {
    const redis = getRedis();
    limiters = redis
      ? {
          perClient: new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(FRESH_RUNS_PER_CLIENT, CLIENT_WINDOW),
            prefix: "rl:fresh:client",
            timeout: REDIS_TIMEOUT_MS,
          }),
          daily: new Ratelimit({
            redis,
            limiter: Ratelimit.fixedWindow(env.maxFreshProfilesPerDay, "1 d"),
            prefix: "rl:fresh:daily",
            timeout: REDIS_TIMEOUT_MS,
          }),
        }
      : null;
  }
  return limiters;
}

export const allowFreshRun: AllowFreshRun = async (clientKey) => {
  const active = getLimiters();
  if (!active) return { allowed: true };
  try {
    const client = await active.perClient.limit(clientKey);
    if (!client.success) return { allowed: false, reason: RATE_LIMITED_MESSAGE };
    // The daily budget is spent only by runs that passed the per-client limit.
    const daily = await active.daily.limit("global");
    if (!daily.success) return { allowed: false, reason: DAILY_BUDGET_MESSAGE };
    return { allowed: true };
  } catch (error) {
    console.error(JSON.stringify({ at: "allowFreshRun", error: String(error) }));
    return { allowed: true };
  }
};

/** Hashed client IP (Vercel sets x-forwarded-for): raw IPs are never stored or logged. */
export function clientKeyFromHeaders(headers: Headers): string {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
