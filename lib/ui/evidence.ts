import type { Evidence } from "@/lib/types";

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
