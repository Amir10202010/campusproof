import { listPhotos } from "@/lib/community/store";

/** GET /api/community/{qid} → { photos: PublicCommunityPhoto[] }. Owner: P1 · community feature. */
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ qid: string }> }) {
  const { qid } = await params;
  if (!/^Q\d{1,12}$/.test(qid)) return Response.json({ error: "bad_qid" }, { status: 400 });
  const photos = await listPhotos(qid);
  return Response.json({ photos });
}
