import { encodeSSE, SSE_HEADERS } from "@/lib/sse";

export const maxDuration = 60;

/**
 * GET /api/profile/stream?q=... | ?qid=...  (&refresh=1, &simulate=web_search_down|vision_down|wikimedia_down)
 * Streams StreamEvent objects (lib/types.ts) as Server-Sent Events.
 * Owner: P1 · Spec: docs/architecture.md §4–§5
 * Stub: emits one honest `error` event until the pipeline exists.
 */
export async function GET() {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encodeSSE({
          type: "error",
          code: "not_implemented",
          message: "Пайплайн ещё не реализован",
          retryable: false,
        }),
      );
      controller.close();
    },
  });
  return new Response(body, { headers: SSE_HEADERS });
}
