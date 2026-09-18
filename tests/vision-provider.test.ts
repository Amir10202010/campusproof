import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VisionContext, VisionItem } from "@/lib/vision/provider";

/**
 * The Gemini REST provider itself (#18, #121, #124, #125): key rotation, model fallback and the
 * honest error when nothing is configured. Every request is mocked — tests never spend a free quota.
 */
const config = vi.hoisted(() => ({ keys: ["key-a", "key-b"] as string[] }));
vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...actual,
    env: new Proxy(actual.env, {
      get: (target, key) => (key === "geminiApiKeys" ? config.keys : Reflect.get(target, key)),
    }),
  };
});

const { createGeminiVisionProvider } = await import("@/lib/vision/gemini");

const context: VisionContext = {
  entity: {
    qid: "Q1",
    name: "Test University",
    names: { en: "Test University" },
    aliases: [],
    country: "Kazakhstan",
    countryCode: "KZ",
    domains: ["test.edu"],
    wikipedia: [],
  },
  subcategories: [],
};

const items: VisionItem[] = [{ id: "img1", jpeg: Buffer.from("x"), meta: "test.edu | hint: campus" }];

const answer = (id: string) =>
  JSON.stringify({
    images: [
      {
        id,
        image_type: "photo",
        stock_like: false,
        watermark_text: "",
        primary_category: "campus",
        secondary_categories: [],
        visible_text: "",
        names_institution: "this",
        other_institution_name: "",
        scene_consistent_with_context: "consistent",
        close_up_portrait: false,
        near_duplicate_of: "",
        quality: 4,
        reason: "",
      },
    ],
  });

const ok = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
const fail = (status: number, body = "{}") => new Response(body, { status });

/** Key of every generateContent call, in order: proves which key and model actually answered. */
function calls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).includes(":generateContent"))
    .map(([url, init]) => ({
      model: String(url).split("/").at(-1)?.replace(":generateContent", ""),
      key: (init as RequestInit).headers as Record<string, string>,
    }))
    .map(({ model, key }) => `${key["x-goog-api-key"]}@${model}`);
}

const signal = () => new AbortController().signal;

beforeEach(() => {
  config.keys = ["key-a", "key-b"];
  vi.restoreAllMocks();
});

describe("createGeminiVisionProvider", () => {
  it("says in plain Russian that no key is configured", async () => {
    config.keys = [];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(createGeminiVisionProvider().observe(items, context, signal())).rejects.toThrow(
      /не настроена: нет ключа GEMINI_API_KEY/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("moves to the spare key when the first one is out of quota, and remembers it", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
      (init.headers as Record<string, string>)["x-goog-api-key"] === "key-a"
        ? fail(429, '{"error":{"status":"RESOURCE_EXHAUSTED"}}')
        : ok(answer("img1")),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const provider = createGeminiVisionProvider();
    expect(await provider.observe(items, context, signal())).toHaveLength(1);
    // The next batch must not pay for the spent key again.
    expect(await provider.observe(items, context, signal())).toHaveLength(1);
    expect(calls(fetchMock).map((call) => call.split("@")[0])).toEqual(["key-a", "key-b", "key-b"]);
  });

  it("gives up honestly when every key is refused", async () => {
    const fetchMock = vi.fn(async () => fail(403, '{"error":{"status":"PERMISSION_DENIED"}}'));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    await expect(createGeminiVisionProvider().observe(items, context, signal())).rejects.toThrow(/Gemini 403/);
    expect(calls(fetchMock)).toHaveLength(2); // one attempt per key, then degrade
  });

  it("does not spend a second key on a problem that is not the key's fault", async () => {
    // A 400 is "key refused" territory; a plain server error is not, so a retry would be waste.
    const fetchMock = vi.fn(async (url: string) =>
      String(url).includes(":generateContent") ? fail(418, "teapot") : fail(500),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    await expect(createGeminiVisionProvider().observe(items, context, signal())).rejects.toThrow(/Gemini 418/);
    expect(calls(fetchMock)).toHaveLength(1);
  });

  it("switches model when the configured one is overloaded, and stays on the one that worked", async () => {
    const models = JSON.stringify({
      models: [
        { name: "models/gemini-flash-latest", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-flash-lite-latest", supportedGenerationMethods: ["generateContent"] },
      ],
    });
    const fetchMock = vi.fn(async (url: string) => {
      const target = String(url);
      if (!target.includes(":generateContent")) return new Response(models, { status: 200 });
      return target.includes("gemini-flash-latest:") ? ok(answer("img1")) : fail(503, "overloaded");
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const provider = createGeminiVisionProvider();
    expect(await provider.observe(items, context, signal())).toHaveLength(1);
    expect(await provider.observe(items, context, signal())).toHaveLength(1);
    const used = calls(fetchMock).map((call) => call.split("@")[1]);
    expect(used.at(0)).not.toBe("gemini-flash-latest"); // the configured model, which 503s here
    expect(used.at(-1)).toBe("gemini-flash-latest"); // discovery happens once, not per batch
  });
});
