import { listPublishedReviews } from "@/lib/community/store";

/** GET /api/community/reviews/{qid} → { reviews: PublicCommunityReview[] } (published only). Owner: P1. */
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ qid: string }> }) {
  const { qid } = await params;
  if (!/^Q\d{1,12}$/.test(qid)) return Response.json({ error: "bad_qid" }, { status: 400 });
  const reviews = await listPublishedReviews(qid);
  return Response.json({ reviews });
}
