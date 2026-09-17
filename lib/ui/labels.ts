import type { DateKind, Evidence, Photo, PhotoLabel, RejectReason, SourceStatus, SourceType } from "@/lib/types";

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

/** One-line tier meaning for legends (home page, profile guide). */
export const TIER_SHORT_RU: Record<Photo["tier"], string> = {
  verified: "сильное доказательство, что это именно этот вуз",
  likely: "доказательства есть, но их меньше",
  unconfirmed: "доказательств мало, скрыто по умолчанию",
};

/** Evidence kinds in the evidence dialog: what each kind of signal means (docs/architecture.md §5.6). */
export const EVIDENCE_KIND_RU: Record<Evidence["kind"], { title: string; hint: string }> = {
  provenance: { title: "Происхождение", hint: "где и кем опубликован снимок" },
  geo: { title: "Геометка", hint: "где сделан снимок по координатам из фото" },
  text: { title: "Текст", hint: "название вуза в подписи, на странице или на самом снимке" },
  visual: { title: "Что на снимке", hint: "сцену описала нейросеть; уровень ставит не она, а правила" },
  cross_source: { title: "Другие источники", hint: "тот же снимок нашёлся на других сайтах" },
  community: { title: "Отзывы пользователей", hint: "сообщения посетителей об этом фото" },
  quality: { title: "Полнота проверки", hint: "насколько полно удалось проверить снимок" },
};

/** What a source status means for the profile; lowercase, used after the source name. */
export const SOURCE_STATUS_HINT_RU: Record<SourceStatus["status"], string> = {
  ok: "ответил; число — сколько кандидатов он дал",
  partial: "ответил не на все запросы, поэтому фото может быть меньше",
  timeout: "не ответил вовремя — профиль собран без него, чтобы не ждать",
  error: "вернул ошибку — профиль собран без него",
  skipped: "пока не подключён в этой версии сервиса",
  simulated_down: "отключён специально для проверки: профиль строится и без него",
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

/** Short source-type badge on a photo card; `unknown` gets no badge. */
export const SOURCE_TYPE_SHORT_RU: Record<Exclude<SourceType, "unknown">, string> = {
  official: "Официальный",
  encyclopedic: "Энциклопедия",
  news: "СМИ",
  independent: "Независимый",
  social: "Соцсети",
};

/** Candidate providers (`Photo.provider`); unknown ids are shown as is. */
export const PROVIDER_RU: Record<string, string> = {
  commons: "Wikimedia Commons",
  serper: "веб-поиск",
  openverse: "Openverse",
};

/** Group titles in the «Отфильтровано» tray. */
export const REJECT_REASON_RU: Record<RejectReason, string> = {
  other_institution: "На снимке другой вуз",
  far_geotag: "Снято далеко от кампуса",
  stock_source: "Стоковые сайты",
  stock_reuse: "Стоковое фото на другом сайте",
  reused_across_universities: "Тот же снимок у других вузов",
  render: "Рендеры и иллюстрации",
  not_a_photo: "Не фотографии: логотипы, карты, документы",
  portrait: "Крупные портреты людей",
  duplicate: "Дубликаты",
  low_quality: "Низкое качество",
  low_score: "Мало доказательств",
  verification_timeout: "Не успели проверить",
  fetch_failed: "Не удалось загрузить",
};
