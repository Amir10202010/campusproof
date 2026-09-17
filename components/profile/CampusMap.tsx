import { ComponentStub } from "@/components/dev/ComponentStub";
import type { Photo, UniversityEntity } from "@/lib/types";

export interface CampusMapProps {
  entity: UniversityEntity | null; // campus coords + city center coords
  photos: Photo[]; // already filtered; only photos with `geo` become pins
  distanceToCityCenterM?: number;
  onOpenPhoto?: (photo: Photo) => void; // click on a pin → EvidenceDialog
}

/**
 * P4 · #28 · Leaflet map, client-only: next/dynamic with ssr: false → CampusMapInner.tsx (+ leaflet/dist/leaflet.css),
 * OSM tiles with attribution. Campus marker, city-center marker, pins for geotagged photos (click → onOpenPhoto),
 * "≈ N км до центра по прямой". No campus coords and no geotagged photos → render nothing.
 */
export function CampusMap(props: CampusMapProps) {
  const geotagged = props.photos.filter((photo) => photo.geo);
  if (!props.entity?.coords && geotagged.length === 0) return null;
  return (
    <ComponentStub name="CampusMap" issue={28}>
      Координаты кампуса: {props.entity?.coords ? "есть" : "нет"} · фото с геометкой: {geotagged.length}
    </ComponentStub>
  );
}
