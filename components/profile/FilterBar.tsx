"use client";

import { useId, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MANDATORY_FILTERS } from "@/lib/config/categories";
import type { CategoryId } from "@/lib/types";
import {
  lensOf,
  SOURCE_LENSES,
  toggleCategory,
  withLens,
  type ProfileFilters,
  type SourceLensId,
} from "@/lib/ui/filters";
import { cn } from "@/lib/utils";

export interface FilterBarProps {
  value: ProfileFilters;
  onChange: (next: ProfileFilters) => void;
  counts: Partial<Record<CategoryId, number>>;
}

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:outline-solid";

const PRESSED =
  "data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground";

/** Rows scroll sideways on phones instead of wrapping into a tall sticky bar. */
const ROW =
  "flex gap-2 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden";

/**
 * P4 · #3 · the 4 mandatory filters (exact labels from the case) + "show unconfirmed" switch; horizontal scroll on mobile.
 * P4 · #29 · «Все / Официальные / Независимые» lens over `value.sourceTypes`.
 */
export function FilterBar({ value, onChange, counts }: FilterBarProps) {
  const switchId = useId();

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 sm:-mx-6">
      <div className="py-1.5 sm:px-6">
        <div role="group" aria-label="Фильтры по категориям" className={ROW}>
          <FilterChip pressed={value.categories.length === 0} onPress={() => onChange({ ...value, categories: [] })}>
            Все
          </FilterChip>
          {MANDATORY_FILTERS.map((category) => (
            <FilterChip
              key={category.id}
              pressed={value.categories.includes(category.id)}
              count={counts[category.id] ?? 0}
              onPress={() => onChange(toggleCategory(value, category.id))}
            >
              {category.filterLabelRu}
            </FilterChip>
          ))}
        </div>

        <div className={cn(ROW, "items-center gap-x-5 sm:justify-between")}>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={lensOf(value)}
            onValueChange={(id) => id && onChange(withLens(value, id as SourceLensId))}
            aria-label="Кто опубликовал фото"
            className="shrink-0"
          >
            {SOURCE_LENSES.map((lens) => (
              <ToggleGroupItem
                key={lens.id}
                value={lens.id}
                title={lens.id === "independent" ? "Энциклопедии, СМИ, независимые сайты и соцсети" : undefined}
                className={cn("h-8 px-3", PRESSED, FOCUS_RING)}
              >
                {lens.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex shrink-0 items-center gap-2">
            <Switch
              id={switchId}
              checked={value.showUnconfirmed}
              onCheckedChange={(checked) => onChange({ ...value, showUnconfirmed: checked })}
              className={FOCUS_RING}
            />
            <Label htmlFor={switchId} className="cursor-pointer font-normal whitespace-nowrap">
              Показывать неподтверждённые
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip(props: { pressed: boolean; count?: number; onPress: () => void; children: ReactNode }) {
  return (
    <Toggle
      variant="outline"
      size="sm"
      pressed={props.pressed}
      onPressedChange={props.onPress}
      className={cn("h-8 shrink-0 rounded-full px-3", PRESSED, FOCUS_RING)}
    >
      {props.children}
      {props.count !== undefined ? (
        <span className="min-w-5 rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums group-data-[state=on]/toggle:bg-primary-foreground/20 group-data-[state=on]/toggle:text-primary-foreground">
          {props.count}
        </span>
      ) : null}
    </Toggle>
  );
}
