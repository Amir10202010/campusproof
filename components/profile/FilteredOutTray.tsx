import { ComponentStub } from "@/components/dev/ComponentStub";
import type { RejectedItem } from "@/lib/types";

export interface FilteredOutTrayProps {
  items: RejectedItem[];
}

/** P4 · #27 (Friday, B-layer) · collapsible "Отфильтровано (N)" grouped by reason, thumbnails (none for portraits), source links. */
export function FilteredOutTray(props: FilteredOutTrayProps) {
  if (props.items.length === 0) return null;
  return (
    <ComponentStub name="FilteredOutTray" issue={27}>
      Отфильтровано: {props.items.length} ({[...new Set(props.items.map((i) => i.reason))].join(", ")})
    </ComponentStub>
  );
}
