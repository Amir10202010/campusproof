import { GEO } from "@/lib/config/limits";
import { hostInList, NEWS_DOMAINS } from "@/lib/config/domains";
import { haversineM } from "@/lib/sources/geo";
import type {
  CategoryId,
  Evidence,
  FetchedCandidate,
  PhotoLabel,
  RejectReason,
  ScoringContext,
  VisionObservation,
} from "@/lib/types";

/**
 * P2 · issues #17 and #19 · the signal table of docs/architecture.md §5.6.
 * Every signal becomes one Evidence line that the user can read in the dialog — no hidden points.
 */
export interface SignalResult {
  evidence: Evidence[];
  labels: PhotoLabel[];
  /** At least one strong signal: needed for "Проверено". */
  strong: boolean;
  /** Render or a scene contradicting the context: blocks "Проверено". */
  negativeVisual: boolean;
  reject?: { reason: RejectReason; detail: string };
}

export const POINTS = {
  commons_depicts: 45,
  commons_category: 40,
  geo_near_campus: 35,
  geo_in_city: 35,
  wikipedia_use: 30,
  official_domain: 30,
  official_domain_weak: 10,
  visible_text_this: 30,
  page_mentions_name: 15,
  cross_source_match: 15,
  news_mentions_name: 10,
  visual_consistent: 10,
  geo_same_city: 10,
  visual_inconsistent: -25,
  render: -40,
  low_res: -10,
} as const;

/** A photo older than this is labeled "возможно, устарело" — buildings and grounds change. */
const OUTDATED_YEARS = 10;

/** Image types that are not a photograph at all (docs/architecture.md §5.6, hard rejects). */
const NOT_A_PHOTO: Partial<Record<VisionObservation["image_type"], string>> = {
  logo_or_emblem: "Это логотип или герб, а не фотография",
  map_or_plan: "Это карта или план, а не фотография",
  document_or_screenshot: "Это документ или скриншот, а не фотография",
  collage: "Это коллаж из нескольких снимков",
};

export function collectSignals(
  candidate: FetchedCandidate,
  observation: VisionObservation | null,
  context: ScoringContext,
  category: CategoryId,
): SignalResult {
  const evidence: Evidence[] = [];
  const labels: PhotoLabel[] = [];
  let strong = false;
  let negativeVisual = false;
  let reject: SignalResult["reject"];

  const add = (signal: keyof typeof POINTS, kind: Evidence["kind"], label: string, isStrong = false) => {
    evidence.push({ signal, kind, points: POINTS[signal], label });
    if (isStrong) strong = true;
  };
  const rejectWith = (reason: RejectReason, detail: string) => {
    reject ??= { reason, detail };
  };

  // ─── Where the photo comes from ──────────────────────────────────────────────
  const { provenance } = candidate;
  if (provenance.depictsQid) {
    add("commons_depicts", "provenance", "В Commons отмечено, что на фото изображён этот университет", true);
  }
  if (provenance.commonsCategoryMatch) {
    add("commons_category", "provenance", "В категории университета на Wikimedia Commons", true);
  }
  if (provenance.usedOnWikipedia) {
    add("wikipedia_use", "provenance", "Используется в статье об университете в Википедии", true);
  }
  if (provenance.officialDomain) {
    // An official page can still host a stock photo or a render: then it is only a weak hint.
    const weak = Boolean(observation?.stock_like) || observation?.image_type === "render_or_illustration";
    const signal = weak ? "official_domain_weak" : "official_domain";
    evidence.push({
      signal,
      kind: "provenance",
      points: POINTS[signal],
      label: weak
        ? `Найдено на официальном сайте ${candidate.sourceDomain}, но снимок похож на стоковый`
        : `Найдено на официальном сайте ${candidate.sourceDomain}`,
    });
    if (!weak) strong = true;
  }
  if (provenance.pageMentionsName) {
    add("page_mentions_name", "text", "Страница упоминает университет");
  }
  if (
    (provenance.sourceType === "news" || hostInList(candidate.sourceDomain, NEWS_DOMAINS)) &&
    provenance.pageMentionsName
  ) {
    add("news_mentions_name", "provenance", "Новостная статья об университете");
  }

  const otherSources = candidate.alsoFoundAt.filter((entry) => entry.sourceDomain !== candidate.sourceDomain);
  if (otherSources.length > 0) {
    add(
      "cross_source_match",
      "cross_source",
      otherSources.length === 1
        ? "То же фото найдено ещё в одном источнике"
        : `То же фото найдено ещё в ${otherSources.length} источниках`,
    );
  }

  // ─── Where it was taken ──────────────────────────────────────────────────────
  const city = context.entity.city;
  const cityPoint = city?.lat !== undefined && city?.lon !== undefined ? { lat: city.lat, lon: city.lon } : undefined;
  const reference = context.entity.coords ?? cityPoint;
  if (candidate.geo && reference) {
    const distance = haversineM(candidate.geo, reference);
    if (context.entity.coords && distance <= GEO.STRONG_NEAR_CAMPUS_M) {
      add("geo_near_campus", "geo", `Снято в ${formatDistance(distance)} от кампуса`, true);
    } else if (distance <= GEO.SAME_CITY_M) {
      if (category === "city")
        add("geo_in_city", "geo", `Снято в черте города${city?.name ? ` ${city.name}` : ""}`, true);
      else add("geo_same_city", "geo", `Снято в том же городе, в ${formatDistance(distance)} от кампуса`);
    } else if (distance > GEO.FAR_AWAY_M && category !== "city") {
      rejectWith("far_geotag", `Геометка в ${Math.round(distance / 1000)} км от кампуса`);
    }
  }

  // ─── What is on the image (observations only; the tier is decided by code) ───
  if (observation) {
    if (observation.close_up_portrait)
      rejectWith("portrait", "Крупный портрет человека — такие снимки мы не показываем");
    if (observation.names_institution === "other") {
      rejectWith(
        "other_institution",
        observation.other_institution_name
          ? `На снимке название другого вуза: ${observation.other_institution_name}`
          : "На снимке название другого вуза",
      );
    }
    const notAPhoto = NOT_A_PHOTO[observation.image_type];
    if (notAPhoto) rejectWith("not_a_photo", notAPhoto);

    if (observation.image_type === "render_or_illustration") {
      add("render", "visual", "Похоже на рендер или иллюстрацию, а не на фотографию");
      labels.push("render");
      negativeVisual = true;
    }
    if (observation.names_institution === "this") {
      add(
        "visible_text_this",
        "text",
        observation.visible_text
          ? `На снимке читается «${observation.visible_text}»`
          : "На снимке видно название университета",
        true,
      );
    }
    if (observation.scene_consistent_with_context === "consistent") {
      add("visual_consistent", "visual", "Изображение соответствует описанию этого вуза");
    }
    if (observation.scene_consistent_with_context === "inconsistent") {
      add("visual_inconsistent", "visual", "Сцена не похожа на описание этого вуза");
      negativeVisual = true;
    }
  } else {
    labels.push("visual_check_unavailable");
  }

  // ─── How completely we could check it ────────────────────────────────────────
  if (candidate.lowRes) {
    add("low_res", "quality", "Проверено по уменьшенной копии");
    labels.push("low_res_verification");
  }
  if (isOutdated(candidate.date)) labels.push("possibly_outdated");

  return { evidence, labels, strong, negativeVisual, ...(reject ? { reject } : {}) };
}

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} м` : `${(meters / 1000).toFixed(1).replace(".", ",")} км`;
}

function isOutdated(date: FetchedCandidate["date"]): boolean {
  if (!date || date.kind === "retrieved") return false;
  const year = Number(date.value.slice(0, 4));
  return Number.isFinite(year) && year > 1800 && new Date().getFullYear() - year >= OUTDATED_YEARS;
}
