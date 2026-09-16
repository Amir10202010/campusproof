"use client";

import { ComponentStub } from "@/components/dev/ComponentStub";
import type { Photo } from "@/lib/types";

export interface EvidenceDialogProps {
  photo: Photo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * P4 · #4 · shadcn Dialog (Sheet on mobile): big image, tier + plain-language verdict, evidence list
 * (points > 0 → ✓, < 0 → ✗), "Открыть источник" (target=_blank rel="noopener noreferrer"), date + kind,
 * license/author, distance from campus, "Также найдено на", disabled "Сообщить об ошибке".
 */
export function EvidenceDialog(props: EvidenceDialogProps) {
  if (!props.open || !props.photo) return null;
  const { photo } = props;
  return (
    <ComponentStub name="EvidenceDialog" issue={4}>
      <div>
        {photo.tier} · {photo.points} б.
      </div>
      <ul>
        {photo.evidence.map((e) => (
          <li key={e.signal}>
            {e.points >= 0 ? "✓" : "✗"} {e.label}
          </li>
        ))}
      </ul>
      <a className="underline" href={photo.sourcePageUrl} target="_blank" rel="noopener noreferrer">
        Открыть источник
      </a>{" "}
      <button type="button" className="underline" onClick={() => props.onOpenChange(false)}>
        Закрыть
      </button>
    </ComponentStub>
  );
}
