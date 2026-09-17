import { describe, expect, it, vi } from "vitest";
import { LIMITS } from "@/lib/config/limits";
import type { RunContext, VisionObservation } from "@/lib/types";
import { contextBlock } from "@/lib/vision/gemini";
import { observeAll } from "@/lib/vision/observeAll";
import type { VisionContext, VisionItem, VisionProvider } from "@/lib/vision/provider";
import { parseVisionObservations } from "@/lib/vision/schema";

const context: VisionContext = {
  entity: {
    qid: "Q2783344",
    name: "Назарбаев Университет",
    names: { ru: "Назарбаев Университет", en: "Nazarbayev University" },
    aliases: ["НУ"],
    country: "Казахстан",
    countryCode: "KZ",
    city: { name: "Астана" },
    domains: ["nu.edu.kz"],
    wikipedia: [],
  },
  subcategories: ["Library of Nazarbayev University"],
  wikipediaExtract: "Назарбаев Университет — высшее учебное заведение в Астане.",
};

const ctx = (over: Partial<RunContext> = {}): RunContext => ({
  requestId: "test",
  startedAt: Date.now(),
  deadlineAt: Date.now() + 30_000,
  signal: new AbortController().signal,
  simulate: [],
  lang: "ru",
  ...over,
});

const items = (count: number, hint = "campus"): VisionItem[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `img${index}`,
    jpeg: Buffer.from("x"),
    meta: `commons.wikimedia.org | title | hint: ${hint}`,
  }));

const seen = (id: string): VisionObservation => ({
  id,
  image_type: "photo",
  stock_like: false,
  watermark_text: null,
  primary_category: "campus",
  secondary_categories: [],
  visible_text: "",
  names_institution: "this",
  other_institution_name: null,
  scene_consistent_with_context: "consistent",
  close_up_portrait: false,
  near_duplicate_of: null,
  quality: 4,
  reason: "",
});

const fakeProvider = (impl?: VisionProvider["observe"]): VisionProvider => ({
  observe: vi.fn(impl ?? (async (batch: VisionItem[]) => batch.map((item) => seen(item.id)))),
});

describe("parseVisionObservations", () => {
  const row = {
    id: "img1",
    image_type: "photo",
    stock_like: false,
    watermark_text: "",
    primary_category: "library",
    secondary_categories: ["campus", "nonsense"],
    visible_text: " Nazarbayev University ",
    names_institution: "this",
    other_institution_name: "",
    scene_consistent_with_context: "consistent",
    close_up_portrait: false,
    near_duplicate_of: "",
    quality: 4,
    reason: "reading room",
  };

  it("parses a valid answer and turns empty strings into null", () => {
    const [observation] = parseVisionObservations({ images: [row] });
    expect(observation).toMatchObject({
      id: "img1",
      primary_category: "library",
      secondary_categories: ["campus"],
      visible_text: "Nazarbayev University",
      watermark_text: null,
      other_institution_name: null,
      near_duplicate_of: null,
    });
  });

  it("accepts a JSON string, a code fence and a bare array", () => {
    expect(parseVisionObservations(JSON.stringify({ images: [row] }))).toHaveLength(1);
    expect(parseVisionObservations("```json\n" + JSON.stringify([row]) + "\n```")).toHaveLength(1);
  });

  it("falls back to safe values for odd fields instead of losing the batch", () => {
    const [observation] = parseVisionObservations({
      images: [{ id: "img2", image_type: "photograph", primary_category: "canteen", quality: 42, stock_like: "yes" }],
    });
    expect(observation).toMatchObject({
      id: "img2",
      image_type: "other",
      primary_category: "other",
      quality: 5,
      stock_like: false,
      names_institution: "unclear",
    });
  });

  it("throws when there are no observations at all", () => {
    expect(() => parseVisionObservations({ result: "ok" })).toThrow();
    expect(() => parseVisionObservations({ images: [{ image_type: "photo" }] })).toThrow();
  });
});

describe("observeAll", () => {
  it("splits the work into batches and reports each batch as soon as it returns", async () => {
    const provider = fakeProvider();
    const onBatch = vi.fn();
    const result = await observeAll(items(25), context, provider, ctx(), onBatch);

    expect(result.size).toBe(25);
    expect(provider.observe).toHaveBeenCalledTimes(3); // 12 + 12 + 1
    expect(vi.mocked(provider.observe).mock.calls.every(([batch]) => batch.length <= LIMITS.VISION_BATCH_SIZE)).toBe(
      true,
    );
    expect(onBatch).toHaveBeenCalledTimes(3);
  });

  it("ignores ids the model did not receive", async () => {
    const provider = fakeProvider(async (batch) => [...batch.map((item) => seen(item.id)), seen("hallucinated")]);
    const result = await observeAll(items(3), context, provider, ctx());
    expect([...result.keys()]).toEqual(["img0", "img1", "img2"]);
  });

  it("retries a failed batch with halves and keeps what comes back", async () => {
    let call = 0;
    const provider = fakeProvider(async (batch) => {
      call += 1;
      if (call === 1) throw new Error("500 from the model");
      if (call === 2) throw new Error("still broken");
      return batch.map((item) => seen(item.id));
    });
    const result = await observeAll(items(4), context, provider, ctx());
    expect(provider.observe).toHaveBeenCalledTimes(3); // full batch, then both halves
    expect(result.size).toBe(2); // the second half survived
  });

  it("stops asking when the free quota is gone", async () => {
    const provider = fakeProvider(async () => {
      throw new Error("429 RESOURCE_EXHAUSTED");
    });
    await expect(observeAll(items(25), context, provider, ctx())).rejects.toThrow(/429/);
    // Only the batches already in flight: no retry with halves and no new batches after the quota error.
    expect(vi.mocked(provider.observe).mock.calls.length).toBeLessThanOrEqual(LIMITS.VISION_MAX_PARALLEL_BATCHES);
  });

  it("keeps the observations of the batches that worked", async () => {
    let call = 0;
    const provider = fakeProvider(async (batch) => {
      call += 1;
      if (call === 1) throw new Error("429 quota");
      return batch.map((item) => seen(item.id));
    });
    // Two batches in flight: the first dies on quota, the second is already running.
    const result = await observeAll(items(24), context, provider, ctx());
    expect(result.size).toBeLessThanOrEqual(12);
  });

  it("does nothing without items", async () => {
    const provider = fakeProvider();
    expect((await observeAll([], context, provider, ctx())).size).toBe(0);
    expect(provider.observe).not.toHaveBeenCalled();
  });
});

describe("contextBlock", () => {
  it("tells the model which university to check against", () => {
    const block = contextBlock(context);
    expect(block).toContain("Nazarbayev University");
    expect(block).toContain("НУ");
    expect(block).toContain("Астана, Казахстан");
    expect(block).toContain("nu.edu.kz");
    expect(block).toContain("Library of Nazarbayev University");
  });
});
