import type { GeoPoint, Photo, UniversityEntity } from "@/lib/types";

export type GeotaggedPhoto = Photo & { geo: NonNullable<Photo["geo"]> };

/** Map pin colors per tier (mirror the --tier-* tokens); the legend under the map repeats them as text. */
export const TIER_PIN_COLOR: Record<Photo["tier"], string> = {
  verified: "#047857",
  likely: "#d97706",
  unconfirmed: "#71717a",
};

export interface MapPoints {
  campus?: GeoPoint;
  cityCenter?: GeoPoint & { name: string };
  pins: GeotaggedPhoto[];
  /** Every point the map should fit, as [lat, lon]. */
  bounds: [number, number][];
}

function isValidPoint(point?: { lat?: number; lon?: number }): point is GeoPoint {
  return (
    point !== undefined &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    Math.abs(point.lat as number) <= 90 &&
    Math.abs(point.lon as number) <= 180
  );
}

/** P4 · #28 · what the campus map draws: campus, city center and geotagged photos (invalid coordinates are skipped). */
export function mapPoints(entity: UniversityEntity | null, photos: Photo[]): MapPoints {
  const campus = isValidPoint(entity?.coords) ? entity.coords : undefined;
  const city = entity?.city;
  const cityCenter =
    city && isValidPoint(city) ? { lat: city.lat as number, lon: city.lon as number, name: city.name } : undefined;
  const pins = photos.filter((photo): photo is GeotaggedPhoto => isValidPoint(photo.geo));
  const bounds = [campus, cityCenter, ...pins.map((photo) => photo.geo)]
    .filter((point): point is GeoPoint => point !== undefined)
    .map((point): [number, number] => [point.lat, point.lon]);
  return { campus, cityCenter, pins, bounds };
}
