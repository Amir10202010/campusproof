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
  reportDate,
  reportPath,
  splitSseBuffer,
  startedAtText,
  streamUrl,
  summarize,
  summarizeRun,
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

  it("summarizes the run for README: fresh timings, tiers of regular profiles, outcomes", () => {
    const profile = evaluate({ query: { q: "replay" }, expect: ["profile"] }, { events: replay }, ids);
    const notFound = evaluate(
      { query: { q: "asdfgh" }, expect: ["not_found"] },
      { events: [{ type: "not_found", payload: { suggestions: [] }, t: 5 }] },
      ids,
    );
    const results = [
      { group: "Тест", query: { q: "replay" }, ...profile },
      { group: "Тест", query: { q: "replay", simulate: "vision_down" }, ...profile },
      { group: "Тест", query: { q: "asdfgh" }, ...notFound },
    ];
    const summary = summarizeRun(results);
    const { verified, likely, unconfirmed } = profile.summary.tiers;
    expect(summary.outcomes).toEqual({ profile: 2, simulated: 1, ambiguous: 0, notFound: 1, error: 0 });
    expect(summary.regular).toBe(1);
    expect(summary.photos).toBe(verified + likely + unconfirmed);
    expect(summary.doneMs).toEqual({
      n: 2,
      median: profile.summary.doneMs,
      min: profile.summary.doneMs,
      max: profile.summary.doneMs,
    });
    const report = renderReport(results, {
      date: "2026-09-18",
      base: "http://localhost:3000",
      refresh: false,
      startedAt: "2026-09-18 10:00 UTC",
    });
    expect(report).toContain("## Сводка");
    expect(report).toContain(
      "| Исходы | профиль — 2 (из них симуляций сбоя — 1), выбор — 0, не найден — 1, ошибка — 0 |",
    );
  });
});

describe("report date", () => {
  it("dates the report by Astana time, so a night run does not overwrite yesterday's file (#145)", () => {
    expect(reportDate(new Date("2026-09-18T23:30:00Z"))).toBe("2026-09-19");
    expect(reportDate(new Date("2026-09-18T12:00:00Z"))).toBe("2026-09-18");
    expect(startedAtText(new Date("2026-09-18T23:30:00Z"))).toBe("2026-09-18 23:30 UTC (04:30 по Астане)");
  });

  it("never overwrites a report of the same day: the second run gets the time in its name", () => {
    const at = new Date("2026-09-19T04:00:00Z"); // 09:00 in Astana
    const posix = (path: string) => path.split("\\").join("/");
    expect(posix(reportPath(at, () => false))).toBe("docs/qa-report-2026-09-19.md");
    expect(posix(reportPath(at, () => true))).toBe("docs/qa-report-2026-09-19-0900.md");
  });
});
