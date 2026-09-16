import { getCachedProfile } from "@/lib/cache/profileCache";
import { isNotImplemented } from "@/lib/notImplemented";

/**
 * GET /api/profile/{qid} → cached UniversityProfile JSON (permalinks, compare, eval scripts, stream fallback).
 * Owner: P1 · issue #12. The route is final; the logic lives in lib/cache/profileCache.ts.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ qid: string }> }) {
  const { qid } = await params;
  if (!/^Q\d{1,12}$/.test(qid)) return Response.json({ error: "bad_qid" }, { status: 400 });

  try {
    const profile = await getCachedProfile(qid);
    if (!profile) return Response.json({ error: "not_cached", qid }, { status: 404 });
    return Response.json(profile);
  } catch (error) {
    if (isNotImplemented(error)) {
      return Response.json({ error: "not_implemented", message: error.message }, { status: 501 });
    }
    console.error(JSON.stringify({ at: "api/profile/[qid]", error: String(error) }));
    return Response.json({ error: "cache_failed" }, { status: 502 });
  }
}
