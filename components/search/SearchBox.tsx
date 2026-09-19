"use client";

import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { LIMITS } from "@/lib/config/limits";

export interface SearchBoxProps {
  defaultValue?: string;
  loading?: boolean;
  examples?: string[];
  onSubmit: (query: string) => void;
}

/**
 * P4 · #3 · the one thing to do on this site. The submit button lives inside the field so the control
 * is a single object at every width — at 375 px a separate button squeezed the placeholder to nothing.
 * The whole field takes the focus ring, not just the <input>.
 */
export function SearchBox({ defaultValue, loading = false, examples = [], onSubmit }: SearchBoxProps) {
  const [value, setValue] = useState(defaultValue ?? "");
  const inputId = useId();

  const submit = (query: string) => {
    const trimmed = query.trim();
    if (trimmed && !loading) onSubmit(trimmed);
  };

  return (
    <div className="w-full space-y-3">
      <form
        role="search"
        aria-busy={loading}
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
      >
        <div className="flex h-13 items-center gap-1 rounded-xl border border-input bg-card pr-1.5 pl-3.5 shadow-xs transition-[color,box-shadow,border-color] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/45 sm:h-14 sm:pr-2 sm:pl-4">
          <Search className="size-4.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <label htmlFor={inputId} className="sr-only">
            Название университета
          </label>
          <input
            id={inputId}
            name="q"
            type="search"
            required
            maxLength={LIMITS.QUERY_MAX_LENGTH}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder="Название университета"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-base outline-none placeholder:text-muted-foreground/80 [&::-webkit-search-cancel-button]:hidden"
          />
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="h-10 shrink-0 gap-1.5 rounded-lg px-4 text-sm sm:h-10.5 sm:px-5"
          >
            {loading ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <ArrowRight className="hidden sm:block" aria-hidden="true" />
            )}
            {loading ? "Ищем…" : "Найти"}
          </Button>
        </div>
      </form>

      {examples.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-sm text-muted-foreground">Например:</span>
          {examples.map((example) => (
            <Button
              key={example}
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              className="h-7 rounded-full px-3 font-normal"
              onClick={() => {
                setValue(example);
                submit(example);
              }}
            >
              {example}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
