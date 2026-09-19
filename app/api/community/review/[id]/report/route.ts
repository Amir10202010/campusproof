import { getReview, updateReview } from "@/lib/community/store";
import { statusAfterReport } from "@/lib/community/moderateReview";

/** POST /api/community/review/{id}/report — three reports auto-hold a review. Owner: P1 · community feature. */
export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await getReview(id);
  if (!review) return Response.json({ error: "not_found" }, { status: 404 });

  const reportCount = review.reportCount + 1;
  const status = statusAfterReport(review.status, reportCount);
  await updateReview({ ...review, reportCount, status });

  return Response.json({ ok: true, status });
}
