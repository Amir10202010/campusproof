import { describe, expect, it } from "vitest";
import { encodeSSE, encodeSSEComment } from "@/lib/sse";

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("encodeSSE", () => {
  it("writes event name and JSON data terminated by a blank line", () => {
    const text = decode(encodeSSE({ type: "error", code: "not_implemented", message: "x", retryable: false }));
    expect(text.startsWith("event: error\ndata: ")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(true);
    const json = JSON.parse(text.split("data: ")[1]);
    expect(json.code).toBe("not_implemented");
  });

  it("keeps multi-line strings on one data line", () => {
    const text = decode(encodeSSE({ type: "error", code: "x", message: "a\nb", retryable: true }));
    expect(text.trim().split("\n")).toHaveLength(2);
  });

  it("encodes comments", () => {
    expect(decode(encodeSSEComment("tick"))).toBe(": tick\n\n");
  });
});
