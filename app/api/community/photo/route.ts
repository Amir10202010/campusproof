import { randomUUID } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import type { NextRequest } from "next/server";
import { clientKeyFromHeaders } from "@/lib/cache/ratelimit";
import { getRedis } from "@/lib/cache/kv";
import { CATEGORY_BY_ID } from "@/lib/config/categories";
import { LIMITS } from "@/lib/config/limits";
import { collectKnownDHashes, savePhoto } from "@/lib/community/store";
import { toPublicPhoto } from "@/lib/community/types";
import {
  checkDuplicate,
  checkGeo,
  checksFromVision,
  decideStatus,
  visionUnavailableCheck,
} from "@/lib/community/verifyUpload";
import { prepareImage } from "@/lib/images/prepare";
import type { RunContext } from "@/lib/types";
import { getEntity } from "@/lib/sources/wikidata";
import { haversineM } from "@/lib/sources/geo";
import { freeAiAllowedFor } from "@/lib/pipeline/regions";
import { withTimeout } from "@/lib/pipeline/deadline";
import { createGeminiVisionProvider } from "@/lib/vision/gemini";

/**
 * POST /api/community/photo — a student uploads a photo, it runs through on-site verification
 * (EXIF geo, dHash duplicate check, one vision call) and is stored separately from the scored
 * pipeline photos. Owner: P1 · community feature (message.txt, Этап 1). Node runtime (sharp + multipart).
 */
export const runtime = "nodejs";

const QID_RE = /^Q\d{1,12}$/;
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const MAX_CAPTION_LEN = 200;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const UPLOADS_PER_WINDOW = 5;
const UPLOAD_WINDOW = "10 m";
const MAX_STORED_JPEG_BYTES = 900 * 1024;

let uploadLimiter: Ratelimit | null | undefined;
function getUploadLimiter(): Ratelimit | null {
  if (uploadLimiter === undefined) {
    const redis = getRedis();
    uploadLimiter = redis
      ? new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(UPLOADS_PER_WINDOW, UPLOAD_WINDOW),
          prefix: "rl:community:photo",
        })
      : null;
  }
  return uploadLimiter;
}

const visionProvider = createGeminiVisionProvider();

export async function POST(request: NextRequest) {
  const clientKey = clientKeyFromHeaders(request.headers);
  const limiter = getUploadLimiter();
  if (limiter) {
    try {
      const { success } = await limiter.limit(clientKey);
      if (!success) {
        return Response.json(
          { error: "rate_limited", message: "Не больше 5 загрузок за 10 минут с одного адреса." },
          { status: 429 },
        );
      }
    } catch {
      // Redis hiccup: don't block the upload over a rate-limit check that itself failed.
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "bad_request", message: "Не удалось прочитать форму загрузки." }, { status: 400 });
  }

  const file = form.get("file");
  const qid = String(form.get("qid") ?? "");
  const categoryRaw = String(form.get("category") ?? "");
  const caption = String(form.get("caption") ?? "").slice(0, MAX_CAPTION_LEN) || undefined;

  if (!QID_RE.test(qid)) return Response.json({ error: "bad_qid" }, { status: 400 });
  const category = CATEGORY_BY_ID[categoryRaw as keyof typeof CATEGORY_BY_ID];
  if (!category) return Response.json({ error: "bad_category", message: "Неизвестная категория." }, { status: 400 });
  if (!(file instanceof File)) {
    return Response.json({ error: "no_file", message: "Файл не найден в форме." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json({ error: "bad_type", message: "Допустимы только JPEG, PNG или WebP." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: "too_large", message: "Файл больше 6 МБ — сожмите и попробуйте снова." },
      { status: 400 },
    );
  }

  let prepared;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    prepared = await prepareImage(buffer);
  } catch {
    return Response.json({ error: "bad_image", message: "Не удалось прочитать изображение." }, { status: 400 });
  }
  let jpeg = prepared.jpeg;
  if (jpeg.byteLength > MAX_STORED_JPEG_BYTES) {
    const sharp = (await import("sharp")).default;
    jpeg = await sharp(jpeg).jpeg({ quality: 60 }).toBuffer();
  }

  const now = Date.now();
  const ctx: RunContext = {
    requestId: randomUUID(),
    startedAt: now,
    deadlineAt: now + LIMITS.VISION_BATCH_TIMEOUT_MS + 2_000,
    signal: request.signal,
    simulate: [],
    lang: "ru",
  };

  let campusCoords;
  let entityName = "";
  try {
    const { entity } = await withTimeout("community.getEntity", ctx, LIMITS.ADAPTER_TIMEOUT_MS, (signal) =>
      getEntity(qid, signal),
    );
    campusCoords = entity.coords;
    entityName = entity.name;
  } catch {
    // Unknown entity is not fatal for verification: the geo check just becomes "unknown".
  }

  const geoResult = checkGeo(prepared.exif?.gps, campusCoords);
  const known = await collectKnownDHashes(qid);
  const duplicateResult = checkDuplicate(prepared.dHash, known, qid);

  const aiAllowed = freeAiAllowedFor(request.headers.get("x-vercel-ip-country"));
  let visionChecks;
  let visionAvailable = false;
  if (!aiAllowed) {
    visionChecks = [
      visionUnavailableCheck("Визуальная проверка недоступна для вашего региона (условия бесплатного тарифа Gemini)."),
    ];
  } else {
    try {
      const observations = await withTimeout("community.vision", ctx, LIMITS.VISION_BATCH_TIMEOUT_MS, (signal) =>
        visionProvider.observe(
          [{ id: prepared.dHash, jpeg, meta: `community upload | category hint: ${category.id}` }],
          {
            entity: {
              qid,
              name: entityName || qid,
              names: {},
              aliases: [],
              country: "",
              countryCode: "",
              domains: [],
              wikipedia: [],
            },
            subcategories: [],
          },
          signal,
        ),
      );
      const observation = observations[0];
      if (observation) {
        visionChecks = checksFromVision(observation, category.id);
        visionAvailable = true;
      } else {
        visionChecks = [visionUnavailableCheck("Модель не вернула наблюдение для этого фото.")];
      }
    } catch {
      visionChecks = [visionUnavailableCheck("Визуальная проверка сейчас недоступна (квота или ошибка сервиса).")];
    }
  }

  const otherChecks = [duplicateResult, ...visionChecks];
  const status = decideStatus(geoResult, otherChecks, visionAvailable);
  const checks = [geoResult, ...otherChecks];

  if (status === "rejected") {
    return Response.json({ status, checks }, { status: 200 });
  }

  const photo = {
    id: `${prepared.dHash}-${now}`,
    qid,
    category: category.id,
    jpegBase64: jpeg.toString("base64"),
    dHash: prepared.dHash,
    width: prepared.width,
    height: prepared.height,
    ...(prepared.exif?.takenAt ? { takenAt: prepared.exif.takenAt } : {}),
    ...(prepared.exif?.gps ? { geo: prepared.exif.gps } : {}),
    ...(prepared.exif?.gps && campusCoords
      ? { distanceToCampusM: Math.round(haversineM(prepared.exif.gps, campusCoords)) }
      : {}),
    status,
    checks,
    ...(caption ? { caption } : {}),
    createdAt: new Date(now).toISOString(),
    authorKey: clientKey,
  } as const;

  await savePhoto(photo);
  return Response.json(toPublicPhoto(photo), { status: 201 });
}
