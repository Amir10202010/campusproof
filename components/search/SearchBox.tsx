"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LIMITS } from "@/lib/config/limits";

export interface SearchBoxProps {
  defaultValue?: string;
  loading?: boolean;
  examples?: string[];
  onSubmit: (query: string) => void;
}

/** P4 · #3 · input + "Найти" button + example chips + loading state. */
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
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
      >
        <div className="relative min-w-0 flex-1">
          <label htmlFor={inputId} className="sr-only">
            Название университета
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
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
            className="h-12 rounded-xl bg-background pl-10 text-base md:text-base"
          />
        </div>
        <Button type="submit" disabled={loading} className="h-12 rounded-xl px-5 text-base">
          {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
          {loading ? "Ищем…" : "Найти"}
        </Button>
      </form>

      {examples.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Например:</span>
          {examples.map((example) => (
            <Button
              key={example}
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              className="rounded-full"
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
