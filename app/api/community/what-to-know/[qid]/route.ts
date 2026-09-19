import { getCachedProfile } from "@/lib/cache/profileCache";
import { collectFacts } from "@/lib/community/whatToKnow";
import { rewriteFacts } from "@/lib/community/rewriteFacts";

/**
 * GET /api/community/what-to-know/{qid} — "На что посмотреть": code-collected facts, optionally
 * rewritten by Gemini into prose (never a verdict). Owner: P1 · community feature, Этап 4.
 */
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ qid: string }> }) {
  const { qid } = await params;
  if (!/^Q\d{1,12}$/.test(qid)) return Response.json({ error: "bad_qid" }, { status: 400 });

  const profile = await getCachedProfile(qid);
  if (!profile) return Response.json({ error: "not_cached", qid }, { status: 404 });

  const facts = collectFacts(profile);
  const sentences = await rewriteFacts(facts, request.signal);

  return Response.json({
    facts: facts.map((f) => ({ text: f.text, sourceLabel: f.sourceLabel, sourceUrl: f.sourceUrl })),
    sentences,
  });
}
