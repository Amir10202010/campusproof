"use client";

import { ChevronDown, EyeOff } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { RejectedItem } from "@/lib/types";
import { displayHost, safeHttpUrl } from "@/lib/ui/format";
import { REJECT_REASON_RU } from "@/lib/ui/labels";
import { groupRejected, rejectedThumb, type RejectedGroup } from "@/lib/ui/rejected";
import { cn } from "@/lib/utils";
import { ExternalImage } from "./ExternalImage";

export interface FilteredOutTrayProps {
  items: RejectedItem[];
}

/** Items per reason before «Показать все». */
const GROUP_PREVIEW = 8;

/** P4 · #27 (Friday, B-layer) · collapsible "Отфильтровано (N)" grouped by reason, thumbnails (none for portraits), source links. */
export function FilteredOutTray({ items }: FilteredOutTrayProps) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const groups = useMemo(() => groupRejected(items), [items]);
  if (items.length === 0) return null;

  const summary = groups
    .slice(0, 3)
    .map((group) => `${REJECT_REASON_RU[group.reason].toLowerCase()}: ${group.items.length}`)
    .join(" · ");

  return (
    <section className="rounded-xl border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-start justify-between gap-3 rounded-xl p-4 text-left hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:outline-solid"
      >
        <span className="min-w-0">
          <span className="block text-lg font-semibold tracking-tight">Отфильтровано ({items.length})</span>
          <span className="block text-sm text-muted-foreground">
            {summary}
            {groups.length > 3 ? " · …" : ""}
          </span>
        </span>
        <ChevronDown
          className={cn("mt-1 size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div id={contentId} className="space-y-6 border-t p-4">
          <p className="text-sm text-muted-foreground">
            Эти снимки нашлись в источниках, но в профиль не попали. Показываем причину, чтобы было видно, как работают
            фильтры. Крупные портреты — без превью.
          </p>
          {groups.map((group) => (
            <ReasonGroup key={group.reason} group={group} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ReasonGroup({ group }: { group: RejectedGroup }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? group.items : group.items.slice(0, GROUP_PREVIEW);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">
        {REJECT_REASON_RU[group.reason]}{" "}
        <span className="font-normal text-muted-foreground tabular-nums">{group.items.length}</span>
      </h3>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((item, index) => (
          <RejectedCard key={`${item.sourcePageUrl}-${index}`} item={item} />
        ))}
      </ul>
      {group.items.length > GROUP_PREVIEW ? (
        <Button variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Свернуть" : `Показать все (${group.items.length})`}
        </Button>
      ) : null}
    </div>
  );
}

function RejectedCard({ item }: { item: RejectedItem }) {
  const thumb = rejectedThumb(item);
  const href = safeHttpUrl(item.sourcePageUrl);

  return (
    <li className="overflow-hidden rounded-lg border bg-card text-xs">
      <span className="block aspect-4/3 bg-muted">
        {thumb ? (
          <ExternalImage
            src={thumb}
            alt={`Отфильтровано: ${item.detail}`}
            className="size-full object-cover opacity-80 grayscale-[40%]"
          />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1.5 p-2 text-center text-muted-foreground">
            <EyeOff className="size-5" aria-hidden="true" />
            {item.reason === "portrait" ? "Портрет не показываем" : "Без превью"}
          </span>
        )}
      </span>
      <span className="block space-y-1 p-2">
        <span className="block">{item.detail}</span>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {displayHost(href)}
          </a>
        ) : null}
      </span>
    </li>
  );
}
