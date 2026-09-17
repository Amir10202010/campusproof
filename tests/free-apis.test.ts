import { describe, expect, it } from "vitest";
import { getRedis, kvGet, kvSet } from "@/lib/cache/kv";
import { freeAiAllowedFor } from "@/lib/pipeline/regions";

describe("free AI region gate (Gemini API terms: no free tier for EEA/CH/UK users)", () => {
  it("blocks EEA, Switzerland and the UK", () => {
    for (const code of ["DE", "fr", "NO", "IS", "CH", "GB"]) expect(freeAiAllowedFor(code), code).toBe(false);
  });

  it("allows Kazakhstan, Central Asia, others and unknown", () => {
    for (const code of ["KZ", "UZ", "KG", "TJ", "TM", "RU", "US", "TR"])
      expect(freeAiAllowedFor(code), code).toBe(true);
    expect(freeAiAllowedFor(null)).toBe(true);
    expect(freeAiAllowedFor("")).toBe(true);
  });
});

describe("kv cache without Redis configured", () => {
  it("reads null and writes nothing instead of throwing", async () => {
    if (getRedis()) return; // a developer with Upstash keys in the environment: skip
    await expect(kvSet("test:key", { a: 1 }, 60)).resolves.toBeUndefined();
    await expect(kvGet("test:key")).resolves.toBeNull();
  });
});
