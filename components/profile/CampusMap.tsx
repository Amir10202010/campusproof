"use client";

import dynamic from "next/dynamic";
import { useId, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Photo, UniversityEntity } from "@/lib/types";
import { formatDistanceRu } from "@/lib/ui/format";
import { TIER_LABEL_RU } from "@/lib/ui/labels";
import { mapPoints, TIER_PIN_COLOR } from "@/lib/ui/map";

export interface CampusMapProps {
  entity: UniversityEntity | null; // campus coords + city center coords
  photos: Photo[]; // already filtered; only photos with `geo` become pins
  distanceToCityCenterM?: number;
  onOpenPhoto?: (photo: Photo) => void; // click on a pin → EvidenceDialog
}

// Leaflet touches `window` on import, so the map itself never renders on the server.
const CampusMapInner = dynamic(() => import("./CampusMapInner"), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full rounded-xl sm:h-96" />,
});

const TIERS = ["verified", "likely", "unconfirmed"] as const;

/**
 * P4 · #28 · Leaflet map, client-only: next/dynamic with ssr: false → CampusMapInner.tsx (+ leaflet/dist/leaflet.css),
 * OSM tiles with attribution. Campus marker, city-center marker, pins for geotagged photos (click → onOpenPhoto),
 * "≈ N км до центра по прямой". No campus coords and no geotagged photos → render nothing.
 */
export function CampusMap({ entity, photos, distanceToCityCenterM, onOpenPhoto }: CampusMapProps) {
  const points = useMemo(() => mapPoints(entity, photos), [entity, photos]);
  const titleId = useId();
  if (!points.campus && points.pins.length === 0) return null;

  return (
    <section aria-labelledby={titleId} className="scroll-mt-40 space-y-4">
      <div className="space-y-0.5 border-b pb-2.5">
        <h2 id={titleId} className="font-display text-title font-semibold">
          Карта
        </h2>
        <p className="text-[0.9375rem] text-muted-foreground">
          {points.pins.length > 0
            ? `Фото с геометкой: ${points.pins.length}. Нажмите на точку, чтобы открыть доказательства.`
            : "У показанных фото нет геометок — на карте только кампус и город."}
          {distanceToCityCenterM !== undefined
            ? ` Кампус ≈ ${formatDistanceRu(distanceToCityCenterM)} до центра города по прямой.`
            : ""}
        </p>
      </div>

      <CampusMapInner points={points} campusName={entity?.name ?? "университет"} onOpenPhoto={onOpenPhoto} />

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Обозначения на карте">
        {points.campus ? (
          <li className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-foreground ring-2 ring-background" />
            Кампус
          </li>
        ) : null}
        {points.cityCenter ? (
          <li className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-full border-2 border-dashed border-foreground bg-background" />
            Центр города
          </li>
        ) : null}
        {TIERS.filter((tier) => points.pins.some((photo) => photo.tier === tier)).map((tier) => (
          <li key={tier} className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-full ring-2 ring-background" style={{ background: TIER_PIN_COLOR[tier] }} />
            Фото: {TIER_LABEL_RU[tier]}
          </li>
        ))}
        <li>
          Карта ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            OpenStreetMap
          </a>
        </li>
      </ul>
    </section>
  );
}
