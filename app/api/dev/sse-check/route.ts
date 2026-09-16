import sharp from "sharp";
import type { NextRequest } from "next/server";
import { encodeSSE, encodeSSEComment, SSE_HEADERS } from "@/lib/sse";

export const maxDuration = 60;

/**
 * Infrastructure diagnostic (spike S5, docs/architecture.md §16) — not part of the product.
 * Verifies on Vercel that: (1) SSE events arrive unbuffered, (2) a ~25 s stream completes,
 * (3) the sharp native binary works, (4) the function runs in the expected region.
 * Try: curl -N https://<deployment>/api/dev/sse-check?seconds=25
 * Delete before submission (checklist in docs/plan-thursday.md).
 */
export async function GET(request: NextRequest) {
  const seconds = Math.min(Math.max(Number(request.nextUrl.searchParams.get("seconds") ?? 25), 1), 40);
  const startedAt = Date.now();

  let sharpCheck: Record<string, unknown>;
  try {
    const gradient = Buffer.alloc(64 * 64 * 3);
    for (let i = 0; i < 64 * 64; i++) gradient[i * 3] = i % 256;
    const png = await sharp(gradient, { raw: { width: 64, height: 64, channels: 3 } })
      .resize(32, 32)
      .png()
      .toBuffer();
    const meta = await sharp(png).metadata();
    sharpCheck = { ok: true, width: meta.width, height: meta.height, bytes: png.length };
  } catch (error) {
    sharpCheck = { ok: false, error: String(error) };
  }

  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encodeSSE({
          type: "check",
          region: process.env.VERCEL_REGION ?? "local",
          node: process.version,
          sharp: sharpCheck,
        }),
      );
      for (let i = 1; i <= seconds && !cancelled; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        controller.enqueue(encodeSSEComment(`tick ${i}`));
        controller.enqueue(encodeSSE({ type: "tick", i, elapsedMs: Date.now() - startedAt }));
      }
      if (!cancelled) {
        controller.enqueue(encodeSSE({ type: "done", elapsedMs: Date.now() - startedAt }));
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(body, { headers: SSE_HEADERS });
}
