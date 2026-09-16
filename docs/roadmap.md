# Roadmap — 72-hour plan for Case 01

> **Internal team document · LOCUS Startup Hackathon 2026 · written Wed 16 Sep 2026, 20:30 Astana time (UTC+5)**
> Strategy pack: [case-analysis](case-analysis.md) · [product-strategy](product-strategy.md) · [architecture](architecture.md) · **roadmap**
>
> All times are **Astana time**. This plan works for any direction (A/B/C). Direction-specific work is marked, and the ceiling is decided at checkpoints ([product-strategy §7](product-strategy.md#7-how-to-choose)).

---

## 0. TL;DR and tonight's checklist

- **Deadline: Sat 19 Sep 12:00.** Submit by 10:30. Code freeze Sat 09:00. **Feature freeze Fri 19:00.**
- **Checkpoints:**
  - **CP0** Thu 00:30: spike results
  - **CP1** Thu 13:00: real data on the deployed URL
  - **CP2** Thu 18:00: MVP gate
  - **CP3** Fri 14:00: final feature list
- **Build order:** deploy + contracts → resolver → sources → fetch/dedup → vision + scoring → streaming UI → trust layers → polish.
- **One person (P4) owns deliverables from day one:** README, slides, video, submission. A missing artifact means non-admission.

**Tonight (Wed 16 Sep), in this order:**

- [ ] 20:30 Everyone reads: case-analysis §0, product-strategy §0 and §6, this section and §4 (20 min)
- [ ] Assign roles P1–P4 (§1). Confirm **who is the registered captain** (only the captain can submit)
- [ ] Be honest about availability on Thu/Fri (school/university) → pick the capacity scenario (§2)
- [ ] Decide the UI language. Recommendation: **Russian**, with the case's exact category/filter labels; no i18n
- [ ] Identify an **adult account holder** for paid APIs; create accounts and **set spend limits**: Anthropic Console, Serper (no card) or Brave (card), Upstash, Vercel, GitHub
- [ ] `git init`, GitHub repo, Next.js scaffold, **first deploy to Vercel `fra1` before midnight**. Keep the organizer PDFs out of the repo (e.g., `*.pdf` in `.gitignore`)
- [ ] Post the organizer questions ([case-analysis §10](case-analysis.md#10-questions-to-ask-the-organizers-official-qa-only)) in the official LOCUS Hackathons Q&A
- [ ] Draft `lib/types.ts` v1 + one fixture profile JSON (P1 + P3)
- [ ] Run spikes S1–S5 ([architecture §16](architecture.md#16-day-0-spikes)) and record the results
- [ ] **00:30 CP0**: choose vision model, search provider, provisional ceiling; freeze `types.ts` v1
- [ ] **Sleep by 01:00.** Sleep-deprived teams ship bugs on the last night

---

## 1. Team roles

| Role | Owns | Also responsible for |
|---|---|---|
| **P1: Pipeline lead (backend + integration)** | Repo/deploy/CI, `types.ts`, resolver + index, Wikidata/Wikipedia/Commons adapters, orchestrator + SSE, deadlines, cache, rate limits, degraded modes, geo | **Integration owner**: merges to `main`, keeps production green; post-deadline freeze |
| **P2: Verification / AI** | Web search adapter + query plan + domain classes, safe fetch + hashing + dedup, vision prompt/schema/batching, scoring + tiers + unit tests, reuse detector (B), eval + bench scripts | Runs the vision spike; owns accuracy numbers |
| **P3: Frontend / design** | Design tokens, all screens and states (home, pick-list, profile, cards, evidence dialog, coverage, degraded banners, filtered-out tray, map in B), mobile, How-it-works page UI | Demo UI polish; screenshots for slides |
| **P4: Product / QA / story** | Test matrix + QA passes, labeled eval set, domain lists and category copy (RU), How-it-works text, README + technical reference, slides, demo video, submission, organizer Q&A, spend monitoring | **Timekeeper**: runs the checkpoints and enforces the cut lines |

**Working agreements:**
- Short feature branches → PR → merge to `main` at least every few hours. Everyone commits from **their own GitHub account**; the organizers may inspect history.
- **Contracts first:** UI builds against fixture JSON until the live API is ready. Nobody changes `types.ts` without telling P1 and P3.
- **15-minute syncs** at every checkpoint: done / blocked / cut.
- Log every pre-built component, library, API, and AI tool in a running README section as you add it.

---

## 2. Capacity reality check

| Scenario | Hours/person (Wed 20:30 → Sat 12:00, minus ~7 h sleep/night and meals) | Team gross | Minus deliverables (~15 h) and ~20% coordination/integration overhead | **Effective build capacity** |
|---|---|---|---|---|
| Everyone full-time | ~35 h | ~140 h | 125 h × 0.8 | **~100 h** |
| Two members have classes Thu+Fri | ~35 / ~21 h | ~112 h | 97 h × 0.8 | **~78 h** |
| All four have classes Thu+Fri | ~21 h | ~84 h | 69 h × 0.8 | **~55 h** |

**Estimated build effort** (realistic, assuming AI coding assistants are used; optimistic values are ~30% lower):

| Direction | Build hours | Fits a full-time team? | Fits with classes? |
|---|---|---|---|
| A: Verified Gallery | ~65–95 h | Yes, with buffer | A-minimum only |
| B: Proof, Not Pictures | ~95–125 h | Tight; only with strict cuts (no compare/flags) | No |
| C: Campus Reality Check | ~150–190 h | No | No |

**A work breakdown** (realistic hours; B and C add-ons are in §5):

| Module | Hours |
|---|---|
| Setup: repo, Next.js, Tailwind/shadcn, Vercel `fra1`, env, Redis, CI | 4 |
| Contracts + fixtures | 2 |
| University index script + fuzzy resolver + Wikidata fallback | 7 |
| Resolver UI: search, pick-list, not-found | 4 |
| Wikidata / Wikipedia adapters + facts | 3 |
| Commons adapter | 6 |
| Web image search adapter + query plan + domain classes | 5 |
| Safe fetch, canonicalize, resize, dHash, dedup | 6 |
| Vision observations: prompt, schema, batching, retry | 7 |
| Scoring + tiers + unit tests | 5 |
| Orchestrator + deadlines + SSE | 7 |
| Profile UI: header, category sections, filters, cards | 10 |
| Evidence dialog (basic) + coverage and degraded states | 5 |
| Description with citations | 3 |
| Cache + badge + rate limit + budget guard | 4 |
| How-it-works page | 2 |
| Integration, QA, bug-fix reserve | 12 |
| **Total** | **~93 h** |

**A-minimum (~55 h)**, for a team that mostly has classes:
- **Resolver:** Wikidata search + small alias file (no full index).
- **Kept:** Commons + web search; dHash dedup; vision observations; tiers; streaming with a timer; profile page with categories, filters, and cards; evidence as a tooltip list; coverage states; Wikipedia-extract description; cache badge.
- **Cut:** How-it-works becomes a README section linked from the footer; provider spend caps replace custom rate limiting.

---

## 3. Build order

**Principles:**
1. **Deploy first.** A "hello world" on Vercel within 2 hours proves the pipeline to production works.
2. **Contracts before code.** `types.ts` and a fixture JSON let three people work in parallel from hour one.
3. **Thin vertical slice.** Get one university end-to-end, ugly, then widen.
4. **Verification before volume.** Don't add sources until scoring and tiers work.
5. **Honest states early.** Empty, partial, and error states are built with the happy path, not at the end.
6. **Measure from day one.** Stage timings go into the logs from the first orchestrator commit.
7. **Every checkpoint leaves a shippable `main`.**
8. **Deliverables start before the feature freeze,** not after.

**Sequence** (✱ = MVP / Direction A is done at step 10):

1. Scaffold + deploy + env + `types.ts` + fixtures
2. Resolver (index + Wikidata fallback) + search UI + pick-list + not-found
3. Wikidata / Wikipedia / Commons adapters → candidates
4. Safe fetch + canonicalize + dHash + L1/L2 dedup
5. Vision observations + scoring + tiers (+ unit tests)
6. Orchestrator with deadlines + SSE + profile UI wired live
7. Web image search adapter (KZ/RU/EN, official-domain queries)
8. Description with citations + facts + geo distance
9. Coverage, degraded, and error states + cache + badge + rate limit
10. Evidence dialog (basic) + How-it-works ✱
11. *(B)* Filtered-out tray + pipeline rail + source chips + `simulate` switch
12. *(B)* Reuse detector + official/independent lens
13. *(B)* Map with photo pins
14. *(B)* Eval set + benchmark page
15. Polish + mobile + performance pass
16. *(B stretch)* Compare mode → community flags

---

## 4. Timeline

> **If members have classes on Thu/Fri:** move their blocks to 15:00–23:30 and shift CP1 → 17:00 and CP2 → 22:00. Don't move the Fri 19:00 feature freeze or the Sat deadlines.

### Phase 0 — Wed 16 Sep, 20:30 → 01:00: decide, set up, spike

| Time | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| 20:30–21:00 | All: read docs, assign roles, availability, UI language, accounts owner | ← | ← | ← |
| 21:00–22:30 | GitHub repo, Next.js + TS + Tailwind + shadcn, Vercel `fra1` deploy, Upstash, env plumbing | Collect 40 spike images from real searches (all categories + traps); Serper key; Commons yield spike (S2) | Wireframes of 4 screens (home, pick-list, profile with progress, evidence dialog); design tokens incl. tier icons and colors | Accounts + spend limits; organizer Q&A post; 40-query judge matrix draft (§9); domain lists v0; RU category labels and definitions |
| 22:30–00:30 | Resolver spike (S1); SSE + sharp streaming spike on Vercel (S5); `types.ts` v1 draft with P3 | Vision model spike (S4): accuracy, latency, cost across candidate models | Static profile page against fixture JSON; responsive grid | Web search yield spike (S3) for 5 Kazakh universities × 4 categories × RU/EN; label the 40 spike images with P2 |
| **00:30 CP0** | **Decide:** vision model, search provider, provisional ceiling (A / B), `types.ts` v1 frozen. **Sleep.** | ← | ← | ← |

### Phase 1 — Thu 17 Sep, 09:00 → 18:00: walking skeleton → MVP pipeline

| Time | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| 09:00–13:00 | Index build script (Kazakhstan, Central Asia, popular worldwide) + fuzzy resolver + `/api/resolve`; orchestrator skeleton returning JSON; Wikidata entity + Wikipedia adapters | Commons adapter (category tree, depicts, geosearch, metadata parsing); safe fetch + canonicalize + sharp + dHash + dedup; unit tests | Search page, pick-list, not-found wired to `/api/resolve`; profile skeleton with category sections, 4 filters, photo cards (from fixtures) | Domain lists v1; How-it-works copy draft; README skeleton with all required sections; QA sheet from the matrix |
| **13:00 CP1** | **Gate:** the deployed URL resolves a Kazakh university and returns real Commons candidates. **If not:** ceiling → A; P1+P2 pair on blockers; P3 continues on fixtures | ← | ← | ← |
| 13:30–18:00 | SSE orchestrator with per-source timeouts + global deadline; profile cache; wire streaming to UI with P3 | Vision observations module (batching, schema validation, retry); scoring v1 + tiers + tests; web search adapter with query plan and domain classes | Streaming UI: timer, incremental photos, stage progress; evidence dialog (basic); coverage and empty states | QA on preview deploys; bug list; begin eval labeling from real pipeline candidates |
| **18:00 CP2** | **MVP gate:** 10 test universities end-to-end on production, p50 <30 s, no crash on tricky queries. **If not:** no B layers, evening = stability and speed | ← | ← | ← |

### Phase 1b — Thu 17 Sep, 18:30 → 23:30: make it trustworthy

| P1 | P2 | P3 | P4 |
|---|---|---|---|
| Description with citations + facts; geo distance; degraded modes + `simulate` switch; rate limit + budget guard | Tune thresholds on the first labels; fix the top false positives; *(B)* reuse detector | Cache badge + live refresh; degraded banners; mobile layout; *(B)* filtered-out tray | Finish the labeled set (tune/test split); How-it-works final text; slide outline; shortlist demo universities from **real** outputs |

23:30: 10-minute sync, then sleep.

### Phase 2 — Fri 18 Sep, 09:00 → 19:00: differentiators and polish

| Time | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| 09:00–14:00 | Performance pass (bench script, parallelism, timeouts); `/api/health`; *(B)* map data API (campus/city coordinates, geotagged photos) | `npm run eval` + metrics; *(B)* official/independent lens classification; in-batch near-duplicate flags wired into dedup | Evidence dialog full; *(B)* map view with pins; *(B)* lens toggle and badges; *(B)* pipeline rail + source chips | Bug bash #1 on the full matrix; README v1 (architecture + technical reference from docs); rough walkthrough recording to find UX confusion |
| **14:00 CP3** | **Final feature list.** Anything not working by 17:00 gets cut (§6). Stretch items (compare) only if all green | ← | ← | ← |
| 14:00–19:00 | Fix list; logging and pipelineVersion; post-deadline freeze prep | Eval on the test split → results JSON; tune on the tune split only | *(B)* `/benchmark` page; visual polish; states review; mobile QA | Slides v1 (≤8); video script final; bug bash #2 |
| **19:00** | **FEATURE FREEZE.** Only bug fixes, copy, performance, deliverables from here | ← | ← | ← |

### Phase 3 — Fri 18 Sep, 19:00 → 00:30: stabilize and record

| P1 + P2 | P3 | P4 |
|---|---|---|
| Fix S1/S2 bugs from the bug bashes; 20 cold runs for latency numbers; verify degraded modes on production | Final UI polish; screenshots for slides | **Record demo video take 1 from production** (real time); README v2 incl. judge test scenario, sources, AI/APIs, pre-built components, security, limitations, benchmark numbers |

00:30: team reviews the video, lists reshoots, then sleep.

### Phase 4 — Sat 19 Sep, 07:30 → 12:00: ship

| Time | Task | Owner |
|---|---|---|
| 07:30–09:00 | Critical fixes only; final video; slides → PDF; README final | P1/P2 fixes, P3+P4 deliverables |
| **09:00** | **Code freeze.** Tag `v1.0-submission`; production = tag; smoke test in incognito + on a phone; repo accessible; secrets scan | P1 |
| 09:30–10:30 | **Captain submits on aistartify.com** with `LOCUSCASE1`: product URL, GitHub, video link, slides PDF, README, project card. Screenshot the confirmation | Captain + P4 |
| 10:30–12:00 | Buffer for submission issues. **Nobody pushes to `main`.** | All |

---

## 5. Direction tracks

What each direction does with the shared timeline:

| Phase | A: Verified Gallery | B: Proof, Not Pictures | C: Campus Reality Check |
|---|---|---|---|
| Phase 0–1 (to CP2) | Identical | Identical | Identical |
| Phase 1b (Thu evening) | Description, geo distance, degraded modes, cache badge, evidence basic, How-it-works | + reuse detector, filtered-out tray | Same as B, but must finish by 21:00 |
| Phase 2 morning (Fri) | Performance, states, mobile, README table from eval | + map, lens, rail + source chips, full evidence | + clustering prototype for virtual walk |
| Phase 2 afternoon (Fri) | Extra QA rounds; rehearsal; optional filtered-out tray | + benchmark page; *(stretch)* compare | + grounded Q&A; life-around-campus; compare |
| After freeze | Stabilize + record | Stabilize + record | Stabilize + record (highest risk of unfinished features → cut hard) |

**B add-on estimates:** full evidence 3 h · filtered-out tray 3 h · reuse detector 4 h · map UI 5 h · lens 3 h · rail + simulate 3 h · eval + benchmark page 7 h · polish 3 h = **~31 h** (+ compare 6 h, flags 3 h).

**C add-on estimates:** virtual walk 14 h · grounded Q&A 8 h · life-around-campus 5 h · compare 6 h · extra polish/risk 10 h = **~43 h** on top of B.

---

## 6. Cut lines

| When | If this isn't true | Then cut / change |
|---|---|---|
| Thu 00:30 (CP0) | Streaming works on Vercel (S5) | Use polling of `/api/profile/{qid}` with a progress endpoint; keep the timer |
| Thu 00:30 (CP0) | A vision model meets ≤8 s p90 per 8-image batch | Reduce K to 24 images, use smaller images, or pick a faster model |
| Thu 13:00 (CP1) | Real resolve + Commons candidates on the deployed URL | Ceiling → A; pair-program the pipeline; P3 stays on fixtures |
| Thu 18:00 (CP2) | End-to-end p50 <30 s for 10 universities | No B layers; evening spent on speed and stability |
| Thu 23:30 | Web search returns useful Kazakh images | Show Commons-only + honest coverage; state the limitation in the UI and README |
| Fri 14:00 (CP3) | Map data API ready | Drop the map UI; keep the geo signal + distance text |
| Fri 17:00 | Benchmark numbers exist | Replace the page with a README table (with sample sizes) |
| Fri 17:00 | Compare mode working end-to-end | Remove it entirely |
| Fri 19:00 | Any feature half-working | Hide it behind a flag (off). **Never ship half-working UI** |
| Sat 09:00 | Final video recorded | Record the simplest single-take version immediately |

**Never cut:** resolver states, source links + dates, tiers + evidence basics, coverage/empty states, the timer, degraded modes, deployment stability, any submission artifact.

---

## 7. Explicitly not building

| Not building | Why |
|---|---|
| User accounts, login, favorites | Friction for judges; not in the case |
| Our own crawler of university websites | Slow, fragile, ToS risk; `site:` queries via the search API instead |
| HTML scraping of Google Images, Instagram, Facebook, VK, 2GIS | Violates source terms → disqualification risk |
| Student reviews aggregation | Legal/ToS risk, low yield in 72 h |
| Cost of living | No free legal API; scraping forbidden |
| AI-generated, "enhanced", or stylized images | Directly contradicts authenticity |
| Chatbot / general AI assistant | Generic; the case is a visual profile |
| Model training or fine-tuning | No time, no data; unnecessary |
| Microservices, queues, vector DB, Kubernetes | Overkill; adds failure points |
| Native mobile app, Telegram bot | Web product required |
| Full i18n | One UI language; names shown in original scripts |
| Admin panel, manual moderation tools | Looks like manual curation; not needed |
| Per-university overrides, whitelists, curated photo sets | Would imitate automation (forbidden) |
| 3D/VR tours | Out of scope |
| Precomputed "demo universities" presented as live | Faking speed (forbidden). Saved profiles are fine only when labeled |

---

## 8. Risk register

Likelihood / impact: L = low, M = medium, H = high, C = critical.

| # | Risk | L | I | Early warning | Mitigation | Owner |
|---|---|---|---|---|---|---|
| 1 | Wrong photos shown as Verified | M | C | Eval precision <85%; bug bash finds wrong-university photos | Conservative thresholds; strong-signal requirement; hard rejects; calibrate on tune split; default view hides Unconfirmed | P2 |
| 2 | Thin coverage for Kazakh universities | H | H | S3 spike: <10 useful candidates | RU/KZ queries; `site:` official domain; Commons geosearch; honest coverage states; coverage note in UI | P2 / P4 |
| 3 | Profiles slower than 30 s | M | H | Bench p90 >25 s | Parallel adapters; caps (K=40, 8 queries); 640 px images; best-first batches; 27 s deadline; `fra1` region; streaming | P1 |
| 4 | API credits/quota exhausted or key failure during 19–25 Sep | M | C | Usage dashboards; 429s in logs | Caching (14-day profiles); per-IP + daily guards; spend limits with 2× headroom; funded credits until 25 Sep; degraded modes; twice-daily checks | P4 / P1 |
| 5 | Wikimedia throttling (2026 limits: 200 req/min with compliant UA, ~10 without) | M | H | 429 from Wikimedia | Compliant User-Agent everywhere; batched generator queries; 24 h cache; `Retry-After` backoff; ≤15 calls/profile | P1 |
| 6 | Resolver fails on typos, abbreviations, Cyrillic | M | H | Matrix failures | Index with aliases + transliteration; fuzzy search; Wikidata fallback; pick-list instead of guessing | P1 |
| 7 | Integration failure late | M | C | UI still on fixtures at CP2 | Contracts first; P1 as integration owner; merge to `main` several times a day; checkpoint gates | P1 |
| 8 | Missing or late submission artifact | L–M | Fatal | No video by Fri night | P4 owns deliverables from Wed; video take 1 Fri night; submit by 10:30 Sat | P4 |
| 9 | Something *looks* like curation, stock, scraping, or faked speed | L | Fatal | Reviewer's gut check | Integrity rules ([case-analysis §4](case-analysis.md#4-allowed--forbidden--our-integrity-rules)); labeled cache; README disclosure; real-time video | All |
| 10 | Billing/account blockers (age, card) | M | H | Tonight | Adult account holder; Serper no-card path; spend limits | P4 |
| 11 | Vision model misreads or over-trusts | M | M | Eval shows visual-only false positives | Observations only; code decides; visible-text match must equal normalized names; visual consistency is weak (+10) | P2 |
| 12 | Hotlinked images don't load in the browser | M | M | Broken thumbnails in QA | `referrerPolicy="no-referrer"`; fall back to provider thumbnail; hide on error; images were already fetched server-side during verification | P3 |
| 13 | SSE buffered or broken on the platform | L | H | S5 spike | Tested tonight; polling fallback | P1 |
| 14 | Fatigue and sleep-deprivation errors | H | M | Rising bug count, slow checkpoints | Sleep windows; freeze Fri 19:00; no big merges after the freeze | All |
| 15 | Secrets committed to Git | L | H | — | Env vars only; `.gitignore`; scan history before making the repo public; rotate if leaked | P1 |
| 16 | Accidental change after the deadline | L | H | — | Tag release; protect `main`; disable auto-deploy after submission | P1 |
| 17 | Live demo failure in the final (network, Meet) | M | H | Rehearsal hiccups | Hotspot backup; second presenter device; labeled saved permalinks; recorded segment in slides | P4 |

---

## 9. QA plan and judge-simulation matrix

Run on **production** at CP2 (subset), Fri 09:00 (full), and Fri 19:00 (full). Adjust the names to what the team actually wants to cover; keep all rows below.

| Group | Queries (examples) | Expectation |
|---|---|---|
| Kazakhstan, well-known | Nazarbayev University; Al-Farabi Kazakh National University; KBTU; Satbayev University; L.N. Gumilyov Eurasian National University; KIMEP University; SDU University; Astana IT University | Rich or honest profile; ≤20 s median |
| Kazakhstan, regional / sparse | A regional state university; a small private university | Honest coverage states; no filler |
| Central Asia | American University of Central Asia; Westminster International University in Tashkent; Inha University in Tashkent | Works; RU/EN retrieval visible |
| International | Harvard University; ETH Zurich; University of Tokyo; KAIST; University of Tartu | Rich, fast |
| Ambiguous | `MSU`, `SDU`, `KazNU`, `Cambridge`, `Washington University`, `NU` | Pick-list with city/country; correct choice leads to correct profile |
| Misspelled | `Nazarbaev Univercity`, `Satpaev`, `Harvrad`, `Gumilev` | Correct suggestion or auto-resolve |
| Cyrillic / abbreviations | `КБТУ`, `ЕНУ`, `МГУ`, `Назарбаев Университет` | Correct resolution |
| Not a university / junk | `Almaty`, `pizza`, `asdfgh`, empty, 300-character string, `<script>alert(1)</script>` | Graceful not-found / suggestions / validation; no crash, no XSS |
| Failure simulation | `?simulate=web_search_down`, `vision_down`, `wikimedia_down` | Profile still renders with the correct banner |
| Behavior | Same query twice (cache badge); refresh live; 3 concurrent queries; mobile 375 px; throttled network | Correct labels; no breakage |

**Per-profile checklist:**
- Time to first photo; time to done
- Wrong-university photos (count)
- Visible duplicates
- Junk (logos, maps, stock, renders labeled as photos)
- 5 random source links open and contain the photo
- Every card has a date type
- 10 random categories correct
- Honest empty states
- Every description sentence cited
- No console errors

**Bug severity:**
- **S1** (fix before anything else): wrong photo marked Verified; crash; >30 s on a well-known university; broken source link on the first screen; submission blocker.
- **S2** (fix before freeze): wrong category; visible duplicate; confusing state; mobile layout break.
- **S3:** cosmetic.

---

## 10. Submission checklist

**Product**
- [ ] Production URL opens in incognito, no login, desktop + mobile
- [ ] Health check green; 5 matrix queries pass right before submitting
- [ ] Coverage/limitations note visible in the UI

**GitHub**
- [ ] Repo public (or access granted as required); `main` = tag `v1.0-submission`
- [ ] History shows commits from team members across the 72 h window
- [ ] No secrets in history; `.env.example` present

**README** (all sections the case requires)
- [ ] Problem · solution · target user
- [ ] Features, and how each mandatory requirement R1–R8 is met
- [ ] Stack + architecture diagram
- [ ] Local run instructions (`.env.example`, commands)
- [ ] **Judge test scenario:** step-by-step queries, including ambiguous, misspelled, sparse, and `?simulate=` outage
- [ ] Team roles
- [ ] Data sources (Wikidata, Wikipedia, Wikimedia Commons, search provider, OSM) and licenses/attribution approach
- [ ] AI models (exact model IDs) and APIs
- [ ] Pre-built components and libraries (shadcn/ui, etc.) + AI coding tools used
- [ ] Verification methodology: signals, weights, tiers
- [ ] Security measures
- [ ] Limitations + coverage
- [ ] Benchmark results (with sample sizes and dates)
- [ ] Cost notes

**Technical reference** (can be a README section)
- [ ] Models, APIs, libraries, external services, data, verification methods, security measures

**Demo video**
- [ ] ≤3:00; problem → user path → live product → result
- [ ] Pipeline shown in real time; recorded from production
- [ ] Link opens without login (unlisted YouTube / public Drive)

**Presentation**
- [ ] ≤8 slides, PDF: 1 problem · 2 solution · 3 demo screens · 4 how verification works · 5 technology/architecture · 6 results & advantages · 7 team · 8 development roadmap

**aistartify.com**
- [ ] Captain submits with code **`LOCUSCASE1`**
- [ ] Project card: team name, project name, problem, solution, target user
- [ ] All links pasted and re-opened from the submitted form
- [ ] Confirmation screenshot saved; done **by 10:30**

---

## 11. After the deadline

Sat 19 Sep 12:00 → Fri 25 Sep.

- **No pushes to `main`; auto-deploy disabled.** Only access fixes (e.g., a renewed key or restored link) on the organizer's request. Document anything you do.
- **Twice-daily check** (P4 + P1): `/api/health`, 3 matrix queries, API credit balances, error logs.
- **Keep credits funded** with ≥2× the expected judging usage; keep spend limits above that.
- **If something breaks:** restore access only (no functional changes). If the organizer asks, explain what happened.
- Watch LOCUS Hackathons for the **finalist list on 22 Sep**.

---

## 12. Final defense prep

22–24 Sep, if we're finalists.

- **Rehearse the 5-minute run-of-show** ([product-strategy §10.3](product-strategy.md#103-final-defense-run-of-show-500-on-google-meet)) at least 5 times with a timer. Two speakers, one driver.
- **Q&A drill:** use [product-strategy §11](product-strategy.md#11-pitch-and-qa-prep), assign an owner per question, and keep answers ≤30 s.
- **Tech check on Google Meet:**
  - share a browser tab, not the whole screen;
  - audio check;
  - a backup internet connection (phone hotspot);
  - a second device logged in, ready to present.
- **Fallback ladder:** live cold run → labeled saved permalink → recorded video segment embedded in the slides. Decide the switch trigger in advance (no photos after 15 s).
- **Show only the frozen version.** No new features, and no talking about features that don't exist as if they did.
