/**
 * GET /api/profile/{qid} → cached UniversityProfile JSON (permalinks, compare, stream fallback, eval scripts).
 * Owner: P1 · Spec: docs/architecture.md §4, §8
 * Stub until the cache exists.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ qid: string }> }) {
  const { qid } = await params;
  return Response.json({ error: "not_implemented", owner: "P1", qid }, { status: 501 });
}
