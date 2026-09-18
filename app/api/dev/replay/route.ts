import type { NextRequest } from "next/server";
import { sampleStream } from "@/fixtures/stream.sample";
import { devFeaturesEnabled } from "@/lib/devOnly";
import { encodeSSE, SSE_HEADERS } from "@/lib/sse";

export const maxDuration = 60;

/**
 * DEV/PREVIEW ONLY: replays fixtures/stream.sample.ts as Server-Sent Events with realistic delays,
 * so P4/P1 can build the streaming UI before the real pipeline exists. 404 in production.
 * Query: ?speed=2 (twice as fast), ?speed=0.5 (half speed).
 */
export async function GET(request: NextRequest) {
  if (!devFeaturesEnabled) return new Response("Not found", { status: 404 });

  // Number("fast") is NaN and every delay would collapse to 0, so the demo would flash past.
  const requested = Number(request.nextUrl.searchParams.get("speed") ?? 1);
  const speed = Number.isFinite(requested) ? Math.min(Math.max(requested, 0.1), 10) : 1;
  let cancelled = false;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const { delayMs, event } of sampleStream) {
        await new Promise((resolve) => setTimeout(resolve, delayMs / speed));
        if (cancelled) return;
        controller.enqueue(encodeSSE(event));
      }
      controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(body, { headers: SSE_HEADERS });
}
