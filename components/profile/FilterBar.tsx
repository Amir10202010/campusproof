"use client";

import { ComponentStub } from "@/components/dev/ComponentStub";
import { MANDATORY_FILTERS } from "@/lib/config/categories";
import type { CategoryId } from "@/lib/types";
import { toggleCategory, type ProfileFilters } from "@/lib/ui/filters";

export interface FilterBarProps {
  value: ProfileFilters;
  onChange: (next: ProfileFilters) => void;
  counts: Partial<Record<CategoryId, number>>;
}

/** P4 · #3 · the 4 mandatory filters (exact labels from the case) + "show unconfirmed" switch; horizontal scroll on mobile. */
export function FilterBar(props: FilterBarProps) {
  const { value, onChange } = props;
  return (
    <ComponentStub name="FilterBar" issue={3}>
      <div className="flex flex-wrap gap-2">
        {MANDATORY_FILTERS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={value.categories.includes(c.id) ? "font-semibold underline" : "underline"}
            onClick={() => onChange(toggleCategory(value, c.id))}
          >
            {c.filterLabelRu} ({props.counts[c.id] ?? 0})
          </button>
        ))}
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={value.showUnconfirmed}
            onChange={(e) => onChange({ ...value, showUnconfirmed: e.target.checked })}
          />
          Показывать неподтверждённые
        </label>
      </div>
    </ComponentStub>
  );
}
