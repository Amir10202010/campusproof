import type { RejectedItem, RejectReason } from "@/lib/types";
import { REJECT_REASON_RU } from "./labels";

/** Tray order: reasons that prove accuracy first (wrong university, stock), technical ones last. */
const REASON_ORDER = Object.keys(REJECT_REASON_RU) as RejectReason[];

export interface RejectedGroup {
  reason: RejectReason;
  items: RejectedItem[];
}

/** Groups filtered-out items by reason in tray order; unknown reasons (newer pipeline) go last. */
export function groupRejected(items: RejectedItem[]): RejectedGroup[] {
  const byReason = new Map<RejectReason, RejectedItem[]>();
  for (const item of items) byReason.set(item.reason, [...(byReason.get(item.reason) ?? []), item]);
  const rank = (reason: RejectReason) => {
    const index = REASON_ORDER.indexOf(reason);
    return index === -1 ? REASON_ORDER.length : index;
  };
  return [...byReason.entries()]
    .map(([reason, grouped]) => ({ reason, items: grouped }))
    .sort((a, b) => rank(a.reason) - rank(b.reason));
}

/** Portraits never get a thumbnail, even if a pipeline bug sends one (AGENTS.md: no close-up portraits). */
export function rejectedThumb(item: RejectedItem): string | undefined {
  return item.reason === "portrait" ? undefined : item.thumbUrl;
}
