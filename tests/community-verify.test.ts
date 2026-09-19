import { describe, expect, it } from "vitest";
import {
  checkDuplicate,
  checkGeo,
  checksFromVision,
  decideStatus,
  visionUnavailableCheck,
} from "@/lib/community/verifyUpload";
import type { VisionObservation } from "@/lib/types";

const CAMPUS = { lat: 51.09, lon: 71.399 };

function observation(over: Partial<VisionObservation> = {}): VisionObservation {
  return {
    id: "img1",
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
    reason: "clear campus photo",
    ...over,
  };
}

describe("checkGeo", () => {
  it("passes when EXIF coordinates are within the strong radius of campus", () => {
    const result = checkGeo({ lat: 51.0905, lon: 71.3991 }, CAMPUS);
    expect(result.result).toBe("pass");
  });

  it("is unknown (not fail) when EXIF has no coordinates at all", () => {
    const result = checkGeo(undefined, CAMPUS);
    expect(result.result).toBe("unknown");
    expect(result.detail).toMatch(/нет координат/);
  });

  it("fails when the photo is far from campus", () => {
    const result = checkGeo({ lat: 43.238, lon: 76.889 }, CAMPUS); // Almaty vs. Astana coords
    expect(result.result).toBe("fail");
  });
});

describe("checkDuplicate", () => {
  const dHash = "0f0f0f0f0f0f0f0f";

  it("passes when the hash matches nothing known", () => {
    const result = checkDuplicate(dHash, [{ dHash: "ffffffffffffffff", qid: "Q1" }], "Q1");
    expect(result.result).toBe("pass");
  });

  it("fails with a cross-university message when the closest match belongs to another qid", () => {
    const result = checkDuplicate(dHash, [{ dHash, qid: "Q999" }], "Q1");
    expect(result.result).toBe("fail");
    expect(result.detail).toMatch(/другого вуза/);
  });

  it("fails as a known reused photo when the closest match is the same qid", () => {
    const result = checkDuplicate(dHash, [{ dHash, qid: "Q1" }], "Q1");
    expect(result.result).toBe("fail");
    expect(result.detail).not.toMatch(/другого вуза/);
  });
});

describe("checksFromVision", () => {
  it("rejects immediately on a close-up portrait, with no other checks", () => {
    const checks = checksFromVision(observation({ close_up_portrait: true }), "campus");
    expect(checks).toHaveLength(1);
    expect(checks[0].id).toBe("vision_portrait");
    expect(checks[0].result).toBe("fail");
  });

  it("rejects renders, logos, maps and stock-like images", () => {
    const render = checksFromVision(observation({ image_type: "render_or_illustration" }), "campus");
    expect(render.find((c) => c.id === "vision_type")?.result).toBe("fail");

    const stock = checksFromVision(observation({ stock_like: true }), "campus");
    expect(stock.find((c) => c.id === "vision_stock")?.result).toBe("fail");
  });

  it("rejects when the photo names a different institution", () => {
    const checks = checksFromVision(
      observation({ names_institution: "other", other_institution_name: "Some Other University" }),
      "campus",
    );
    expect(checks.find((c) => c.id === "vision_institution")?.result).toBe("fail");
  });

  it("flags a category mismatch as unknown, not a hard fail", () => {
    const checks = checksFromVision(observation({ primary_category: "library" }), "campus");
    const categoryCheck = checks.find((c) => c.id === "vision_category");
    expect(categoryCheck?.result).toBe("unknown");
  });

  it("passes a clean, on-category photo", () => {
    const checks = checksFromVision(observation(), "campus");
    expect(checks.every((c) => c.result !== "fail")).toBe(true);
  });
});

describe("decideStatus", () => {
  const pass = checkGeo({ lat: 51.0905, lon: 71.3991 }, CAMPUS);
  const unknownGeo = checkGeo(undefined, CAMPUS);
  const cleanVision = checksFromVision(observation(), "campus");
  const rejectingVision = checksFromVision(observation({ stock_like: true }), "campus");
  const duplicatePass = checkDuplicate("aaaa", [], "Q1");

  it("verified_onsite: strong geo, no duplicate, vision clean", () => {
    expect(decideStatus(pass, [duplicatePass, ...cleanVision], true)).toBe("verified_onsite");
  });

  it("plausible: vision clean but geo missing", () => {
    expect(decideStatus(unknownGeo, [duplicatePass, ...cleanVision], true)).toBe("plausible");
  });

  it("rejected: any vision reject wins over a strong geo match", () => {
    expect(decideStatus(pass, [duplicatePass, ...rejectingVision], true)).toBe("rejected");
  });

  it("rejected: a duplicate match rejects regardless of geo", () => {
    const dup = checkDuplicate("aaaaaaaaaaaaaaaa", [{ dHash: "aaaaaaaaaaaaaaaa", qid: "Q999" }], "Q1");
    expect(decideStatus(pass, [dup, ...cleanVision], true)).toBe("rejected");
  });

  it("pending_review: vision was never called", () => {
    const unavailable = visionUnavailableCheck("квота исчерпана");
    expect(decideStatus(pass, [duplicatePass, unavailable], false)).toBe("pending_review");
  });
});
