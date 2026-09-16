import type { StreamEvent } from "@/lib/types";

const encoder = new TextEncoder();

/** Encodes one event in Server-Sent Events format: `event: <type>` + `data: <json>`. */
export function encodeSSE(event: StreamEvent | ({ type: string } & Record<string, unknown>)): Uint8Array {
  return encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

/** Comment line that keeps proxies from closing an idle stream. */
export function encodeSSEComment(comment = "ping"): Uint8Array {
  return encoder.encode(`: ${comment}\n\n`);
}

export const SSE_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};
