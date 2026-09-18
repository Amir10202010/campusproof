import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSerperRequestShape, serperProvider, toCandidates } from "@/lib/sources/webSearch/serper";
import { sourceFailureReason } from "@/lib/pipeline/reasons";
import type { SearchQuery } from "@/lib/sources/webSearch/types";

vi.mock("@/lib/cache/kv", () => ({ getRedis: () => null, kvGet: async () => null, kvSet: async () => {} }));
vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, env: { ...actual.env, serperApiKey: "test-key" } };
});

const query: SearchQuery = { q: '"Назарбаев Университет" общежитие', lang: "ru", countryCode: "kz" };
const imagesBody = {
  images: [{ imageUrl: "https://img.test/a.jpg", link: "https://nu.edu.kz/news", title: "Общежитие" }],
};
const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string) as Record<string, unknown>;

beforeEach(() => resetSerperRequestShape());
afterEach(() => vi.unstubAllGlobals());

describe("serper image search (#83)", () => {
  it("asks with the locale and returns candidates", async () => {
    const fetchMock = vi.fn(async () => Response.json(imagesBody));
    vi.stubGlobal("fetch", fetchMock);
    const candidates = await serperProvider.search(query, new AbortController().signal);
    expect(candidates).toHaveLength(1);
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({ q: query.q, gl: "kz", hl: "ru" });
  });

  it("retries a rejected localized request with the bare query and remembers the shape", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
      return "gl" in body ? new Response("bad request", { status: 400 }) : Response.json(imagesBody);
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await serperProvider.search(query, new AbortController().signal)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodyOf(fetchMock.mock.calls[1])).toEqual({ q: query.q });

    // The next query of the same instance must not spend a credit on the rejected shape again.
    await serperProvider.search({ ...query, q: "другой запрос" }, new AbortController().signal);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(bodyOf(fetchMock.mock.calls[2])).toEqual({ q: "другой запрос" });
  });

  it("puts the API answer into the error, so the source chip can explain it", async () => {
    vi.stubGlobal("fetch", async () => new Response("Not enough credits", { status: 403 }));
    await expect(serperProvider.search(query, new AbortController().signal)).rejects.toThrow(
      "Serper ответил HTTP 403: Not enough credits",
    );
  });

  it("drops rows without an image or a page url", () => {
    expect(
      toCandidates({ images: [{ imageUrl: "https://img.test/a.jpg" }, { link: "https://x.test" }] }, query),
    ).toEqual([]);
  });
});

describe("source failure reasons", () => {
  it("keeps Russian adapter messages and translates bare HTTP codes", () => {
    expect(sourceFailureReason(new Error("Serper ответил HTTP 403: Not enough credits"))).toBe(
      "Serper ответил HTTP 403: Not enough credits",
    );
    expect(sourceFailureReason(new Error("Wikimedia API commons.wikimedia.org failed: 429"))).toBe(
      "Источник ограничил частоту запросов",
    );
    expect(sourceFailureReason(new Error("fetch failed"))).toBe("Источник недоступен");
  });
});
