import { ComponentStub } from "@/components/dev/ComponentStub";
import { CATEGORIES } from "@/lib/config/categories";
import type { CategoryCoverage, CategoryId } from "@/lib/types";

export interface CoveragePanelProps {
  coverage: Record<CategoryId, CategoryCoverage>;
  onShowUnconfirmed?: (category: CategoryId) => void;
}

/** P4 · #4 · per category good / thin / none with human text ("Нет проверенных фото общежитий. 1 неподтверждённое — показать"). */
export function CoveragePanel(props: CoveragePanelProps) {
  return (
    <ComponentStub name="CoveragePanel" issue={4}>
      {CATEGORIES.map((c) => (
        <div key={c.id}>
          {c.labelRu}: {props.coverage[c.id].status} ({props.coverage[c.id].verified}/{props.coverage[c.id].likely}/
          {props.coverage[c.id].unconfirmed})
        </div>
      ))}
    </ComponentStub>
  );
}
