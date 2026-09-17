import { vi } from "vitest";

/** Replays recorded Wikimedia responses by exact URL (tests never call live APIs). Returns the call log. */
export function replayFetch(recorded: Record<string, unknown>) {
  const calls: { url: string; userAgent: string | null }[] = [];
  vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, userAgent: new Headers(init?.headers).get("User-Agent") });
    const body = recorded[url];
    return body ? Response.json(body) : new Response("not recorded", { status: 404 });
  });
  return calls;
}
