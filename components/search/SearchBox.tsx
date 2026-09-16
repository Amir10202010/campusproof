"use client";

import { useState } from "react";
import { ComponentStub } from "@/components/dev/ComponentStub";

export interface SearchBoxProps {
  defaultValue?: string;
  loading?: boolean;
  examples?: string[];
  onSubmit: (query: string) => void;
}

/** P4 · #3 · input + "Найти" button + example chips + loading state. */
export function SearchBox(props: SearchBoxProps) {
  const [value, setValue] = useState(props.defaultValue ?? "");
  return (
    <ComponentStub name="SearchBox" issue={3}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) props.onSubmit(value.trim());
        }}
      >
        <input className="border px-2 py-1" value={value} onChange={(e) => setValue(e.target.value)} />{" "}
        <button type="submit" className="underline" disabled={props.loading}>
          Найти
        </button>
      </form>
    </ComponentStub>
  );
}
