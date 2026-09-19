import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileView } from "@/components/containers/ProfileView";
import { LIMITS } from "@/lib/config/limits";
import { devFeaturesEnabled } from "@/lib/devOnly";

/** The browser tab shows what was searched for («KBTU · CampusProof»). */
export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, LIMITS.QUERY_MAX_LENGTH) : "";
  return query ? { title: query } : {};
}

/** /search?q=… (&refresh=1, &simulate=…, &replay=1 on preview/dev) → streams a profile. Owner: P1 · #11. */
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  if (!q) redirect("/");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <ProfileView
        query={q}
        refresh={params.refresh === "1"}
        simulate={typeof params.simulate === "string" ? params.simulate : undefined}
        replay={devFeaturesEnabled && params.replay === "1"}
      />
    </main>
  );
}
