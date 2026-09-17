import { describe, expect, it } from "vitest";
import { sampleProfile } from "@/fixtures/profile.sample";
import type { Photo } from "@/lib/types";
import { mapPoints } from "@/lib/ui/map";

describe("mapPoints", () => {
  it("draws campus, city center and only geotagged photos", () => {
    const points = mapPoints(sampleProfile.entity, sampleProfile.photos);
    const geotagged = sampleProfile.photos.filter((p) => p.geo);
    expect(points.campus).toEqual(sampleProfile.entity.coords);
    expect(points.cityCenter?.name).toBe(sampleProfile.entity.city?.name);
    expect(points.pins.map((p) => p.id)).toEqual(geotagged.map((p) => p.id));
    expect(points.bounds).toHaveLength(2 + geotagged.length);
  });

  it("skips broken coordinates instead of crashing the map", () => {
    const broken: Photo = { ...sampleProfile.photos[0], id: "broken", geo: { lat: Number.NaN, lon: 200 } };
    const points = mapPoints({ ...sampleProfile.entity, coords: undefined, city: { name: "Город" } }, [broken]);
    expect(points).toEqual({ campus: undefined, cityCenter: undefined, pins: [], bounds: [] });
  });

  it("works before the university is resolved", () => {
    expect(mapPoints(null, []).bounds).toEqual([]);
  });
});
