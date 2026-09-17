#!/usr/bin/env node
/**
 * P4 · #39 · smoke test of a running CampusProof deployment: streams profiles for the judge-simulation matrix
 * (scripts/qa/queries.json), measures timings and checks the honesty rules. Node 24, no dependencies.
 *
 *   node scripts/qa/smoke.mjs --base https://campusproof.vercel.app            # report → docs/qa-report-<date>.md
 *   node scripts/qa/smoke.mjs --base https://campusproof.vercel.app --only ambiguous
 *   node scripts/qa/smoke.mjs --base http://localhost:3000 --replay            # parser check on the fixture replay
 *
 * Without --refresh saved profiles are used (no free quota spent). --refresh forces fresh runs — use consciously.
 * Exit code 1 when any FAIL. FAIL = an honesty rule is broken or the site did not answer; WARN = suspicious data.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TERMINAL = new Set(["done", "error", "ambiguous", "not_found"]);
const TIERS = new Set(["verified", "likely", "unconfirmed"]);
const SIMULATE_FLAG = {
  web_search_down: "web_search_unavailable",
  vision_down: "vision_unavailable",
  wikimedia_down: "wikimedia_unavailable",
};
const FALLBACK_CATEGORIES = ["campus", "dormitory", "classroom", "library", "city", "sports", "lab", "student_life"];

// ─── SSE parsing ───────────────────────────────────────────────────────────────

/** Splits a text buffer into complete SSE blocks (separated by a blank line) and the unfinished rest. */
export function splitSseBuffer(buffer) {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n\n");
  return { blocks: parts.slice(0, -1), rest: parts.at(-1) ?? "" };
}

/** One SSE block → { type, payload } (null for comments/heartbeats). */
export function parseSseBlock(block) {
  let type = "message";
  const data = [];
  for (const line of block.split("\n")) {
    if (line === "" || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") type = value;
    else if (field === "data") data.push(value);
  }
  if (data.length === 0) return null;
  try {
    return { type, payload: JSON.parse(data.join("\n")) };
  } catch {
    return { type, payload: null, parseError: true };
  }
}

/** Streams one profile; stops at the first terminal event or after timeoutMs. */
export async function streamEvents(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  const started = performance.now();
  const events = [];
  try {
    const response = await fetch(url, { headers: { accept: "text/event-stream" }, signal: controller.signal });
    if (!response.ok || !response.body) return { events, error: `HTTP ${response.status}` };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const { blocks, rest } = splitSseBuffer(buffer + decoder.decode(value, { stream: true }));
      buffer = rest;
      for (const block of blocks) {
        const event = parseSseBlock(block);
        if (!event) continue;
        events.push({ ...event, t: performance.now() - started });
        if (TERMINAL.has(event.type)) {
          controller.abort();
          return { events };
        }
      }
    }
    return { events, error: "stream ended without a terminal event" };
  } catch (error) {
    if (events.some((e) => TERMINAL.has(e.type))) return { events };
    return {
      events,
      error: controller.signal.aborted ? `timeout ${timeoutMs / 1000} s` : String(error?.message ?? error),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Checks ────────────────────────────────────────────────────────────────────

export function categoryIds(root = ROOT) {
  try {
    const source = readFileSync(join(root, "lib/config/categories.ts"), "utf8");
    const ids = [...source.matchAll(/^\s+id: "([a-z_]+)",$/gm)].map((match) => match[1]);
    return ids.length >= FALLBACK_CATEGORIES.length ? ids : FALLBACK_CATEGORIES;
  } catch {
    return FALLBACK_CATEGORIES;
  }
}

/** Same rule as lib/pipeline/coverage.ts: good ≥ 3 verified+likely, thin ≥ 1, none 0. */
export function coverageFromPhotos(photos, ids) {
  const coverage = Object.fromEntries(
    ids.map((id) => [id, { verified: 0, likely: 0, unconfirmed: 0, status: "none" }]),
  );
  for (const photo of photos)
    if (coverage[photo.category] && TIERS.has(photo.tier)) coverage[photo.category][photo.tier] += 1;
  for (const entry of Object.values(coverage)) {
    const shown = entry.verified + entry.likely;
    entry.status = shown >= 3 ? "good" : shown >= 1 ? "thin" : "none";
  }
  return coverage;
}

/**
 * Honesty rules for one finished profile (issue #39).
 * @param {any} profile
 * @param {{ simulate?: string, ids: string[] }} options
 */
export function checkProfile(profile, { simulate, ids }) {
  const fails = [];
  const warns = [];
  const photos = Array.isArray(profile?.photos) ? profile.photos : [];
  for (const photo of photos) {
    const name = photo.id ?? photo.imageUrl ?? "?";
    if (!/^https?:\/\//i.test(photo.sourcePageUrl ?? "")) fails.push(`фото ${name}: sourcePageUrl не http(s)`);
    if (!photo.retrievedAt || Number.isNaN(Date.parse(photo.retrievedAt))) fails.push(`фото ${name}: нет retrievedAt`);
    if (!TIERS.has(photo.tier)) fails.push(`фото ${name}: недопустимый уровень «${photo.tier}»`);
    if (!ids.includes(photo.category)) fails.push(`фото ${name}: неизвестная категория «${photo.category}»`);
    const sum = (photo.evidence ?? []).reduce((acc, e) => acc + (Number(e.points) || 0), 0);
    if (sum !== photo.points) warns.push(`фото ${name}: очки ${photo.points} ≠ сумме доказательств ${sum}`);
  }
  const expected = coverageFromPhotos(photos, ids);
  for (const id of ids) {
    const actual = profile?.coverage?.[id];
    const want = expected[id];
    if (
      !actual ||
      actual.verified !== want.verified ||
      actual.likely !== want.likely ||
      actual.unconfirmed !== want.unconfirmed ||
      actual.status !== want.status
    ) {
      fails.push(`покрытие «${id}» не совпадает с фото: ${JSON.stringify(actual)} ≠ ${JSON.stringify(want)}`);
    }
  }
  if (simulate) {
    for (const mode of simulate.split(",")) {
      const flag = SIMULATE_FLAG[mode];
      if (flag && !(profile?.degraded ?? []).includes(flag)) fails.push(`simulate=${mode}: в degraded нет ${flag}`);
    }
  }
  return { fails, warns };
}

/** Timings and counts from a stream (ms since the request started). */
export function summarize(events) {
  const first = (type) => events.find((e) => e.type === type);
  const terminal = events.find((e) => TERMINAL.has(e.type));
  const done = terminal?.type === "done" ? terminal.payload : null;
  const photos =
    done?.profile?.photos ?? events.filter((e) => e.type === "photos").flatMap((e) => e.payload?.photos ?? []);
  const tiers = { verified: 0, likely: 0, unconfirmed: 0 };
  for (const photo of photos) if (TIERS.has(photo.tier)) tiers[photo.tier] += 1;
  return {
    terminal: terminal?.type ?? null,
    entity: first("resolved")?.payload?.entity ?? done?.profile?.entity ?? null,
    resolvedMs: first("resolved")?.t,
    firstPhotosMs: first("photos")?.t,
    doneMs: terminal?.type === "done" ? terminal.t : undefined,
    tiers,
    sources: (done?.profile?.sources ?? events.filter((e) => e.type === "source").map((e) => e.payload?.status)).filter(
      Boolean,
    ),
    degraded: done?.profile?.degraded ?? [],
    cached: done?.cached ?? null,
    candidates: terminal?.type === "ambiguous" ? (terminal.payload?.candidates?.length ?? 0) : undefined,
    suggestions: terminal?.type === "not_found" ? (terminal.payload?.suggestions?.length ?? 0) : undefined,
    errorCode: terminal?.type === "error" ? terminal.payload?.code : undefined,
    profile: done?.profile ?? null,
  };
}

/** Verdict for one query: FAIL (honesty or no answer), WARN (unexpected outcome / data), SKIP (rate limit), PASS. */
export function evaluate({ query, expect }, run, ids) {
  const summary = summarize(run.events);
  const fails = [];
  const warns = [];
  if (run.error && !summary.terminal) fails.push(`нет ответа: ${run.error}`);
  if (summary.terminal === "error" && summary.errorCode === "rate_limited") {
    return { summary, status: "SKIP", fails, warns: [`лимит новых проверок (rate_limited)`] };
  }
  if (summary.terminal === "error") fails.push(`ошибка ${summary.errorCode ?? "?"}`);
  if (summary.profile) {
    const checks = checkProfile(summary.profile, { simulate: query.simulate, ids });
    fails.push(...checks.fails);
    warns.push(...checks.warns);
  }
  const outcome = summary.terminal === "done" ? "profile" : summary.terminal;
  if (outcome && outcome !== "error" && !expect.includes(outcome))
    warns.push(`ожидали ${expect.join(" / ")}, получили ${outcome}`);
  return { summary, status: fails.length > 0 ? "FAIL" : warns.length > 0 ? "WARN" : "PASS", fails, warns };
}

// ─── Report ────────────────────────────────────────────────────────────────────

const seconds = (ms) => (ms === undefined ? "—" : `${(ms / 1000).toFixed(1).replace(".", ",")} с`);
const cell = (text) => String(text).replace(/\|/g, "\\|").replace(/\n/g, " ");
const ICON = { PASS: "✅", WARN: "⚠️", FAIL: "❌", SKIP: "⏭️" };

export function renderReport(results, meta) {
  const count = (status) => results.filter((r) => r.status === status).length;
  const lines = [
    `# QA-отчёт: smoke-тест — ${meta.date}`,
    "",
    `> Сгенерирован \`node scripts/qa/smoke.mjs\` (P4 · #39). База: ${meta.base} · refresh: ${meta.refresh ? "да" : "нет (сохранённые профили)"} · запросов: ${results.length} · начало: ${meta.startedAt}.`,
    "",
    `**Итог:** ✅ ${count("PASS")} · ⚠️ ${count("WARN")} · ❌ ${count("FAIL")} · ⏭️ ${count("SKIP")}`,
    "",
    "| Группа | Запрос | Итог | resolved | первые фото | done | Фото ✓ / ◐ / ? | Источники | Деградация | Кеш | Статус |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const r of results) {
    const s = r.summary;
    const outcome =
      s.terminal === "ambiguous"
        ? `выбор (${s.candidates})`
        : s.terminal === "not_found"
          ? `не найден (подсказок: ${s.suggestions})`
          : s.terminal === "done"
            ? `профиль: ${s.entity ? `${s.entity.name} (${s.entity.qid})` : "?"}`
            : (s.terminal ?? r.error ?? "—");
    const sources = s.sources.map((src) => `${src.source}:${src.status}(${src.candidates})`).join(", ") || "—";
    const label = r.query.simulate ? `${r.query.q} · simulate=${r.query.simulate}` : r.query.q;
    lines.push(
      `| ${cell(r.group)} | ${cell(label)} | ${cell(outcome)} | ${seconds(s.resolvedMs)} | ${seconds(s.firstPhotosMs)} | ${seconds(s.doneMs)} | ${s.tiers.verified} / ${s.tiers.likely} / ${s.tiers.unconfirmed} | ${cell(sources)} | ${cell(s.degraded.join(", ") || "—")} | ${s.cached === null ? "—" : s.cached ? "да" : "нет"} | ${ICON[r.status]} ${r.status} |`,
    );
  }
  const problems = results.filter((r) => r.fails.length > 0 || r.warns.length > 0);
  lines.push("", "## Нарушения и предупреждения", "");
  if (problems.length === 0) lines.push("Нет.");
  for (const r of problems) {
    for (const fail of r.fails) lines.push(`- ❌ **${cell(r.query.q)}** — ${cell(fail)}`);
    for (const warn of r.warns) lines.push(`- ⚠️ **${cell(r.query.q)}** — ${cell(warn)}`);
  }
  lines.push("");
  return lines.join("\n");
}

// ─── CLI ───────────────────────────────────────────────────────────────────────

export function parseArgs(argv) {
  const args = {
    base: "http://localhost:3000",
    refresh: false,
    only: null,
    out: null,
    replay: false,
    timeout: 45_000,
    delay: 1_500,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--base") args.base = argv[++i].replace(/\/$/, "");
    else if (arg === "--refresh") args.refresh = true;
    else if (arg === "--only") args.only = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--replay") args.replay = true;
    else if (arg === "--timeout") args.timeout = Number(argv[++i]) * 1000;
    else if (arg === "--delay") args.delay = Number(argv[++i]) * 1000;
    else throw new Error(`Неизвестный аргумент: ${arg}`);
  }
  return args;
}

export function streamUrl(base, query, refresh) {
  const params = new URLSearchParams({ q: query.q });
  if (refresh) params.set("refresh", "1");
  if (query.simulate) params.set("simulate", query.simulate);
  return `${base}/api/profile/stream?${params}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ids = categoryIds();
  const plan = args.replay
    ? [
        {
          group: "replay",
          query: { q: "fixture replay" },
          expect: ["profile"],
          url: `${args.base}/api/dev/replay?speed=4`,
        },
      ]
    : JSON.parse(readFileSync(join(ROOT, "scripts/qa/queries.json"), "utf8"))
        .groups.filter((group) => !args.only || group.id === args.only)
        .flatMap((group) =>
          group.queries.map((raw) => {
            const query = typeof raw === "string" ? { q: raw } : raw;
            return { group: group.title, query, expect: group.expect, url: streamUrl(args.base, query, args.refresh) };
          }),
        );
  if (plan.length === 0) throw new Error(`Нет запросов${args.only ? ` в группе «${args.only}»` : ""}`);

  const startedAt = new Date();
  const results = [];
  for (const [index, item] of plan.entries()) {
    const run = await streamEvents(item.url, args.timeout);
    const verdict = evaluate(item, run, ids);
    results.push({ ...item, ...verdict, error: run.error });
    console.error(
      `${ICON[verdict.status]} ${item.query.q}${item.query.simulate ? ` (${item.query.simulate})` : ""} — ${verdict.summary.terminal ?? run.error}`,
    );
    if (index < plan.length - 1 && !args.replay) await new Promise((resolve) => setTimeout(resolve, args.delay));
  }

  const date = startedAt.toISOString().slice(0, 10);
  const report = renderReport(results, {
    date,
    base: args.base,
    refresh: args.refresh,
    startedAt: startedAt.toISOString().replace("T", " ").slice(0, 16) + " UTC",
  });
  const out = args.out ?? (args.replay ? "-" : join("docs", `qa-report-${date}.md`));
  if (out === "-") process.stdout.write(report);
  else {
    writeFileSync(join(ROOT, out), report);
    console.error(`Отчёт: ${out}`);
  }
  process.exitCode = results.some((r) => r.status === "FAIL") ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 2;
  });
}
