import { notFound } from "next/navigation";
import { ProfileView } from "@/components/containers/ProfileView";
import { devFeaturesEnabled } from "@/lib/devOnly";

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
