"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Photo } from "@/lib/types";
import { photoAlt } from "@/lib/ui/format";
import { TIER_LABEL_RU } from "@/lib/ui/labels";
import { TIER_PIN_COLOR, type MapPoints } from "@/lib/ui/map";

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** P4 · #28 · Leaflet part of CampusMap. Client-only: loaded through next/dynamic with ssr: false. */
export default function CampusMapInner({
  points,
  campusName,
  onOpenPhoto,
}: {
  points: MapPoints;
  campusName: string;
  onOpenPhoto?: (photo: Photo) => void;
}) {
  const [first] = points.bounds;
  if (!first) return null;
  // One finger should scroll the page on phones, not drag the map (pinch zoom and +/- still work).
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className="isolate overflow-hidden rounded-xl border">
      <MapContainer
        center={first}
        zoom={14}
        scrollWheelZoom={false}
        dragging={!coarsePointer}
        zoomAnimation={!reducedMotion}
        fadeAnimation={!reducedMotion}
        markerZoomAnimation={!reducedMotion}
        className="h-72 w-full sm:h-96"
      >
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={OSM_ATTRIBUTION} maxZoom={19} />
        <FitBounds bounds={points.bounds} />

        {points.campus && points.cityCenter ? (
          <Polyline
            positions={[
              [points.campus.lat, points.campus.lon],
              [points.cityCenter.lat, points.cityCenter.lon],
            ]}
            pathOptions={{ color: "#171717", weight: 2, dashArray: "6 6", opacity: 0.6 }}
          />
        ) : null}

        {points.cityCenter ? (
          <CircleMarker
            center={[points.cityCenter.lat, points.cityCenter.lon]}
            radius={7}
            pathOptions={{ color: "#171717", weight: 2, fillColor: "#ffffff", fillOpacity: 1, dashArray: "3 3" }}
          >
            <Tooltip>Центр города: {points.cityCenter.name}</Tooltip>
          </CircleMarker>
        ) : null}

        {points.campus ? (
          <CircleMarker
            center={[points.campus.lat, points.campus.lon]}
            radius={10}
            pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#171717", fillOpacity: 1 }}
          >
            <Tooltip>Кампус: {campusName}</Tooltip>
          </CircleMarker>
        ) : null}

        {points.pins.map((photo) => (
          <CircleMarker
            key={photo.id}
            center={[photo.geo.lat, photo.geo.lon]}
            radius={7}
            pathOptions={{ color: "#ffffff", weight: 2, fillColor: TIER_PIN_COLOR[photo.tier], fillOpacity: 1 }}
            eventHandlers={{ click: () => onOpenPhoto?.(photo) }}
          >
            <Tooltip>
              {photoAlt(photo)} · {TIER_LABEL_RU[photo.tier]}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

/** Refits the view when the set of points changes (new photo batches, filters), not on every render. */
function FitBounds({ bounds }: { bounds: [number, number][] }) {
  const map = useMap();
  const key = JSON.stringify(bounds);
  useEffect(() => {
    const points = JSON.parse(key) as [number, number][];
    if (points.length === 1) map.setView(points[0], 15);
    else if (points.length > 1) map.fitBounds(points, { padding: [32, 32], maxZoom: 16 });
  }, [map, key]);
  return null;
}
