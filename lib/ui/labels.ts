import type { DateKind, Photo, PhotoLabel, SourceType } from "@/lib/types";

/** Russian UI texts for enum values from lib/types.ts. Owner: P4. Category labels live in lib/config/categories.ts. */

export const TIER_LABEL_RU: Record<Photo["tier"], string> = {
  verified: "Проверено",
  likely: "Вероятно",
  unconfirmed: "Не подтверждено",
};

/** Plain-language meaning of a tier (tier rules: docs/architecture.md §5.6). */
export const TIER_VERDICT_RU: Record<Photo["tier"], string> = {
  verified: "Есть сильное доказательство, что снимок относится именно к этому университету, и нет противоречий.",
  likely: "Доказательства указывают на этот университет, но их не хватает для уровня «Проверено».",
  unconfirmed: "Доказательств мало. Прежде чем доверять снимку, откройте источник.",
};

/** Caption before a date: «снято 12.06.2023». */
export const DATE_KIND_RU: Record<DateKind, string> = {
  taken: "снято",
  published: "опубликовано",
  uploaded: "загружено",
  retrieved: "получено",
};

/** Where a date of each kind comes from, so nobody mistakes an upload date for the shooting date. */
export const DATE_KIND_HINT_RU: Record<DateKind, string> = {
  taken: "дата съёмки из данных камеры или от автора",
  published: "дата публикации страницы, снято могло быть раньше",
  uploaded: "дата загрузки в источник, снято могло быть раньше",
  retrieved: "дата, когда мы нашли фото; когда оно снято, неизвестно",
};

export const PHOTO_LABEL_RU: Record<PhotoLabel, string> = {
  render: "Рендер, не фото",
  possibly_outdated: "Возможно, устарело",
  visual_check_unavailable: "Без визуальной проверки",
  low_res_verification: "Проверено по миниатюре",
};

export const PHOTO_LABEL_DETAIL_RU: Record<PhotoLabel, string> = {
  render: "Похоже на рендер или иллюстрацию, а не на фотографию.",
  possibly_outdated: "Снимок может быть старым: здания и территория могли измениться.",
  visual_check_unavailable: "Визуальная проверка была недоступна: уровень выставлен только по источнику и метаданным.",
  low_res_verification: "Проверяли по уменьшенной копии изображения.",
};

export const SOURCE_TYPE_RU: Record<SourceType, string> = {
  official: "Официальный сайт",
  encyclopedic: "Энциклопедия",
  news: "СМИ",
  independent: "Независимый источник",
  social: "Соцсети",
  unknown: "Тип источника не определён",
};

/** Candidate providers (`Photo.provider`); unknown ids are shown as is. */
export const PROVIDER_RU: Record<string, string> = {
  commons: "Wikimedia Commons",
  serper: "веб-поиск",
  openverse: "Openverse",
};
