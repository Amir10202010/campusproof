import { CATEGORY_BY_ID } from "@/lib/config/categories";
import type { Evidence, Photo } from "@/lib/types";
import { TIER_LABEL_RU } from "./labels";

/** Order of evidence groups in the dialog: where the photo comes from first, check quality last. */
export const EVIDENCE_KIND_ORDER: readonly Evidence["kind"][] = [
  "provenance",
  "geo",
  "text",
  "visual",
  "cross_source",
  "community",
  "quality",
];

export interface EvidenceGroup {
  kind: Evidence["kind"];
  items: Evidence[];
}

/** Groups evidence by kind in display order. Kinds unknown to this UI version still show up, at the end. */
export function groupEvidence(evidence: Evidence[]): EvidenceGroup[] {
  const kinds = [...EVIDENCE_KIND_ORDER, ...new Set(evidence.map((e) => e.kind))].filter(
    (kind, index, all) => all.indexOf(kind) === index,
  );
  return kinds
    .map((kind) => ({ kind, items: evidence.filter((e) => e.kind === kind) }))
    .filter((group) => group.items.length > 0);
}

/** Public issue tracker of the project: a report there needs a GitHub account but nothing else from us. */
const ISSUES_NEW_URL = "https://github.com/Amir10202010/campusproof/issues/new";

/**
 * «Сообщить об ошибке»: a new GitHub issue prefilled with what a maintainer needs to re-check the photo —
 * the image, the page it came from, the tier with its points and the page it was seen on.
 */
export function reportPhotoUrl(
  photo: Pick<Photo, "imageUrl" | "sourcePageUrl" | "sourceDomain" | "title" | "tier" | "points" | "category">,
  pageUrl?: string,
): string {
  const title = `Ошибка в фото: ${(photo.title?.trim() || photo.sourceDomain).slice(0, 100)}`;
  const body = [
    "**Что не так?** (другой вуз, не тот раздел, устаревшее фото, портрет, другое)",
    "",
    "",
    "---",
    `- Фото: ${photo.imageUrl}`,
    `- Источник: ${photo.sourcePageUrl}`,
    `- Уровень: ${TIER_LABEL_RU[photo.tier]}, очков: ${photo.points}, раздел: ${CATEGORY_BY_ID[photo.category].labelRu}`,
    ...(pageUrl ? [`- Страница CampusProof: ${pageUrl}`] : []),
  ].join("\n");
  return `${ISSUES_NEW_URL}?${new URLSearchParams({ title, body }).toString()}`;
}
