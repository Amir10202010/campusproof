import type { DateKind, Photo, PhotoLabel } from "@/lib/types";

/** Russian UI texts for enum values from lib/types.ts. Owner: P4. Category labels live in lib/config/categories.ts. */

export const TIER_LABEL_RU: Record<Photo["tier"], string> = {
  verified: "Проверено",
  likely: "Вероятно",
  unconfirmed: "Не подтверждено",
};

/** Caption before a date: «снято 12.06.2023». */
export const DATE_KIND_RU: Record<DateKind, string> = {
  taken: "снято",
  published: "опубликовано",
  uploaded: "загружено",
  retrieved: "получено",
};

export const PHOTO_LABEL_RU: Record<PhotoLabel, string> = {
  render: "Рендер, не фото",
  possibly_outdated: "Возможно, устарело",
  visual_check_unavailable: "Без визуальной проверки",
  low_res_verification: "Проверено по миниатюре",
};
