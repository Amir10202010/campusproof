import { randomUUID } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import type { NextRequest } from "next/server";
import { getRedis } from "@/lib/cache/kv";
import { clientKeyFromHeaders } from "@/lib/cache/ratelimit";
import {
  classifyReviewText,
  MAX_REVIEW_LENGTH,
  MIN_REVIEW_LENGTH,
  statusFromLabel,
  stripPersonalData,
} from "@/lib/community/moderateReview";
import { saveReview } from "@/lib/community/store";
import { toPublicReview, type CommunityReview, type ReviewAspect } from "@/lib/community/types";

/**
 * POST /api/community/review — a review is a filter for insults/spam/PII, never a verdict on the
 * university (moderation, not evaluation). Owner: P1 · community feature (message.txt, Этап 2).
 */
export const runtime = "nodejs";

const QID_RE = /^Q\d{1,12}$/;
const ASPECTS = new Set<ReviewAspect>(["dorm", "study", "campus", "city", "other"]);
const REVIEWS_PER_WINDOW = 3;
const REVIEW_WINDOW = "1 h";

let reviewLimiter: Ratelimit | null | undefined;
function getReviewLimiter(): Ratelimit | null {
  if (reviewLimiter === undefined) {
    const redis = getRedis();
    reviewLimiter = redis
      ? new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(REVIEWS_PER_WINDOW, REVIEW_WINDOW),
          prefix: "rl:community:review",
        })
      : null;
  }
  return reviewLimiter;
}

export async function POST(request: NextRequest) {
  const clientKey = clientKeyFromHeaders(request.headers);
  const limiter = getReviewLimiter();
  if (limiter) {
    try {
      const { success } = await limiter.limit(clientKey);
      if (!success) {
        return Response.json(
          { error: "rate_limited", message: "Не больше 3 отзывов в час с одного адреса." },
          { status: 429 },
        );
      }
    } catch {
      // Redis hiccup: don't block on a check that itself failed.
    }
  }

  let body: { qid?: string; aspect?: string; rating?: number; text?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const qid = String(body.qid ?? "");
  if (!QID_RE.test(qid)) return Response.json({ error: "bad_qid" }, { status: 400 });
  const aspect = body.aspect as ReviewAspect;
  if (!ASPECTS.has(aspect)) return Response.json({ error: "bad_aspect" }, { status: 400 });
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return Response.json({ error: "bad_rating" }, { status: 400 });
  }
  const rawText = String(body.text ?? "").trim();
  if (rawText.length < MIN_REVIEW_LENGTH || rawText.length > MAX_REVIEW_LENGTH) {
    return Response.json(
      { error: "bad_text", message: `Отзыв должен быть от ${MIN_REVIEW_LENGTH} до ${MAX_REVIEW_LENGTH} символов.` },
      { status: 400 },
    );
  }

  const text = stripPersonalData(rawText);
  const label = await classifyReviewText(text, request.signal);
  const status = statusFromLabel(label);

  const review: CommunityReview = {
    id: randomUUID(),
    qid,
    aspect,
    rating: rating as 1 | 2 | 3 | 4 | 5,
    text,
    status,
    reportCount: 0,
    createdAt: new Date().toISOString(),
    authorKey: clientKey,
  };
  await saveReview(review);

  return Response.json(toPublicReview(review), { status: 201 });
}
