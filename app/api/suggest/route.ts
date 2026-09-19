import { NextResponse } from "next/server";
import { z } from "zod";
import { suggestUniversities } from "@/lib/community/suggestUniversity";
import { freeAiAllowedFor } from "@/lib/pipeline/regions";

/** POST { text } → до 5 вузов из каталога с объяснением. Node.js runtime: модуль серверный. */
export const runtime = "nodejs";

const body = z.object({ text: z.string().min(3).max(600) });

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Опишите запрос подробнее — хотя бы три символа." }, { status: 400 });
  }

  if (!freeAiAllowedFor(request.headers.get("x-vercel-ip-country"))) {
    return NextResponse.json(
      { message: "Подбор по описанию недоступен в вашем регионе. Найдите вуз по названию через поиск." },
      { status: 451 },
    );
  }

  const controller = new AbortController();
  request.signal.addEventListener("abort", () => controller.abort());

  const picks = await suggestUniversities(parsed.data.text, controller.signal);
  if (!picks) {
    return NextResponse.json(
      { message: "Подбор сейчас недоступен — попробуйте позже или найдите вуз по названию." },
      { status: 503 },
    );
  }
  return NextResponse.json({ picks });
}
