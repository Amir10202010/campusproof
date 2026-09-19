"use client";

import { useState } from "react";
import { CATEGORY_BY_ID } from "@/lib/config/categories";
import type { PublicCommunityPhoto } from "@/lib/community/types";

export interface CommunityGalleryProps {
  photos: PublicCommunityPhoto[];
  onReport?: (id: string) => void;
}

const STATUS_LABEL: Record<PublicCommunityPhoto["status"], string> = {
  verified_onsite: "Подтверждено съёмкой на месте",
  plausible: "Похоже на настоящее, место не подтверждено",
  rejected: "Не прошло проверку",
  pending_review: "На модерации",
};

/** P1 · community feature · presentational: student photos, separate from the scored profile photos. */
export function CommunityGallery({ photos, onReport }: CommunityGalleryProps) {
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  if (photos.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {photos.map((photo) => (
        <div key={photo.id} className="space-y-1.5 rounded-lg border border-border bg-card p-2 text-sm">
          <img
            src={`data:image/jpeg;base64,${photo.jpegBase64}`}
            alt={photo.caption ?? CATEGORY_BY_ID[photo.category]?.labelRu ?? "Фото студента"}
            loading="lazy"
            className="aspect-4/3 w-full rounded-md object-cover"
          />
          <p className="font-medium">{STATUS_LABEL[photo.status]}</p>
          {photo.caption ? <p className="text-muted-foreground">{photo.caption}</p> : null}
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-2"
            onClick={() => setOpen(open === photo.id ? null : photo.id)}
          >
            {open === photo.id ? "Скрыть проверку" : "Как проверено"}
          </button>
          {open === photo.id ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {photo.checks.map((check) => (
                <li key={check.id} className="flex gap-1.5">
                  <span aria-hidden="true">{check.result === "pass" ? "✓" : check.result === "fail" ? "✗" : "?"}</span>
                  <span>{check.detail}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            disabled={reported.has(photo.id)}
            className="text-xs text-muted-foreground underline underline-offset-2 disabled:no-underline disabled:opacity-60"
            onClick={() => {
              setReported((prev) => new Set(prev).add(photo.id));
              onReport?.(photo.id);
            }}
          >
            {reported.has(photo.id) ? "Жалоба отправлена" : "Пожаловаться"}
          </button>
        </div>
      ))}
    </div>
  );
}
