"use client";

import type { Photo } from "@/lib/types";
import { photoAlt, photoDateText } from "@/lib/ui/format";
import { PHOTO_LABEL_RU } from "@/lib/ui/labels";
import { cn } from "@/lib/utils";
import { ExternalImage } from "./ExternalImage";
import { TierBadge } from "./TierBadge";

export interface PhotoCardProps {
  photo: Photo;
  onOpen?: (photo: Photo) => void;
}

/**
 * P4 · #3 · thumbnail (<img loading="lazy" referrerPolicy="no-referrer"> + onError fallback), TierBadge,
 * source domain, date with its kind ("снято" / "опубликовано" / "загружено" / "получено"). Click → onOpen.
 */
export function PhotoCard({ photo, onOpen }: PhotoCardProps) {
  const content = (
    <>
      <span className="relative block aspect-4/3 overflow-hidden bg-muted">
        <ExternalImage
          src={photo.thumbUrl}
          alt={photoAlt(photo)}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <TierBadge tier={photo.tier} className="absolute top-2 left-2 shadow-sm" />
      </span>
      <span className="block space-y-0.5 px-2.5 py-2 text-xs">
        <span className="block truncate font-medium text-foreground">{photo.sourceDomain}</span>
        <span className="block text-muted-foreground">{photoDateText(photo)}</span>
        {photo.labels.map((label) => (
          <span key={label} className="block text-amber-800">
            {PHOTO_LABEL_RU[label]}
          </span>
        ))}
      </span>
    </>
  );

  const cardClass =
    "group block h-full w-full overflow-hidden rounded-xl border bg-card text-left text-card-foreground";
  if (!onOpen) return <div className={cardClass}>{content}</div>;

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => onOpen(photo)}
      className={cn(
        cardClass,
        "cursor-pointer transition-[border-color,box-shadow] hover:border-foreground/25 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:outline-solid",
      )}
    >
      {content}
      <span className="sr-only">Открыть доказательства</span>
    </button>
  );
}
