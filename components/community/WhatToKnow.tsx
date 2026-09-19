"use client";

import { useEffect, useState } from "react";

interface Fact {
  text: string;
  sourceLabel: string;
  sourceUrl?: string;
}
interface Sentence {
  text: string;
  sourceLabel: string;
  sourceUrl?: string;
}
interface WhatToKnowData {
  facts: Fact[];
  sentences: Sentence[] | null;
}

export interface WhatToKnowProps {
  qid: string;
}

/**
 * "На что посмотреть" (owner: P1 · community feature, Этап 4): Gemini's prose when available, otherwise
 * the same code-collected facts as a plain list — the block never disappears just because AI is down.
 * Self-fetching (simplification under the submission deadline): normally data-loading stays in the
 * container (ProfileView), but this leaf block is independent enough to fetch its own small payload.
 */
export function WhatToKnow({ qid }: WhatToKnowProps) {
  const [data, setData] = useState<WhatToKnowData | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/community/what-to-know/${qid}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then(setData)
      .catch(() => setData(null));
    return () => controller.abort();
  }, [qid]);

  if (!data || data.facts.length === 0) return null;

  return (
    <div className="space-y-3 border-t pt-8">
      <h2 className="text-lg font-semibold">На что посмотреть</h2>
      {data.sentences ? (
        <div className="space-y-1 text-sm">
          {data.sentences.map((sentence, i) => (
            <p key={i}>
              {sentence.text}{" "}
              {sentence.sourceUrl ? (
                <a
                  href={sentence.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground underline"
                >
                  [{sentence.sourceLabel}]
                </a>
              ) : (
                <span className="text-muted-foreground">[{sentence.sourceLabel}]</span>
              )}
            </p>
          ))}
        </div>
      ) : (
        <ul className="space-y-1 text-sm">
          {data.facts.map((fact, i) => (
            <li key={i}>
              {fact.text} <span className="text-muted-foreground">[{fact.sourceLabel}]</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
