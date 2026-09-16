import { describe, expect, it } from "vitest";
import { sampleProfile } from "@/fixtures/profile.sample";
import { sampleStream } from "@/fixtures/stream.sample";
import { initialProfileStreamState, profileStreamReducer } from "@/lib/client/profileStream";
import { computeCoverage } from "@/lib/pipeline/coverage";
import { haversineM } from "@/lib/sources/geo";
import { applyFilters, DEFAULT_FILTERS, toggleCategory } from "@/lib/ui/filters";

describe("profileStreamReducer", () => {
  it("replays the fixture stream into a finished state", () => {
    let state = profileStreamReducer(initialProfileStreamState, { type: "start", startedAt: 0, query: "demo" });
    let now = 0;
    for (const { delayMs, event } of sampleStream) {
      now += delayMs;
      state = profileStreamReducer(state, { type: "event", event, now });
    }
    expect(state.status).toBe("done");
    expect(state.photos).toHaveLength(sampleProfile.photos.length);
    expect(state.stages.every((s) => s.status === "done")).toBe(true);
    expect(state.descriptionReady).toBe(true);
    expect(state.finishedMs).toBe(now);
  });

  it("keeps photos unique when a batch is re-sent", () => {
    const photos = sampleProfile.photos.slice(0, 2);
    let state = profileStreamReducer(initialProfileStreamState, { type: "start", startedAt: 0 });
    state = profileStreamReducer(state, { type: "event", event: { type: "photos", photos }, now: 1 });
    state = profileStreamReducer(state, { type: "event", event: { type: "photos", photos }, now: 2 });
    expect(state.photos).toHaveLength(2);
  });
});

describe("helpers", () => {
  it("computeCoverage matches the fixture", () => {
    expect(computeCoverage(sampleProfile.photos)).toEqual(sampleProfile.coverage);
  });

  it("filters hide unconfirmed photos by default and filter by category", () => {
    const all = sampleProfile.photos;
    expect(applyFilters(all, DEFAULT_FILTERS).some((p) => p.tier === "unconfirmed")).toBe(false);
    const dorms = applyFilters(all, { ...toggleCategory(DEFAULT_FILTERS, "dormitory"), showUnconfirmed: true });
    expect(dorms.every((p) => p.category === "dormitory")).toBe(true);
    expect(dorms).toHaveLength(2);
  });

  it("haversine: Almaty → Astana is about 970 km", () => {
    const km = haversineM({ lat: 43.2389, lon: 76.8897 }, { lat: 51.1694, lon: 71.4491 }) / 1000;
    expect(km).toBeGreaterThan(950);
    expect(km).toBeLessThan(1000);
  });
});
