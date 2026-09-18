import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileView } from "@/components/containers/ProfileView";
import { devFeaturesEnabled } from "@/lib/devOnly";
import { indexedUniversityName } from "@/lib/resolver/indexSearch";

/** The browser tab and history name the university; the name comes from the local index, not the network. */
export async function generateMetadata({ params }: PageProps<"/u/[qid]">): Promise<Metadata> {
  const { qid } = await params;
  const name = indexedUniversityName(qid);
  return name ? { title: name } : {};
}

/** /u/Q123 — shareable profile URL (&refresh=1, &simulate=…, &replay=1 on preview/dev). Owner: P1 · #11. */
export default async function UniversityPage({ params, searchParams }: PageProps<"/u/[qid]">) {
  const { qid } = await params;
  const query = await searchParams;
  if (!/^Q\d{1,12}$/.test(qid)) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <ProfileView
        qid={qid}
        refresh={query.refresh === "1"}
        simulate={typeof query.simulate === "string" ? query.simulate : undefined}
        replay={devFeaturesEnabled && query.replay === "1"}
      />
    </main>
  );
}
