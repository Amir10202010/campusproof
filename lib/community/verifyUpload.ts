import { GEO } from "@/lib/config/limits";
import { hammingDistance } from "@/lib/images/dhash";
import { haversineM } from "@/lib/sources/geo";
import type { CategoryId, GeoPoint, VisionObservation } from "@/lib/types";
import type { CommunityCheck, CommunityPhotoStatus } from "./types";

/**
 * Rule table for the four checks + status decision (owner: P1 · community feature, mirrors the
 * table-driven style of lib/scoring/tiers.ts). The CODE decides the status, never the model: vision only
 * reports observations (image_type, stock_like, names_institution, …), and this file turns them into pass/fail.
 */
export const DHASH_DUPLICATE_MAX_HAMMING = 10;
const REJECTING_IMAGE_TYPES = new Set([
  "render_or_illustration",
  "logo_or_emblem",
  "map_or_plan",
  "document_or_screenshot",
  "collage",
]);

/** Check A: EXIF coordinates vs. the university's coordinates. */
export function checkGeo(geo: GeoPoint | undefined, campus: GeoPoint | undefined): CommunityCheck {
  const id = "geo";
  const label = "Координаты съёмки (EXIF)";
  if (!geo) return { id, label, result: "unknown", detail: "В файле нет координат съёмки." };
  if (!campus) return { id, label, result: "unknown", detail: "У вуза нет опорных координат для сравнения." };

  const distanceM = haversineM(geo, campus);
  if (distanceM <= GEO.STRONG_NEAR_CAMPUS_M) {
    return { id, label, result: "pass", detail: `~${Math.round(distanceM)} м от кампуса — рядом, сильный сигнал.` };
  }
  if (distanceM <= GEO.SAME_CITY_M) {
    return { id, label, result: "unknown", detail: `~${(distanceM / 1000).toFixed(1)} км от кампуса — тот же город.` };
  }
  return { id, label, result: "fail", detail: `~${Math.round(distanceM / 1000)} км от кампуса — далеко.` };
}

/** Check B: dHash against every known photo of this university and a reachable sample of others. */
export function checkDuplicate(dHash: string, known: { dHash: string; qid: string }[], qid: string): CommunityCheck {
  const id = "duplicate";
  const label = "Совпадение с уже известными фото";
  let best: { distance: number; qid: string } | null = null;
  for (const entry of known) {
    const distance = hammingDistance(dHash, entry.dHash);
    if (!best || distance < best.distance) best = { distance, qid: entry.qid };
  }
  if (!best || best.distance > DHASH_DUPLICATE_MAX_HAMMING) {
    return { id, label, result: "pass", detail: "Совпадений с уже известными фото не найдено." };
  }
  if (best.qid !== qid) {
    return {
      id,
      label,
      result: "fail",
      detail: `Похоже на уже известное фото другого вуза (${best.qid}) — не оригинал.`,
    };
  }
  return { id, label, result: "fail", detail: "Это уже известный снимок из интернета, не оригинал." };
}

/** Check C: one vision call. The model only observes; this function decides pass/fail from the observation. */
export function checksFromVision(observation: VisionObservation, category: CategoryId): CommunityCheck[] {
  if (observation.close_up_portrait) {
    return [
      {
        id: "vision_portrait",
        label: "Крупный портрет",
        result: "fail",
        detail: "Похоже на крупный портрет человека — такие фото не публикуются.",
      },
    ];
  }

  const checks: CommunityCheck[] = [];
  if (REJECTING_IMAGE_TYPES.has(observation.image_type)) {
    checks.push({
      id: "vision_type",
      label: "Тип изображения",
      result: "fail",
      detail: `Похоже на «${observation.image_type}», а не на фотографию.`,
    });
  } else {
    checks.push({
      id: "vision_type",
      label: "Тип изображения",
      result: "pass",
      detail: "Похоже на настоящую фотографию.",
    });
  }

  if (observation.stock_like) {
    checks.push({ id: "vision_stock", label: "Похоже на сток", result: "fail", detail: "Похоже на стоковое фото." });
  }

  if (observation.names_institution === "other") {
    checks.push({
      id: "vision_institution",
      label: "Название на фото",
      result: "fail",
      detail: `На фото читается название другого учреждения: ${observation.other_institution_name ?? "неизвестно"}.`,
    });
  }

  if (observation.primary_category !== category && observation.primary_category !== "other") {
    checks.push({
      id: "vision_category",
      label: "Категория",
      result: "unknown",
      detail: `Зрение видит категорию «${observation.primary_category}», вы выбрали «${category}».`,
    });
  } else {
    checks.push({
      id: "vision_category",
      label: "Категория",
      result: "pass",
      detail: "Категория совпадает с выбранной.",
    });
  }

  return checks;
}

export function visionUnavailableCheck(reason: string): CommunityCheck {
  return { id: "vision_unavailable", label: "Визуальная проверка", result: "unknown", detail: reason };
}

/**
 * Status table (docs from the task prompt):
 *   verified_onsite — geo <= STRONG_NEAR_CAMPUS_M AND no duplicate match AND vision has zero rejects
 *   plausible       — vision clean, but geo is missing or only city-level
 *   rejected        — any reject from the duplicate check or vision
 *   pending_review  — vision was never called (quota, error, EEA/CH/UK visitor)
 */
export function decideStatus(
  geoResult: CommunityCheck,
  otherChecks: CommunityCheck[],
  visionAvailable: boolean,
): CommunityPhotoStatus {
  if (!visionAvailable) return "pending_review";
  if (otherChecks.some((c) => c.result === "fail")) return "rejected";
  if (geoResult.result === "pass") return "verified_onsite";
  return "plausible";
}
