"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { SearchBox } from "./SearchBox";

/** P4 · #5 · SearchBox on the home page: navigates to /search?q=… and shows the loading state until the page switches. */
export function HomeSearch({ examples }: { examples: string[] }) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();

  return (
    <SearchBox
      examples={examples}
      loading={navigating}
      onSubmit={(query) => startNavigation(() => router.push(`/search?q=${encodeURIComponent(query)}`))}
    />
  );
}
