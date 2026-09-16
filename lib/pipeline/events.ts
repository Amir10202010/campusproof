import { encodeSSE, encodeSSEComment, SSE_HEADERS } from "@/lib/sse";
import type { StreamEvent } from "@/lib/types";

export type Emit = (event: StreamEvent) => void;

const HEARTBEAT_MS = 10_000;

/**
 * Wraps a pipeline run into a Server-Sent Events response.
 * - events are flushed as soon as they are emitted;
 * - a heartbeat comment keeps proxies from closing an idle stream;
 * - the AbortSignal passed to `run` fires when the client disconnects (stop spending money);
 * - an unexpected exception becomes one generic `error` event (details go to server logs only).
 */
export function eventStreamResponse(
  run: (emit: Emit, signal: AbortSignal) => Promise<void>,
  requestSignal?: AbortSignal,
): Response {
  const abort = new AbortController();
  requestSignal?.addEventListener("abort", () => abort.abort(), { once: true });
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };
      const emit: Emit = (event) => push(encodeSSE(event));
      heartbeat = setInterval(() => push(encodeSSEComment()), HEARTBEAT_MS);

      try {
        await run(emit, abort.signal);
      } catch (error) {
        console.error(JSON.stringify({ at: "eventStreamResponse", error: String(error) }));
        emit({
          type: "error",
          code: "internal_error",
          message: "Внутренняя ошибка сервиса. Попробуйте ещё раз.",
          retryable: true,
        });
      } finally {
        clearInterval(heartbeat);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // already closed by the client
          }
        }
      }
    },
    cancel() {
      closed = true;
      clearInterval(heartbeat);
      abort.abort();
    },
  });

  return new Response(body, { headers: SSE_HEADERS });
}
