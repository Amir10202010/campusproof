import { describe, expect, it } from "vitest";
import { sampleProfile } from "@/fixtures/profile.sample";
import { sampleStream } from "@/fixtures/stream.sample";
import { CATEGORIES } from "@/lib/config/categories";
import { TIER_THRESHOLDS } from "@/lib/config/limits";

describe("fixture profile", () => {
  it("coverage counts match the photos", () => {
    for (const { id } of CATEGORIES) {
      const photos = sampleProfile.photos.filter((p) => p.category === id);
      const count = (tier: string) => photos.filter((p) => p.tier === tier).length;
      const coverage = sampleProfile.coverage[id];
      expect(coverage.verified, id).toBe(count("verified"));
      expect(coverage.likely, id).toBe(count("likely"));
      expect(coverage.unconfirmed, id).toBe(count("unconfirmed"));
      const shown = coverage.verified + coverage.likely;
      const expected = shown >= 3 ? "good" : shown >= 1 ? "thin" : "none";
      expect(coverage.status, id).toBe(expected);
    }
  });

  it("photo points equal the sum of evidence and match their tier", () => {
    for (const photo of sampleProfile.photos) {
      const sum = photo.evidence.reduce((acc, e) => acc + e.points, 0);
      expect(photo.points, photo.id).toBe(sum);
      if (photo.tier === "verified") expect(photo.points).toBeGreaterThanOrEqual(TIER_THRESHOLDS.verified);
      if (photo.tier === "likely") expect(photo.points).toBeGreaterThanOrEqual(TIER_THRESHOLDS.likely);
      if (photo.tier === "unconfirmed") expect(photo.points).toBeGreaterThanOrEqual(TIER_THRESHOLDS.unconfirmed);
    }
  });

  it("stream replay ends with a done event carrying the profile", () => {
    const last = sampleStream.at(-1)?.event;
    expect(last?.type).toBe("done");
    const streamedPhotos = sampleStream.flatMap(({ event }) => (event.type === "photos" ? event.photos : []));
    expect(streamedPhotos).toHaveLength(sampleProfile.photos.length);
  });
});
