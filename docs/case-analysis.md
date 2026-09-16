# Case Analysis — Case 01 "Visual University Profile"

> **Internal team document · LOCUS Startup Hackathon 2026**
> Written Wed 16 Sep 2026, ~20:30 Astana time (UTC+5), from the organizer PDFs (Regulations v2.0 and Case 01).
> Strategy pack: **case-analysis** · [product-strategy](product-strategy.md) · [architecture](architecture.md) · [roadmap](roadmap.md)
>
> Organizer requirements are paraphrased in English. Where this document *interprets* rather than restates, it says so. If anything here conflicts with the PDFs or an official clarification published in LOCUS Hackathons, those win.

---

## 0. TL;DR

1. **We have 72 hours, not 4 days, and ~63 of them are left.** Submission closes **Sat 19 Sep, 12:00 Astana time**. Plan to submit by **10:30**.
2. **What to build:** a public website where anyone types a university name and, within **30 seconds**, gets a **verified, categorized, deduplicated** photo profile (campus, dormitories, classrooms, libraries, city; filters for dormitory / sports / labs / student life). Every photo needs a **clickable source and a date**, and the profile needs a short **sourced** description.
3. **Accuracy is the top-weighted criterion in every round** (30% in the case rubric) and the first tie-breaker. The case says outright that confidently showing an unverified photo scores **worse** than honestly saying "we couldn't confirm this".
4. **Judges will test a university that is not in our video.** They'll also try a misspelled name, missing data, and an unavailable source. Nothing can be hand-picked; the pipeline must work on unseen input.
5. **Forbidden:** passing off stock or other people's photos as the campus, hidden manual curation, faked sources/speed/confidence, and license violations. These become hard engineering rules (§4).
6. **Speed is 15%** of the case score, so results must stream in under strict time budgets.
7. **The real battlefield is Kazakhstan and Central Asia.** Judges from a Kazakhstani organizer will likely test local universities, and open photo sources cover them thinly. Web search in Russian, Kazakh and English (RU/KZ/EN) is needed for usable coverage.
8. **In the preliminary round, judges use the product without us.** It has to explain its own verification.
9. **After the deadline:** no functional changes are allowed, but the site must keep working and stay within API budget **until results on 25 Sep**, including the live final on **24 Sep**.
10. **MVP:** a deployed site with a name resolver, open sources, web image search, dedup, AI observations, rule-based confidence tiers, and a sourced gallery with honest empty states. Everything else is a layer on top.

---

## 1. Hard facts and the real clock

### 1.1 Timeline (Astana time, UTC+5)

| When | What | Consequence for us |
|---|---|---|
| Wed 16 Sep 12:00 | Case published; the 72-hour development window opens | Core case logic must be written inside this window; Git history may be inspected |
| **Sat 19 Sep 12:00** | **Submission closes** on aistartify.com; the captain submits with code `LOCUSCASE1` | Target submission 10:30; code freeze 09:00 |
| 19–21 Sep | Technical admission (pass/fail), then preliminary scoring | Judges use the product **without us**; it must be online and self-explanatory |
| 22 Sep | Up to 12 finalists announced | Prepare the final while waiting |
| 24 Sep | Final on Google Meet: ≤5 min pitch + live demo, ≤5 min Q&A, 4 judges | Must demo the **same version** frozen at the deadline |
| by 25 Sep 23:59 | Results | Site, repo, video, and API credits must stay alive until then |

Prize fund: 250 000 / 150 000 / 100 000 ₸ for places 1–3, plus AIstartify partner prizes.

### 1.2 The clock right now

| | |
|---|---|
| Elapsed since start | ~8.5 h (gone) |
| Remaining until deadline | **~63.5 h** |
| Nights left | 3 (Wed→Thu, Thu→Fri, Fri→Sat) |
| Working days | Thu 17 and Fri 18 are school days. Anyone with classes cuts team capacity sharply (see [roadmap §2](roadmap.md#2-capacity-reality-check)) |

"4 days" means 4 calendar dates but only 72 hours, so plan in hours.

### 1.3 Technical admission (pass/fail before any scoring)

Missing any one of these means the project isn't admitted, however good it is:

- a working website or web service (not a video, slides, or a mock-up);
- an accessible GitHub repo with real source code and development history (an empty or unrelated repo counts as missing);
- a README, a demo video, a presentation, and the required information;
- links that open without payment and stay available;
- on-time submission via aistartify.com (not email, Instagram, DMs, or only LOCUS Hackathons);
- no plagiarism, faked results, hidden ready-made solution, malicious code, or rights violations.

### 1.4 Submission package

| Artifact | Required content | Notes |
|---|---|---|
| Working product | Deployed URL; test login if auth exists | Don't add auth. Must work without payment until results |
| GitHub | Source code plus development history; public or accessible to the jury | Final version on `main` before the deadline |
| README | Task, solution, stack, architecture, run instructions, test scenario, team roles, data sources, AI/APIs, pre-built components, limitations | |
| Technical reference | Models, APIs, libraries, external services, data, verification methods, security measures | May be a README section |
| Demo video | ≤3 min: problem, main user path, live product, result | |
| Presentation | ≤8 slides, PDF: problem, solution, demo, technology, advantages, team, development | |
| Project card | Team and project name, problem, solution, target user | Filled in on aistartify.com |

After the deadline, the organizer allows only access or link fixes, and only on request. No functional changes.

---

## 2. What the organizers are actually asking for

**In one line:** a search engine for *trustworthy* campus photos, not just a photo search engine.

The case's problem: applicants see polished marketing pages, while real photos of campuses, dorms, classrooms, libraries, and the surrounding city are scattered across dozens of sources. Those photos are duplicated, outdated, attributed to the wrong place, or of unclear origin. Our job is to turn a university name into a structured, verified visual profile quickly.

Expected flow: **Name → Search → Verification → Categories → Profile.**

### 2.1 Mandatory functionality → traceability matrix

| # | Requirement (paraphrased) | "Done" means | How judges will check | Our acceptance test |
|---|---|---|---|---|
| R1 | Search by university name with clear handling of ambiguous queries | Tolerates typos and abbreviations; several matches → pick-list with city/country; no match → clear message + suggestions | Type ambiguous, misspelled, and unseen names | 40-query matrix: correct result or sensible pick-list, zero crashes |
| R2 | Photos of the campus, dormitories, classrooms/lecture halls, libraries, and the city | Each of the five areas has photos **or** an explicit "not enough verified data" state | Look for each area | 10 test universities: every area is either filled or honestly empty |
| R3 | Automatic categorization | The pipeline assigns every category; nobody tags by hand | Spot-check categories | Category accuracy on the labeled set (target ≥85%) |
| R4 | Remove identical, visually similar, and irrelevant images | No near-identical pairs; no logos, maps, documents, stock images, or close-up portraits | Scan the grid for repeats and junk | Across 10 profiles: 0 visible duplicates, ≤1 junk item per profile |
| R5 | Verify that each photo really shows this university, object, or city | Every shown photo carries recorded evidence; weak ones are labeled or hidden | Click through to sources and compare | "Verified" precision on held-out labels (target ≥90%) |
| R6 | Clickable source for every photo; publication or retrieval date where possible | Links to the page where the photo was found; the date shows its type (taken / uploaded / published / retrieved) | Click links | 100% of photos have a source URL fetched at generation time, plus a date |
| R7 | Short campus description based on the sources found | 3–5 sentences; every claim traceable to a cited source; no invented facts | Read and compare with sources | Every sentence has a citation; spot-check 5 profiles |
| R8 | Filters: dormitory, sports, labs, student life | Exactly these four filters, with counts and empty states | Click each filter | All 4 work on 10 profiles |

Tip (interpretation): use the case's own wording for category and filter labels in the UI (общежитие, спорт, лаборатории, студенческая жизнь …) so judges can tick their checklist without hunting.

### 2.2 The "honest uncertainty" rule, the most important paragraph in the case

The case says that if the service can't reliably confirm a photo, it must lower its confidence or say explicitly that data is lacking. Confidently showing an unconfirmed image is judged worse than an honest warning. It also says the number of photos isn't an advantage in itself: fifteen verified, correctly categorized images beat a hundred random ones.

What this means in practice (interpretation):

- **Precision over recall.** Use conservative thresholds; when in doubt, don't show a photo as verified.
- **Confidence is visible on every photo.** The case lists it as optional, but this rule effectively makes it mandatory.
- **The default view shows trusted photos only.** Unconfirmed items sit behind an explicit toggle with a warning.
- **Empty categories are designed states, not bugs.** "No verified dormitory photos found" is a correct answer.
- **No vanity counts.** Show "38 verified of 212 found", not "212 photos!".

### 2.3 Optional features listed by the organizers

| Optional feature | Value to judges | Cost | Verdict (interpretation) |
|---|---|---|---|
| Confidence score per item | Very high; directly serves accuracy and the honesty rule | Low once the pipeline records evidence | **Treat as mandatory** |
| Campus map + distance to city center | Medium-high; geotags also strengthen verification | Medium | Strong candidate |
| Compare two universities | Medium; good demo moment | Medium (cheap once profiles are cached JSON) | Late add-on |
| Climate, transport, cost of living | Low-medium; off the core (photos) | Climate: low. Transport: medium. Cost of living: no free legal API | Climate only if there's spare time; skip cost of living |
| Student photos and reviews | Medium in theory | High ToS/legal risk (Instagram, Google reviews, 2GIS) | Skip reviews; label independent (non-official) photos instead |

---

## 3. What judging actually rewards

### 3.1 Three rubrics, one product

| Criterion | Case 01 rubric (preliminary) | Regulations: generic preliminary rubric | **Final (decides winners)** |
|---|---|---|---|
| Accuracy / relevance / verifiability | **30** | **25** | **20** |
| Technical implementation and architecture | 25 | 15 | 15 |
| UX / interface clarity | 20 | 10 | 10 (live demo and UI clarity) |
| Search speed | 15 | — | — |
| Scalability and readiness / originality and development | 10 | 10 | — |
| Case fit and user value | — | 20 | 20 |
| Functionality and stability | — (partly covered by "integration robustness") | 20 | 20 |
| Presentation and answers to the jury | — | — | 15 |

- The case PDF has its own rubric; the regulations list a generic one. They don't conflict, so optimize for both and ask the organizers which one applies (§10).
- Preliminary scores only select up to 12 finalists. **Winners are decided purely by the final rubric**, where stability, case fit, and presentation together weigh 55%.
- Tie-breakers in both rounds: accuracy, then functionality and stability, then technical implementation.

### 3.2 What each criterion really rewards (observable behavior)

| Criterion | What a judge will actually do | What we must make obvious |
|---|---|---|
| Accuracy 30% | Open 3–5 photos, click the sources, and ask: is this that university, the right category, a duplicate, a stock image? One confidently wrong photo on the first screen costs a lot | Highest-confidence photos first; low confidence hidden by default; evidence one click away |
| Technical 25% | Read the README and architecture, skim the repo: search and verification logic, data handling, code structure, integration robustness, justification of the AI parts | A clear pipeline; deterministic checks around AI; timeouts, retries, fallbacks; unit tests on core logic; measured accuracy |
| UX 20% | Judge how fast the UI makes sense, plus navigation, categories, filters, visual hierarchy, and how sources are shown | One search box; category sections; source domain and date visible on the card; evidence one click away |
| Speed 15% | Time from submit to a *useful* profile under normal conditions | First photos in ≤10 s, complete in ≤20 s median; a real on-screen timer |
| Scalability 10% | Ask whether it handles new universities, sources, and categories, and whether it could be a real product | No per-university code; source adapters; categories as config; cost per profile; an integration story |
| Final: stability 20% | Watch the live demo | It doesn't break on Google Meet; failures degrade gracefully; a backup plan exists |
| Final: presentation 15% | Pitch + Q&A | Crisp story, real numbers, honest limitations |

### 3.3 Derived priority order

1. **Nothing wrong is shown as verified.**
2. **It works every time**, and partial failures are handled gracefully.
3. **It's fast:** useful content in seconds.
4. **It explains itself:** sources, evidence, and limitations are visible in the product.
5. **The technical story is measurable:** benchmarks, architecture, justified use of AI.
6. **Extras** (map, compare, lenses) come only after 1–5 are solid.

---

## 4. Allowed / forbidden → our integrity rules

**Allowed by the case:** AI models, computer vision, search APIs, and open sources; open-source libraries and cloud services; pre-built base infrastructure (disclosed in the README); limiting the demo to supported countries **if the UI says so**.

**Forbidden by the case:** presenting stock photos or someone else's photos as a specific campus; hiding manual curation or imitating automatic search; faking sources, speed, or confidence; violating licenses, source rules, or third-party rights. General rules: core logic written within the 72 hours; pre-built components only with README disclosure; no secrets in the repo.

**Our engineering rules (non-negotiable):**

1. **No per-university special cases.** No hard-coded photos, whitelists, blacklists, or overrides; only generic rules and configs (e.g., a stock-domain blocklist).
2. **Every shown photo links to a page our pipeline actually retrieved.**
3. **Code computes confidence from recorded evidence.** It's never typed by hand and never a number invented by an LLM.
4. **Timers show real wall-clock time.** Cached results are labeled as cached, with their original generation time.
5. **Unconfirmed is never disguised.** Such a photo is either shown with an explicit label or listed under "filtered out" with a reason.
6. **No stock-photo sites as inputs.** Stock matches are rejected.
7. **Only official APIs and open data.** No HTML scraping of Google Images, Instagram, Facebook, VK, 2GIS, or other sites whose terms forbid it.
8. **Don't re-host full-size images.** Show attribution and license when known, and always link to the source.
9. **The demo video shows the real product in real time.** Never speed up the pipeline segment.
10. **The README discloses** every pre-built component, third-party library, API, and AI tool used (including AI coding assistants).
11. **Evaluation labels are never used at runtime.**

---

## 5. The judges' test scenario, simulated

| Judge action | What it tests | What great looks like | Costly failure |
|---|---|---|---|
| A university from our video | Baseline | Fast, clean, rich | — |
| A university **not** in our video | Real automation | Same quality; honest where data is thin | Empty, broken, slow, or suspiciously uneven quality |
| Measure time | Speed | Visible timer; photos streaming in ≤10 s; done ≤30 s | A 40-second spinner |
| Check photos, categories, duplicates, source links | Accuracy | Links land on real pages containing the photo; no repeats | Dead links, wrong university, duplicates |
| Not enough data | Honesty | "Not enough verified dormitory photos" + a toggle for unconfirmed ones | Gaps filled with random images |
| Misspelled name | Resolver | Correct suggestion or auto-correction | "Nothing found", or silently the wrong university |
| Source unavailable | Robustness | Source marked unavailable; profile still produced, with a banner | A 500 error or an endless spinner |

The full query matrix is in [roadmap §9](roadmap.md#9-qa-plan-and-judge-simulation-matrix).

---

## 6. Minimum viable solution

**Definition:** a deployed site that, for most universities with a public web presence, returns within 30 seconds a categorized, deduplicated gallery. Every shown photo has a source link, a typed date, and a confidence tier backed by recorded evidence. The site handles ambiguous, misspelled, and unknown queries and source failures gracefully, and includes a sourced description and the four filters.

MVP checklist:

- [ ] Resolver: fuzzy local index + Wikidata; pick-list; "not found" with suggestions
- [ ] Sources: Wikidata / Wikipedia / Wikimedia Commons **and** one web image search API (RU/EN/KZ queries)
- [ ] Image fetch, URL canonicalization, perceptual-hash deduplication, near-duplicate flags
- [ ] Vision model reports observations: image type, category, visible text, consistency
- [ ] Rule-based score → tiers: Verified / Likely / Unconfirmed / Rejected
- [ ] Profile page: five required areas + four filters; source, date, and tier on each card
- [ ] Description with citations
- [ ] Honest empty, partial, and error states; per-source timeouts; a global deadline
- [ ] Streaming progress with a real timer
- [ ] Result cache, labeled as cache
- [ ] Deployed, plus README, video, slides, submission

Not in the MVP: map UI, compare, benchmark page, reuse detector, official-vs-independent lens, climate.

---

## 7. What would make it significantly more impressive

Summary only; details, costs, and recommendations are in [product-strategy §4](product-strategy.md#4-brainstorm-15-directions).

1. **Inspectable evidence per photo:** "why we trust this photo" in plain language.
2. **Show what was rejected and why:** duplicates, stock, renders, other universities, far-away geotags.
3. **Catch recycled images:** the same picture on stock sites or other universities' pages gets flagged.
4. **Geo-proof:** geotagged photos pinned around the campus, plus distance to the city center.
5. **Published accuracy:** measured precision of the Verified tier and median latency on a held-out labeled set.
6. **Demonstrable graceful degradation:** a documented switch that simulates a source outage.
7. **Local-language strength:** KZ/RU/EN retrieval, Cyrillic abbreviations, transliteration.

---

## 8. Kill risks (summary)

The full register with owners, triggers, and mitigations is in [roadmap §8](roadmap.md#8-risk-register).

| # | Risk | Why it can sink us |
|---|---|---|
| 1 | Wrong photos shown as verified | Hits the heaviest criterion and the explicit honesty rule |
| 2 | Thin results for Kazakh and Central Asian universities | Likely the judges' test set; empty profiles read as "doesn't work" |
| 3 | Profiles take >30 s or time out | The speed criterion (15%) plus perceived stability |
| 4 | API credits run out or keys break during 19–25 Sep | The site fails while judges test, and no code fixes are allowed after the deadline |
| 5 | Wikimedia throttling under its new 2026 rate limits | Our main proof source goes dark |
| 6 | Resolver fails on typos or abbreviations | It's the judges' first interaction |
| 7 | Integration hell on the last night | Three half-built parts that never connect |
| 8 | A missing submission artifact | Instant non-admission |
| 9 | Anything that *looks* like curation, stock photos, ToS-violating scraping, or faked speed | Disqualification-level |
| 10 | Billing blockers: API accounts often need an adult cardholder, and free tiers don't survive judge traffic | No AI or search means no product |

---

## 9. Non-obvious insights

1. **Wikimedia Commons is the backbone of verifiability.** It carries the author, license, dates, categories, structured "depicts" statements, and often GPS. Web search adds coverage; Commons adds proof.
2. **The strongest verification signals aren't AI.** They're category membership, geotag distance, the official domain, and cross-source agreement. AI adds image type, category, and visible text, which is also a good answer to "justify your AI".
3. **Don't claim fake-image detection.** The vision vendor's own docs say its model can't reliably tell whether an image is AI-generated. Rely on provenance and reuse detection instead.
4. **Speed and honesty only coexist with streaming.** Show photos as each verification batch confirms them.
5. **Caching is fine; hiding it is not.** A "saved profile · generated at … in 16 s · refresh live" badge keeps it honest.
6. **Round-1 judges see the product without us.** An in-product "How we verify" page and tooltips are worth more than a slide.
7. **Coverage limits are allowed if stated.** An honest coverage note protects against the long tail of obscure universities.
8. **The final is a live screen share on Google Meet.** Prepare a network backup, pre-generated (labeled) permalinks, and a recorded fallback.
9. **The search API landscape has changed.** Google Custom Search is closed to new customers, Bing's API is retired, and Brave's free plan is gone. Choose providers tonight ([architecture §2](architecture.md#2-external-services-verified-status)).
10. **The organizer is an education company, and the hackathon's theme is university information for applicants.** Pitch the result as a component such platforms could embed (a "verified campus profile API"), under our own brand.

---

## 10. Questions to ask the organizers (official Q&A only)

Per the regulations, only clarifications published in LOCUS Hackathons change the rules; private answers don't.

1. Is Case 01 preliminary scoring done with the case rubric (30/25/20/15/10) or the generic rubric from the regulations?
2. When judges measure speed, is a clearly labeled cached profile acceptable, provided a fresh live run is one click away?
3. Is limiting coverage (e.g., Kazakhstan, Central Asia, and major international universities) acceptable if the UI states it?
4. Are commercial search APIs that return search-engine results (e.g., Serper) acceptable as "search APIs"?
5. What's the preferred format for the demo video link (unlisted YouTube or Google Drive)?

---

## 11. Where your 15 questions are answered

| # | Question | Short answer | Details |
|---|---|---|---|
| 1 | What exactly to build | Name → verified, categorized, sourced visual profile in ≤30 s | §2 |
| 2 | What judging rewards | Accuracy first in every round, then stability, speed, clarity, and a measurable technical story | §3 |
| 3 | Minimum viable solution | The §6 checklist | §6 |
| 4 | What makes it more impressive | Inspectable evidence, visible rejects, reuse detection, geo-proof, published accuracy | §7, [strategy §4](product-strategy.md#4-brainstorm-15-directions) |
| 5 | Kill risks | Wrong "verified" photos, thin KZ coverage, >30 s, budget exhaustion, throttling | §8, [roadmap §8](roadmap.md#8-risk-register) |
| 6 | What to build first | Deploy + contracts → resolver → sources → dedup → verification/scoring → streaming UI | [roadmap §3](roadmap.md#3-build-order) |
| 7 | What not to build | Accounts, crawlers, scraping, reviews, chatbot, fine-tuning, microservices … | [roadmap §7](roadmap.md#7-explicitly-not-building) |
| 8 | Nice-to-have vs critical | Triage table | [strategy §3](product-strategy.md#3-feature-triage) |
| 9 | Killer feature | "Proof, not pictures": evidence + rejects + reuse detection + measured accuracy | [strategy §5](product-strategy.md#5-killer-feature-shortlist) |
| 10 | A strong 2–3 min demo | Timed script | [strategy §10](product-strategy.md#10-demo-plan) |
| 11 | Realistic for 4 students | A fits; B is tight and needs discipline; C doesn't fit | [roadmap §2](roadmap.md#2-capacity-reality-check) |
| 12 | What to mock, simplify, precompute | Integrity-safe list | [strategy §8](product-strategy.md#8-what-can-be-mocked-simplified-or-precomputed) |
| 13 | What to automate | The whole pipeline, deploys, CI, evaluation, budget guards | [strategy §9](product-strategy.md#9-automated-vs-manually-controlled), [architecture §12](architecture.md#12-automation) |
| 14 | What to control manually in the demo | Choice of examples, cold vs cached run, environment, fallback ladder | [strategy §9](product-strategy.md#9-automated-vs-manually-controlled) |
| 15 | Stack | One Next.js/TypeScript app on Vercel + Wikimedia + one search API + Claude vision + Redis | [architecture §1](architecture.md#1-stack) |
