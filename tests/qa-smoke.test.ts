import { describe, expect, it } from "vitest";
import { sampleProfile } from "@/fixtures/profile.sample";
import { sampleStream } from "@/fixtures/stream.sample";
import { encodeSSE, encodeSSEComment } from "@/lib/sse";
import {
  categoryIds,
  checkProfile,
  evaluate,
  parseSseBlock,
  renderReport,
  splitSseBuffer,
  streamUrl,
  summarize,
} from "@/scripts/qa/smoke.mjs";

const ids = categoryIds();
const decoder = new TextDecoder();

/** The same bytes the server sends, cut into awkward chunks. */
function parseWire(chunks: string[]) {
  let buffer = "";
  const events = [];
  for (const chunk of chunks) {
    const { blocks, rest } = splitSseBuffer(buffer + chunk);
    buffer = rest;
    for (const block of blocks) {
      const event = parseSseBlock(block);
      if (event) events.push({ ...event, t: events.length * 100 });
    }
  }
  return events;
}

describe("SSE parsing", () => {
  it("reads events produced by lib/sse.ts, even split mid-line, and skips heartbeats", () => {
    const wire =
      decoder.decode(encodeSSEComment()) + sampleStream.map(({ event }) => decoder.decode(encodeSSE(event))).join("");
    const chunks = wire.match(/[\s\S]{1,37}/g) ?? [];
    const events = parseWire(chunks);
    expect(events.map((e) => e.type)).toEqual(sampleStream.map(({ event }) => event.type));
    expect(events.at(-1)?.payload.profile.entity.qid).toBe(sampleProfile.entity.qid);
  });

  it("handles CRLF line endings", () => {
    expect(parseSseBlock(splitSseBuffer('event: x\r\ndata: {"a":1}\r\n\r\n').blocks[0])).toEqual({
      type: "x",
      payload: { a: 1 },
    });
  });
});

describe("honesty checks", () => {
  it("accepts the consistent fixture profile", () => {
    expect(checkProfile(sampleProfile, { ids })).toEqual({ fails: [], warns: [] });
  });

  it("fails broken sources, dates, tiers, categories, coverage and simulate flags", () => {
    const [photo] = sampleProfile.photos;
    const broken = {
      ...sampleProfile,
      degraded: [],
      photos: [
        { ...photo, id: "a", sourcePageUrl: "javascript:alert(1)" },
        { ...photo, id: "b", retrievedAt: "" },
        { ...photo, id: "c", tier: "rejected" },
        { ...photo, id: "d", category: "moon" },
        { ...photo, id: "e", points: photo.points + 1 },
      ],
    };
    const { fails, warns } = checkProfile(broken, { simulate: "web_search_down", ids });
    expect(fails.join("\n")).toMatch(/sourcePageUrl/);
    expect(fails.join("\n")).toMatch(/retrievedAt/);
    expect(fails.join("\n")).toMatch(/уровень/);
    expect(fails.join("\n")).toMatch(/категория/);
    expect(fails.join("\n")).toMatch(/покрытие/);
    expect(fails.join("\n")).toMatch(/web_search_unavailable/);
    expect(warns).toHaveLength(1);
  });
});

describe("evaluate and report", () => {
  const replay = parseWire(sampleStream.map(({ event }) => decoder.decode(encodeSSE(event))));

  it("passes the fixture replay and measures timings", () => {
    const verdict = evaluate({ query: { q: "replay" }, expect: ["profile"] }, { events: replay }, ids);
    expect(verdict.status).toBe("PASS");
    expect(verdict.summary.doneMs).toBeGreaterThan(verdict.summary.resolvedMs ?? Infinity);
    expect(summarize(replay).tiers.verified).toBeGreaterThan(0);
  });

  it("skips rate-limited runs and warns about unexpected outcomes", () => {
    const limited = [{ type: "error", payload: { code: "rate_limited" }, t: 5 }];
    expect(evaluate({ query: { q: "x" }, expect: ["profile"] }, { events: limited }, ids).status).toBe("SKIP");
    const ambiguous = [{ type: "ambiguous", payload: { candidates: [{}, {}] }, t: 5 }];
    expect(evaluate({ query: { q: "MSU" }, expect: ["profile"] }, { events: ambiguous }, ids).status).toBe("WARN");
    expect(
      evaluate({ query: { q: "x" }, expect: ["profile"] }, { events: [], error: "timeout 45 s" }, ids).status,
    ).toBe("FAIL");
  });

  it("renders a markdown table and builds stream URLs without refresh by default", () => {
    const verdict = evaluate({ query: { q: "replay" }, expect: ["profile"] }, { events: replay }, ids);
    const report = renderReport([{ group: "Тест", query: { q: "replay" }, ...verdict }], {
      date: "2026-09-18",
      base: "http://localhost:3000",
      refresh: false,
      startedAt: "2026-09-18 10:00 UTC",
    });
    expect(report).toContain(`| Тест | replay | профиль: ${sampleProfile.entity.name} (${sampleProfile.entity.qid}) |`);
    expect(streamUrl("https://x.app", { q: "KBTU", simulate: "vision_down" }, false)).toBe(
      "https://x.app/api/profile/stream?q=KBTU&simulate=vision_down",
    );
  });
});
