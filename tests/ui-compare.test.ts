import { describe, expect, it } from "vitest";
import { sampleProfile } from "@/fixtures/profile.sample";
import { REQUIRED_AREAS } from "@/lib/config/categories";
import type { UniversityProfile } from "@/lib/types";
import { compareHref, parseCompareParams, savedProfileResult, toCompareColumn } from "@/lib/ui/compare";

const profile: UniversityProfile = {
  ...sampleProfile,
  entity: { ...sampleProfile.entity, qid: "Q1734762" },
};

describe("compare params", () => {
  it("keeps only valid QIDs", () => {
    expect(parseCompareParams({ a: "Q1734762", b: "Q2783344" })).toEqual({ a: "Q1734762", b: "Q2783344" });
    expect(parseCompareParams({ a: "<script>", b: ["Q1", "Q2"] })).toEqual({ a: undefined, b: undefined });
  });

  it("builds shareable links", () => {
    expect(compareHref("Q1", "Q2")).toBe("/compare?a=Q1&b=Q2");
    expect(compareHref(undefined, "Q2")).toBe("/compare?b=Q2");
    expect(compareHref()).toBe("/compare");
  });
});

describe("toCompareColumn", () => {
  const column = toCompareColumn(profile);

  it("has every mandatory area with at most 3 best photos and never unconfirmed ones", () => {
    expect(column.areas.map((area) => area.category.id)).toEqual(REQUIRED_AREAS.map((c) => c.id));
    for (const area of column.areas) {
      expect(area.photos.length).toBeLessThanOrEqual(3);
      expect(area.photos.every((photo) => photo.tier !== "unconfirmed")).toBe(true);
      expect(area.photos.every((photo) => photo.category === area.category.id)).toBe(true);
    }
    const campus = column.areas.find((area) => area.category.id === "campus");
    expect(campus?.shownTotal).toBe(4);
    expect(campus?.photos.map((photo) => photo.tier)).toEqual(["verified", "verified", "verified"]);
  });

  it("keeps coverage for all 8 categories and counts tiers", () => {
    expect(column.coverage).toHaveLength(8);
    expect(column.totals.verified + column.totals.likely + column.totals.unconfirmed).toBe(profile.photos.length);
    expect(column.place).toBe("Астана, Kazakhstan");
  });
});

describe("savedProfileResult", () => {
  it("maps the saved-profile API to honest slot states", () => {
    expect(savedProfileResult(200, profile)).toEqual({ status: "ready", profile });
    expect(savedProfileResult(404, { error: "not_cached" })).toEqual({ status: "not_cached" });
    expect(savedProfileResult(501, { error: "not_implemented" })).toEqual({ status: "not_implemented" });
    expect(savedProfileResult(502, {})).toEqual({ status: "error" });
    expect(savedProfileResult(200, { error: "weird" })).toEqual({ status: "error" });
  });
});
