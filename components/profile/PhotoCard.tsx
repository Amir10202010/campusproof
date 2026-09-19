"use client";

import { BookOpen, Landmark, MessagesSquare, Newspaper, TriangleAlert, UserRound, type LucideIcon } from "lucide-react";
import type { Photo, SourceType } from "@/lib/types";
import { photoAlt, photoDateText } from "@/lib/ui/format";
import { PHOTO_LABEL_RU, SOURCE_TYPE_SHORT_RU } from "@/lib/ui/labels";
import { cn } from "@/lib/utils";
import { ExternalImage } from "./ExternalImage";
import { TierBadge } from "./TierBadge";

const SOURCE_TYPE_ICON: Record<Exclude<SourceType, "unknown">, LucideIcon> = {
  official: Landmark,
  encyclopedic: BookOpen,
  news: Newspaper,
  independent: UserRound,
  social: MessagesSquare,
};

export interface PhotoCardProps {
  photo: Photo;
  onOpen?: (photo: Photo) => void;
}

/**
 * P4 · #3 · one frame of the contact sheet: the picture, its verdict stamped on it, and the margin —
 * where it came from and when, set in mono because those are machine facts, not prose.
 *
 * The thumbnail is a plain <img loading="lazy" referrerPolicy="no-referrer"> with an onError fallback
 * (AGENTS.md: never next/image for third-party photos). Click → onOpen → the evidence dialog.
 */
export function PhotoCard({ photo, onOpen }: PhotoCardProps) {
  const content = (
    <>
      <span className="relative block aspect-4/3 shrink-0 overflow-hidden bg-muted">
        <ExternalImage
          src={photo.thumbUrl}
          alt={photoAlt(photo)}
          className="size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
        />
        <TierBadge tier={photo.tier} className="absolute top-2 left-2 shadow-sm" />
        <SourceTypeBadge type={photo.sourceType} />
      </span>
      {/* The margin annotation. Fixed leading keeps every frame in the grid the same height. */}
      <span className="flex grow flex-col gap-1 px-2.5 py-2">
        <span className="block truncate font-mono text-xs leading-5 text-foreground">{photo.sourceDomain}</span>
        <span className="block text-[0.8125rem] leading-5 text-muted-foreground">{photoDateText(photo)}</span>
        {photo.labels.length > 0 ? (
          <span className="mt-0.5 flex flex-wrap gap-1">
            {photo.labels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-sm bg-warn-surface px-1.5 py-0.5 text-xs leading-4 font-medium text-warn"
              >
                <TriangleAlert className="size-2.5 shrink-0" aria-hidden="true" />
                {PHOTO_LABEL_RU[label]}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </>
  );

  // A flex column, not a block: a <button> centers its content vertically, so in a grid row of cards with
  // different caption lengths the shorter cards' images slid down out of line.
  const cardClass =
    "group flex h-full w-full animate-reveal flex-col overflow-hidden rounded-lg bg-card text-left text-card-foreground ring-1 ring-border";
  if (!onOpen) return <div className={cardClass}>{content}</div>;

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => onOpen(photo)}
      className={cn(
        cardClass,
        "cursor-pointer transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid",
      )}
    >
      {content}
      <span className="sr-only">Открыть доказательства</span>
    </button>
  );
}

/** P4 · #29 · who published the photo: the university itself or someone independent. */
function SourceTypeBadge({ type }: { type: SourceType }) {
  if (type === "unknown") return null;
  const Icon = SOURCE_TYPE_ICON[type];
  return (
    <span className="absolute bottom-2 left-2 inline-flex h-6 max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-[3px] bg-black/75 px-2 text-xs font-medium text-white backdrop-blur-[2px]">
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{SOURCE_TYPE_SHORT_RU[type]}</span>
    </span>
  );
}
