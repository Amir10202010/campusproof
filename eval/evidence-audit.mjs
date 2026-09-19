#!/usr/bin/env node
/**
 * P3 · evidence audit of a running CampusProof deployment. Node 24, no dependencies.
 *
 *   node eval/evidence-audit.mjs --base https://campusproof.vercel.app
 *   node eval/evidence-audit.mjs --base https://campusproof.vercel.app --sample 40 --out eval/results/2026-09-19.md
 *
 * It answers one question: **are the claims under each photo true?** Points, tiers and provenance are
 * re-derived from what the API returns and checked against the outside world (Wikidata P856, Commons,
 * the image hosts). It reads only saved profiles — no fresh runs, so no free quota is spent.
 *
 * It does NOT judge whether a photo really shows that university: that is #25 and needs human labels.
 * Exit code 1 when an integrity rule is broken.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const UA = "CampusProof-EvidenceAudit/0.1 (LOCUS hackathon 2026; https://github.com/Amir10202010/campusproof)";
/** docs/architecture.md §5.6 — the published tier table, restated here so the audit is independent of the app. */
const TIER_THRESHOLDS = { verified: 60, likely: 35, unconfirmed: 10 };
/** "Verified" needs one of these, not just points (§5.6). */
const STRONG_SIGNALS = new Set([
  "commons_depicts",
  "commons_category",
  "geo_near_campus",
  // Only emitted for a photo of the city itself, and strong there: a city shot geotagged inside the city
  // is as good as it gets for that section (lib/scoring/signals.ts).
  "geo_in_city",
  "wikipedia_use",
  "official_domain",
  "visible_text_this",
]);
/** A render, or a scene that contradicts the context: holds a photo back however good its provenance is. */
const NEGATIVE_SIGNALS = new Set(["render", "visual_inconsistent"]);
/** The team and the deadline live in Astana: a run at 01:00 there must not be filed under the previous UTC day. */
const TEAM_TIMEZONE = "Asia/Almaty";
const teamDate = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TEAM_TIMEZONE });

const args = parseArgs(process.argv.slice(2));
const BASE = (args.base ?? "https://campusproof.vercel.app").replace(/\/$/, "");
const SAMPLE = Number(args.sample ?? 24);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) { out[key] = next; i++; } else out[key] = true;
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
      if (res.status === 404) return null;
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      if (attempt === tries) throw error;
      await sleep(400 * attempt);
    }
  }
}

/** HEAD-like probe: does this URL serve a real image to a browser? */
async function imageLoads(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
    });
    if (!res.ok) return { ok: false, why: `HTTP ${res.status}` };
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!type.startsWith("image/")) return { ok: false, why: `content-type ${type || "unknown"}` };
    const body = await res.arrayBuffer();
    if (body.byteLength < 1024) return { ok: false, why: `only ${body.byteLength} bytes` };
    return { ok: true };
  } catch (error) {
    return { ok: false, why: String(error).slice(0, 60) };
  }
}

const stripWww = (host) => (host.startsWith("www.") ? host.slice(4) : host);
const hostMatches = (host, domain) => host === domain || host.endsWith(`.${domain}`);

/**
 * The academic twin of a Wikidata domain, re-derived here rather than imported: "kbtu.kz" → "kbtu.edu.kz",
 * "kbtu.ac.kz" (#141). Only these second levels, and only in this direction — anyone may register a plain
 * name.CC. The audit counts twin matches separately, so relaxing the rule stays visible in the report.
 */
const ACADEMIC_LEVELS = ["edu", "ac"];
function academicTwins(domain) {
  const [name, countryCode, ...rest] = stripWww(domain.toLowerCase()).split(".");
  if (rest.length > 0 || !name || !/^[a-z]{2}$/.test(countryCode ?? "")) return [];
  return ACADEMIC_LEVELS.map((level) => `${name}.${level}.${countryCode}`);
}

/** Every category a Commons file is filed under. */
async function commonsCategories(title) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  for (const [k, v] of Object.entries({
    action: "query", titles: title, prop: "categories", cllimit: "200", format: "json", formatversion: "2",
  })) url.searchParams.set(k, v);
  const body = await getJson(url.toString());
  const page = body?.query?.pages?.[0];
  return (page?.categories ?? []).map((c) => c.title.replace(/^Category:/, ""));
}

function pick(array, n, seed = 7) {
  // deterministic sample, so re-running the audit reports on the same photos
  const copy = [...array];
  let state = seed;
  const rand = () => ((state = (state * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const index = JSON.parse(readFileSync(join(root, "data", "universities.min.json"), "utf8"));
  const qids = args.qids ? String(args.qids).split(",") : index.map((e) => e.qid);

  process.stderr.write(`Собираю сохранённые профили с ${BASE} (${qids.length} QID)…\n`);
  const profiles = [];
  let shown = -1;
  for (let i = 0; i < qids.length; i += 10) {
    const batch = await Promise.all(qids.slice(i, i + 10).map((qid) =>
      getJson(`${BASE}/api/profile/${qid}`).catch(() => null)));
    for (const p of batch) if (p?.photos) profiles.push(p);
    if (profiles.length !== shown) {
      shown = profiles.length;
      process.stderr.write(`\r  сохранённых профилей: ${shown}   (просмотрено ${Math.min(i + 10, qids.length)} из ${qids.length})`);
    }
  }
  process.stderr.write(`\n`);
  if (profiles.length === 0) throw new Error("ни одного сохранённого профиля — прогрейте кеш или проверьте --base");

  // ── A · scoring integrity: the app must not show a number it cannot back ─────────────────────
  const failures = [];
  let photos = 0;
  const tiers = { verified: 0, likely: 0, unconfirmed: 0 };
  const signals = new Map();
  const perProfile = [];
  for (const p of profiles) {
    const name = p.entity?.name ?? p.entity?.qid;
    perProfile.push({ qid: p.entity?.qid, name, photos: p.photos.length, totalMs: p.timings?.totalMs });
    for (const ph of p.photos) {
      photos++;
      if (ph.tier in tiers) tiers[ph.tier]++; else failures.push(`${name} ${ph.id}: неизвестный уровень «${ph.tier}»`);
      for (const e of ph.evidence ?? []) signals.set(e.signal, (signals.get(e.signal) ?? 0) + 1);

      const sum = (ph.evidence ?? []).reduce((acc, e) => acc + e.points, 0);
      if (sum !== ph.points) failures.push(`${name} ${ph.id}: очки ${ph.points} ≠ сумма доказательств ${sum}`);

      // §5.6 is not a plain threshold: "verified" also needs a strong signal and no render/contradiction.
      // Checking only the points reads a correctly held-back render as a violation.
      const own = new Set((ph.evidence ?? []).map((e) => e.signal));
      const strong = [...own].some((x) => STRONG_SIGNALS.has(x));
      const negative = [...own].some((x) => NEGATIVE_SIGNALS.has(x));
      const canBeVerified = ph.points >= TIER_THRESHOLDS.verified && strong && !negative;

      if (ph.points < TIER_THRESHOLDS.unconfirmed) {
        failures.push(`${name} ${ph.id}: показано ниже порога (${ph.points} очков)`);
      } else if (canBeVerified && ph.tier !== "verified") {
        failures.push(`${name} ${ph.id}: ${ph.points} очков, сильный признак, без render — должно быть verified, а стоит ${ph.tier}`);
      } else if (ph.tier === "verified" && !canBeVerified) {
        const why = ph.points < TIER_THRESHOLDS.verified ? `только ${ph.points} очков` : negative ? "есть render или противоречие сцене" : "нет сильного признака";
        failures.push(`${name} ${ph.id}: уровень verified, но ${why}`);
      } else if (ph.tier === "likely" && ph.points < TIER_THRESHOLDS.likely) {
        failures.push(`${name} ${ph.id}: уровень likely при ${ph.points} очках (порог ${TIER_THRESHOLDS.likely})`);
      } else if (ph.tier === "unconfirmed" && ph.points >= TIER_THRESHOLDS.likely && strong) {
        failures.push(`${name} ${ph.id}: ${ph.points} очков и сильный признак, но уровень unconfirmed`);
      }

      if (!/^https?:\/\//.test(ph.sourcePageUrl ?? "")) failures.push(`${name} ${ph.id}: нет ссылки на источник`);
      if (!ph.retrievedAt) failures.push(`${name} ${ph.id}: нет времени получения`);
      if (!ph.category) failures.push(`${name} ${ph.id}: нет раздела`);
    }
  }

  // ── B · official_domain must be one of the entity's own Wikidata P856 domains ────────────────
  let officialChecked = 0, officialExact = 0, officialTwin = 0;
  const officialBad = [];
  const twinExamples = new Set();
  for (const p of profiles) {
    const domains = (p.entity?.domains ?? []).map((d) => stripWww(d.toLowerCase()));
    for (const ph of p.photos) {
      if (!(ph.evidence ?? []).some((e) => e.signal === "official_domain" || e.signal === "official_domain_weak")) continue;
      officialChecked++;
      const host = stripWww((ph.sourceDomain ?? "").toLowerCase());
      if (domains.some((d) => hostMatches(host, d))) { officialExact++; continue; }
      const twin = domains.flatMap(academicTwins).find((t) => hostMatches(host, t));
      if (twin) {
        officialTwin++;
        twinExamples.add(`${p.entity.name}: ${host} — академический двойник ${JSON.stringify(domains)}`);
        continue;
      }
      officialBad.push(`${p.entity.name}: ${host} ∉ ${JSON.stringify(domains)} и не их академический двойник`);
    }
  }

  // ── C · commons_category must be true on Commons right now (sampled) ─────────────────────────
  const commonsClaims = [];
  for (const p of profiles) {
    const cc = p.entity?.commonsCategory;
    if (!cc) continue;
    for (const ph of p.photos) {
      if (!(ph.evidence ?? []).some((e) => e.signal === "commons_category")) continue;
      const m = /\/wiki\/(File:[^?#]+)/.exec(ph.sourcePageUrl ?? "");
      if (m) commonsClaims.push({ uni: p.entity.name, category: cc, file: decodeURIComponent(m[1]) });
    }
  }
  const commonsSample = pick(commonsClaims, Math.min(SAMPLE, commonsClaims.length));
  let ccDirect = 0, ccSub = 0;
  const ccMiss = [];
  for (const claim of commonsSample) {
    const cats = await commonsCategories(claim.file).catch(() => []);
    if (cats.includes(claim.category)) { ccDirect++; continue; }
    let sub = false;
    for (const c of cats.slice(0, 8)) {
      const parents = await commonsCategories(`Category:${c}`).catch(() => []);
      if (parents.includes(claim.category)) { sub = true; break; }
    }
    if (sub) ccSub++; else ccMiss.push(`${claim.uni}: ${claim.file} вне «${claim.category}»`);
  }

  // ── D · the photos a visitor actually sees must load (sampled) ───────────────────────────────
  const allPhotos = profiles.flatMap((p) => p.photos.map((ph) => ({ uni: p.entity.name, ph })));
  const imgSample = pick(allPhotos, Math.min(SAMPLE * 2, allPhotos.length), 13);
  let imgOk = 0;
  const imgBad = [];
  for (const { uni, ph } of imgSample) {
    const r = await imageLoads(ph.thumbUrl ?? ph.imageUrl);
    if (r.ok) imgOk++; else imgBad.push(`${uni}: ${ph.sourceDomain} — ${r.why}`);
  }

  const withPhotos = perProfile.filter((p) => p.photos > 0).map((p) => p.photos).sort((a, b) => a - b);
  const median = (xs) => (xs.length === 0 ? null : xs.length % 2 ? xs[(xs.length - 1) / 2] : Math.round((xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2));

  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    profiles: profiles.length,
    photos,
    tiers,
    photosPerProfile: { median: median(withPhotos), min: withPhotos[0] ?? null, max: withPhotos.at(-1) ?? null },
    integrity: { checked: photos, failures: failures.length, examples: failures.slice(0, 10) },
    officialDomain: {
      checked: officialChecked,
      verified: officialExact + officialTwin,
      exactWikidataDomain: officialExact,
      academicTwin: officialTwin,
      mismatched: officialBad.length,
      twinExamples: [...twinExamples].slice(0, 5),
      examples: officialBad.slice(0, 5),
    },
    commonsCategory: { claims: commonsClaims.length, sampled: commonsSample.length, direct: ccDirect, inSubcategory: ccSub, notConfirmed: ccMiss.length, examples: ccMiss.slice(0, 5) },
    images: { sampled: imgSample.length, load: imgOk, broken: imgBad.length, examples: imgBad.slice(0, 8) },
    signals: Object.fromEntries([...signals.entries()].sort((a, b) => b[1] - a[1])),
  };

  const date = teamDate(report.generatedAt);
  const md = renderMarkdown(report, date);
  const outMd = args.out ?? join("eval", "results", `${date}-evidence-audit.md`);
  const outJson = outMd.replace(/\.md$/, ".json");
  mkdirSync(dirname(outMd), { recursive: true });
  writeFileSync(outMd, md);
  writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(md);
  process.stderr.write(`\nОтчёт: ${outMd}\n`);
  process.exit(failures.length > 0 || officialBad.length > 0 ? 1 : 0);
}

function renderMarkdown(r, date) {
  const pct = (a, b) => (b === 0 ? "—" : `${((100 * a) / b).toFixed(1)} %`);
  const t = r.tiers;
  const shown = t.verified + t.likely + t.unconfirmed;
  return `# Аудит доказательств — ${date} (время Астаны)

> \`node eval/evidence-audit.mjs --base ${r.base}\` · только сохранённые профили, свежие прогоны не запускались.
> Аудит проверяет, **правда ли то, что написано под фото**: сходятся ли очки с доказательствами, следует ли
> уровень из порога, существуют ли заявленные признаки на самом деле. Он **не** оценивает, действительно ли
> на снимке этот вуз — это #25, и для него нужна ручная разметка.

| Что | Значение |
|---|---|
| Профилей / фото | ${r.profiles} / ${r.photos} |
| Уровни | ✓ ${t.verified} (${pct(t.verified, shown)}) · ◐ ${t.likely} (${pct(t.likely, shown)}) · ? ${t.unconfirmed} (${pct(t.unconfirmed, shown)}) |
| Фото на профиль | медиана ${r.photosPerProfile.median}, от ${r.photosPerProfile.min} до ${r.photosPerProfile.max} |

## 1 · Очки и уровни сходятся с доказательствами

Для каждого фото: сумма очков доказательств равна \`points\`, уровень следует таблице §5.6, есть ссылка на
источник, время получения и раздел. «Проверено» — это не просто ${TIER_THRESHOLDS.verified} очков: нужен ещё сильный
признак и отсутствие render'а или противоречия сцене, поэтому рендер с отличным происхождением честно
остаётся «Вероятно».

**Проверено ${r.integrity.checked} фото · нарушений: ${r.integrity.failures}.**
${r.integrity.examples.map((e) => `- ${e}`).join("\n") || ""}

## 2 · «Официальный сайт» — это правда официальный сайт

Признак \`official_domain\` сверен с доменами вуза из Wikidata (P856) и их академическими двойниками, а не со
списком, написанным руками.

**Проверено ${r.officialDomain.checked} заявок · подтверждено ${r.officialDomain.verified} · расхождений: ${r.officialDomain.mismatched}.**

Из подтверждённых: ${r.officialDomain.exactWikidataDomain} — ровно домен из P856, ${r.officialDomain.academicTwin} — его академический двойник (\`имя.edu.CC\` / \`имя.ac.CC\`, #141). Двойники считаются отдельно: правило мягче P856, и должно быть видно, сколько заявок на нём держится.
${r.officialDomain.twinExamples.map((e) => `- двойник: ${e}`).join("\n") || ""}
${r.officialDomain.examples.map((e) => `- ${e}`).join("\n") || ""}

## 3 · «В категории университета на Commons» — проверено на Commons

Случайная выборка из ${r.commonsCategory.claims} заявок; для каждой запрашиваются категории файла через Commons API.

**Выборка ${r.commonsCategory.sampled} · прямо в категории вуза ${r.commonsCategory.direct} · в подкатегории ${r.commonsCategory.inSubcategory} · не подтвердилось: ${r.commonsCategory.notConfirmed}.**
${r.commonsCategory.examples.map((e) => `- ${e}`).join("\n") || ""}

## 4 · Фото открываются у посетителя

Случайная выборка миниатюр, запрос как из браузера, без Referer.

**Выборка ${r.images.sampled} · открываются ${r.images.load} (${pct(r.images.load, r.images.sampled)}) · битых ${r.images.broken}.**
${r.images.examples.map((e) => `- ${e}`).join("\n") || ""}

## Признаки доказательств в деле

| Признак | Фото |
|---|---|
${Object.entries(r.signals).map(([k, v]) => `| \`${k}\` | ${v} |`).join("\n")}
`;
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
