import { ComponentStub } from "@/components/dev/ComponentStub";
import type { Photo } from "@/lib/types";

export interface PhotoCardProps {
  photo: Photo;
  onOpen?: (photo: Photo) => void;
}

/**
 * P4 · #3 · thumbnail (<img loading="lazy" referrerPolicy="no-referrer"> + onError fallback), TierBadge,
 * source domain, date with its kind ("снято" / "опубликовано" / "загружено" / "получено"). Click → onOpen.
 */
export function PhotoCard(props: PhotoCardProps) {
  const { photo } = props;
  return (
    <ComponentStub name="PhotoCard" issue={3}>
      <button type="button" className="text-left underline" onClick={() => props.onOpen?.(photo)}>
        {photo.title ?? photo.id}
      </button>
      <div>
        {photo.tier} · {photo.points} б. · {photo.sourceDomain}
      </div>
    </ComponentStub>
  );
}
