# CampusProof — pitch deck (English, 8 slides)

Text of every slide in [CampusProof-pitch-EN.pdf](CampusProof-pitch-EN.pdf); the editable source is [index.html](index.html).

- **Rebuild:** `node scripts/qa/slides.mjs pdf --deck en`. To check the layout: `node scripts/qa/slides.mjs preview --deck en`. To refresh the screenshots from production: `node scripts/qa/slides.mjs shots-en`.
- **Numbers:** only measured ones, with sample and date, from [docs/qa-report-2026-09-19.md](../../qa-report-2026-09-19.md) (smoke test on production) and [eval/results/2026-09-19-evidence-audit.md](../../../eval/results/2026-09-19-evidence-audit.md). Cold-run times (9–20 s) were measured on 8 universities on 19 Sep 2026.
- **Screenshots:** real production runs from 19 Sep 2026. The UI is in Russian because the product is built for Kazakhstan and Central Asia.
- **To fill in before sending:** team names on slide 7 (`[Name]`), plus the fourth card: fill it in or delete it.

---

## 1 · The problem

**CampusProof.** Real university photos — each with a source, a date and a trust level.

Applicants pick universities they **can't visit**. Official sites show polished marketing, and real photos are scattered, duplicated, outdated, or show another place. Image search never says **which photo to trust**.

**Who has this problem:** applicants aged 16–19 in Kazakhstan and Central Asia · parents · admissions advisors.

**Three questions image search can't answer:** Where is this photo from? When was it taken? Is it really this university?

**Fact: 27 %** of the most promising open-source images we examined were rejected: duplicates, logos and documents, tiny files, portraits, another institution's name. That is 137 of 513, across 14 universities.
*Source: saved production profiles, 19 Sep 2026.*

## 2 · Our solution

**Type a university — get a verified visual profile.** Proof, not pictures: an honest “not found” beats someone else's photo.

The flow:
1. **Problem:** unverifiable, scattered campus photos.
2. **CampusProof:** an evidence pipeline over open data, web search and AI.
3. **User action:** type a name. Typos are fine.
4. **Result:** campus, dorms, classrooms, libraries and city, sorted and checked.

**Screenshot:** KBTU dormitories on production. The photos come from the university's own site, and each has a source, a date and a trust tier.

**Key features:**
- Smart search: handles typos, acronyms and Cyrillic, and shows a pick-list if the query is ambiguous.
- Every photo has a clickable source, a typed date and a license.
- The trust tier is computed from recorded evidence.
- Honest gaps, plus a list of what was filtered out and why.

**Trust tiers:** ✓ Verified · ◐ Likely · ? Unconfirmed (hidden by default).

## 3 · Demo: a real production run

**From a name to proof in seconds.** A fresh run for KBTU on campusproof.vercel.app, 19 Sep 2026.

1. **Type a name (input).** “КБТУ”, “MSU” and even “Nazarbaev Univercity” all work.
2. **Live pipeline (process).** 135 candidates from Commons, web search and Openverse → 36 checked → 31 photos, 5 rejected. Built in 1.9 s (sources cached).
3. **Evidence decides (AI + rules).** Gemini describes the image, then code scores the evidence: 100 points → ✓ Verified.
4. **Verified profile (output).** 8 sections, 4 filters, a map and a compare view. Every photo is one click from its source.

**Result:** 31 photos, each with a source, a date and a trust tier. A saved profile reopens in about 0.4 s.

## 4 · Technology

**AI observes. Code decides.** A streaming pipeline on free and open APIs, with a timeout on every stage.

- **Product layer:**
  - browser on any device; no accounts, and IP addresses are only stored hashed, for rate limits;
  - Next.js 16 · React 19: UI and API routes on Vercel (Node.js 24);
  - Server-Sent Events: stages and photos stream as they're ready;
  - Tailwind 4 · shadcn/ui: accessible UI with dark mode, plus a Leaflet + OpenStreetMap map.
- **Pipeline** (TypeScript, one code path for every university):
  1. **Resolve:** a local index of 1,041 universities plus live Wikidata search.
  2. **Gather:** Wikimedia Commons and Wikipedia, Serper, Openverse, in parallel.
  3. **Download:** SSRF-safe fetch, sharp resize, EXIF geotags.
  4. **Deduplicate:** perceptual hash (dHash) plus a same-scene check.
  5. **Observe (Gemini):** image type, visible text and category, returned as JSON checked by zod.
  6. **Score (rules):** points per piece of evidence → tier. Deterministic and tested.
  7. **Describe (Gemini):** 3–5 sentences from the sources only, each one cited.
  8. **Assemble:** coverage per section and the filtered-out list.
- **Data and quality:**
  - Upstash Redis: a 14-day profile cache, cached source and model answers, rate limits;
  - guardrails: a 27 s deadline, per-source timeouts, simulated outages via `?simulate=`;
  - 291 automated tests (vitest), with CI gating every pull request;
  - production audits: the smoke test and an evidence audit of 1,105 photos.
- **Principles:** AI never assigns scores or tiers · no identifying people · only official APIs and open data, no scraping · no special cases for particular universities.

## 5 · Why this approach

**Image search shows pictures. We show proof.** The same questions, answered on every single photo.

| Question | Image search / official site | CampusProof |
|---|---|---|
| Where is it from? | A thumbnail, provenance unknown | Clickable source page, license, author |
| When was it taken? | Undated, or a date of unknown meaning | A typed date: taken, uploaded or published |
| Is it this university? | A guess by the viewer | A trust tier from evidence, with every point visible |
| Noise | Duplicates, stock, renders, other places | Removed before display, with the reason shown |
| Missing data | Filled with anything that looks close | An honest empty section: “couldn't confirm” |
| Marketing vs reality | Only what the university chose to show | Official and independent sources side by side |

**Real catch in the KBTU profile:** photos with “Amanat party office” and “Kazpatent” signs were flagged by the visual check and moved to “Filtered out”. The user can see why.

## 6 · Impact, measured on production

**Trust you can audit — already working.** All numbers were measured on production, with sample size and date. Targets are labeled as targets.

**Measured on 19 Sep 2026:**
- **27 / 27** smoke-test queries passed (typos, ambiguous queries, garbage input, outages).
- **2.6 s** median time to a finished profile, with sources cached. Cold runs take 9–20 s.
- **0** mismatches between score and evidence in 1,105 photos across 42 profiles.
- **365 / 365** “official site” claims confirmed against Wikidata.
- **Trust tiers** of those 1,105 photos: ✓ Verified 30.1 % · ◐ Likely 53.9 % · ? Unconfirmed 15.9 %.

**Value:**
- **For applicants and parents:** see real dorms, classrooms and campus before applying, and know which photo to trust.
- **For advisors and platforms:** shareable profiles linked to their sources. A JSON profile endpoint already exists for integration.
- **For the industry:** a transparency standard for visual claims, built on open data with authors and licenses credited.

**Next KPIs (targets, not yet measured):** “Verified” precision on a labeled test set ≥ 90 % · category accuracy ≥ 85 % · p50/p90 cold latency · user reports per 1,000 photos.

## 7 · Team

**Built in 72 hours, in parallel lanes.** LOCUS Startup Hackathon 2026 · Case 01 “Visual University Profile”.

| Name | Role | Contribution |
|---|---|---|
| Amirkhan Sagyndyk (github.com/Amir10202010) | Pipeline & Verification | Streaming pipeline, resolver, sources, Gemini integration, scoring rules, cache and rate limits |
| `[Name]` (github.com/aldiyaraizhigitov) | Product & UI | Profile interface: evidence dialog, filters, map, compare, error states; QA smoke tests, README, pitch |
| `[Name]` (github.com/Chelovek12346) | Data | University index built from Wikidata SPARQL: 1,041 universities with names, aliases and domains |
| `[Name]` | `[Role]` | Fourth team member: fill in or remove |

**How we worked:**
- **Contract-first:** typed interfaces and a working skeleton from hour one.
- **291 tests:** every change went in as a small pull request, merged only with green CI.
- **Open by default:** public repository, with AI coding-assistant use disclosed in the README.

## 8 · Roadmap

**From a working MVP to a trust layer for campus media.**

- **Now (live): a working MVP.**
  - Search that handles typos and acronyms, with a pick-list.
  - 8 sections, 4 filters, trust tiers with evidence.
  - Filtered-out list, map, compare view, saved profiles.
  - Graceful degradation, tested on production.
- **Next (planned): prove accuracy.**
  - A labeled test set and a public accuracy page.
  - A reuse detector: the same image on a stock site or at another university.
  - User reports on photos as a scoring signal.
  - More local sources for Kazakhstan and Central Asia.
- **Future (to explore): scale the trust layer.**
  - A profile API for admissions advisors and education platforms.
  - Kazakh and English interfaces.
  - More countries and university systems.
  - A campus tour built from geotagged photos.

**Path:** MVP (now) → pilot with admissions advisors → applicants → platform integrations → new regions. These are plans; no dates are committed.

**From campus photos you have to take on faith — to proof you can check in one click.**

Try it: campusproof.vercel.app · Code: github.com/Amir10202010/campusproof
