import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileView } from "@/components/containers/ProfileView";
import { getCachedProfile } from "@/lib/cache/profileCache";
import { devFeaturesEnabled } from "@/lib/devOnly";

const QID = /^Q\d{1,12}$/;

/**
 * A shared /u/Q123 link should name the university in the tab and in the link preview, not repeat the
 * site title. Only the SAVED profile is read: naming a page must never cost a Wikidata call, spend a
 * free quota or start a pipeline. No saved profile (or no Redis) → the layout's generic metadata.
 */
export async function generateMetadata({ params }: PageProps<"/u/[qid]">): Promise<Metadata> {
  const { qid } = await params;
  if (!QID.test(qid)) return {};
  const profile = await getCachedProfile(qid).catch(() => null);
  const name = profile?.entity.name;
  if (!name) return {};

  const place = [profile?.entity.city?.name, profile?.entity.country].filter(Boolean).join(", ");
  const title = `${name} — проверенные фото`;
  const description = `Фотографии кампуса${place ? ` (${place})` : ""}: у каждого снимка есть источник, дата и уровень доверия.`;
  return {
    title,
    description,
    alternates: { canonical: `/u/${qid}` },
    openGraph: { title, description, url: `/u/${qid}` },
    twitter: { title, description },
  };
}

/** /u/Q123 — shareable profile URL (&refresh=1, &simulate=…, &replay=1 on preview/dev). Owner: P1 · #11. */
export default async function UniversityPage({ params, searchParams }: PageProps<"/u/[qid]">) {
  const { qid } = await params;
  const query = await searchParams;
  if (!QID.test(qid)) notFound();

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
