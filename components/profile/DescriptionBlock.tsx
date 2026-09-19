import { useId } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Description } from "@/lib/types";
import { safeHttpUrl } from "@/lib/ui/format";

export interface DescriptionBlockProps {
  description: Description | null;
  ready: boolean; // false → skeleton while the description is being written
}

/** Citation markers in the text: [1], [1][2] or [1, 2]. */
const MARKER = /\[(\d+(?:\s*,\s*\d+)*)\]/;

/**
 * P4 · #4 · text with clickable [n] citation markers → source links; skeleton while !ready; hide when null.
 *
 * Set as prose with a rule above it rather than inside a card: it is the one piece of reading on the
 * page, and a border around it would make it look like another status panel.
 */
export function DescriptionBlock({ description, ready }: DescriptionBlockProps) {
  const titleId = useId();

  if (!ready) {
    return (
      <section aria-busy="true" aria-labelledby={titleId} className="space-y-3 border-t pt-5">
        <h2 id={titleId} className="annotation">
          Составляем описание по источникам…
        </h2>
        <div aria-hidden="true" className="max-w-2xl space-y-2.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </section>
    );
  }
  if (!description) return null;

  const citations = new Map(description.citations.map((citation) => [citation.n, citation]));
  // split() with a capture group keeps the markers at odd indexes.
  const parts = description.text.split(new RegExp(MARKER, "g"));

  return (
    <section aria-labelledby={titleId} className="space-y-3 border-t pt-5">
      <h2 id={titleId} className="annotation">
        Об университете · кратко по источникам
      </h2>
      <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-pretty">
        {parts.map((part, index) =>
          index % 2 === 0
            ? part
            : part.split(",").map((raw) => {
                const n = Number(raw.trim());
                return <CitationMarker key={`${index}-${n}`} n={n} citation={citations.get(n)} />;
              }),
        )}
      </p>
      {description.citations.length > 0 ? (
        <ol className="max-w-2xl space-y-1 text-xs text-muted-foreground">
          {description.citations.map((citation) => {
            const href = safeHttpUrl(citation.url);
            return (
              <li key={citation.n}>
                <span className="font-mono">[{citation.n}]</span>{" "}
                {href ? (
                  <a
                    className="underline underline-offset-4 transition-colors hover:text-foreground"
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {citation.title}
                  </a>
                ) : (
                  citation.title
                )}
                {citation.quote ? <span> — «{citation.quote}»</span> : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

function CitationMarker({ n, citation }: { n: number; citation?: Description["citations"][number] }) {
  const href = safeHttpUrl(citation?.url);
  if (!citation || !href) return <sup className="font-mono">[{n}]</sup>;
  return (
    <sup className="font-mono">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={citation.quote ? `${citation.title}: «${citation.quote}»` : citation.title}
        className="rounded-sm px-0.5 font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid"
      >
        [{n}]<span className="sr-only"> источник: {citation.title}</span>
      </a>
    </sup>
  );
}
