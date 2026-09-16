# Product Strategy — Case 01 "Visual University Profile"

> **Internal team document · LOCUS Startup Hackathon 2026 · written 16 Sep 2026**
> Strategy pack: [case-analysis](case-analysis.md) · **product-strategy** · [architecture](architecture.md) · [roadmap](roadmap.md)
>
> This document does **not** pick a direction for the team. It lays out the options, their trade-offs, and a way to decide (§7).

---

## 0. TL;DR

- The strongest stance for this case is **"proof, not pictures"**: fewer photos, each with inspectable evidence, visible rejects, and honest gaps.
- **Critical** means the eight mandatory features plus visible confidence, honest empty states, streaming speed, and graceful failure. Everything else is optional (§3).
- There are **15 feature directions** below. 13 are worth building in at least one product direction; 2 are explicitly not recommended (§4).
- There are **three complete directions**: **A "Verified Gallery"** (safest), **B "Proof, Not Pictures"** (balanced), and **C "Campus Reality Check"** (high-risk). They are **nested** (B = A + layers, C = B + layers), so the first ~20–24 hours of work are identical. The choice can wait for data at the checkpoints; it doesn't need to be made tonight (§6–7).
- **Capacity math:** A fits a full-time team comfortably. B fits only a near-full-time team that cuts its stretch items. C doesn't fit 72 hours for 4 students ([roadmap §2](roadmap.md#2-capacity-reality-check)).
- **Demo:** one live, real-time run on an ambiguous query → evidence card → filtered-out tray → honest gap → measured numbers (§10).

---

## 1. Who we are building for

**Primary user:** a 16–19-year-old applicant from Kazakhstan or Central Asia comparing local and foreign universities they can't visit. Today they rely on marketing pages, scattered social media, and image search results that mix up universities.

**Secondary users:**
- **Parents:** they care about dorm conditions, safety, and whether the photos are real.
- **Admissions advisors and education platforms:** they need fast, shareable, trustworthy visuals for students.

**Jobs to be done:**
1. "Show me what the campus, dorms, and library *really* look like."
2. "Tell me whether I can trust this photo: is it this university, and is it current?"
3. "Help me compare where I'd study and live."

**Key moments:** building a shortlist; deciding where to apply; choosing housing or paying a deposit; family discussions.

---

## 2. Product principles

1. **Evidence over volume.** Every photo has to earn its place.
2. **Honest beats confident.** "We couldn't confirm this" is a feature.
3. **First useful pixels fast.** Stream results; never block on the slowest source.
4. **Every pixel has a source.** A link, a date, and a license where known.
5. **The product explains itself.** Judges and users shouldn't need us in the room.
6. **One pipeline for every university.** No special cases, ever.

---

## 3. Feature triage

| Tier | Features | Why |
|---|---|---|
| **Critical** (ship it or fail) | R1–R8 from the case; confidence tier per photo; honest empty and partial states; source + typed date on every card; streaming progress with a real timer; per-source timeouts and graceful failure; cache with an honest label; stable deployment; a "How we verify" explanation reachable from the UI | Directly scored or required for admission; the honesty rule |
| **Should** (big score gain for moderate cost) | Evidence card with plain-language signals; filtered-out tray with reasons; KZ/RU/EN retrieval, including queries restricted to the official domain; official-vs-independent source badges; reuse/stock detector; geotag verification + distance to city center; measured accuracy on a labeled set | Accuracy 30%, technical 25%, originality, Q&A |
| **Nice-to-have** (only once the core is ready to freeze) | Map view with photo pins; compare two universities; benchmark *page* (vs. a README table); community "report this photo"; UI for the fault-injection switch; freshness badges; climate card | Visible polish; optional features from the case |
| **Don't build** | Accounts/login; own website crawler; scraping Google Images/Instagram/VK/2GIS; student reviews; cost-of-living scraping; chatbot / visual Q&A; AI-generated or "enhanced" images; model training or fine-tuning; microservices / queues / vector DB; native app or bot; full i18n; admin/moderation CMS; per-university overrides | Out of scope, ToS/legal risk, or contradicts authenticity (see [roadmap §7](roadmap.md#7-explicitly-not-building)) |

---

## 4. Brainstorm: 15 directions

**Complexity:** S ≤3 h, M 4–8 h, L >8 h. These are build hours for one competent developer using AI coding assistants (allowed by the regulations; disclose them in the README). **Demo value:** ★ to ★★★★★.

| # | Direction | Complexity | Main criteria hit | Demo | Risk | Recommendation |
|---|---|---|---|---|---|---|
| 1 | Evidence Card | M (~6 h) | Accuracy, Technical, UX | ★★★★★ | Low | **Build (core)** |
| 2 | Filtered-Out Tray | S (~3 h) | Accuracy, Technical | ★★★★ | Low | **Build** (counts in A, full tray in B) |
| 3 | Reuse Detector | M (~4 h) | Accuracy, Originality | ★★★★ | Medium | **Build in B** |
| 4 | Geo-Proof Map | S signal + M map (~2 h + 5 h) | Accuracy, UX, optional feature | ★★★★ | Medium | Signal: **core**; map UI: **B** |
| 5 | Live Pipeline Theater | M (~4 h + 3 h) | Speed, Stability, Technical | ★★★★★ | Low–Med | Timer + streaming: **core**; full theater: **B** |
| 6 | Honest Coverage Report | S (~3 h) | Accuracy (honesty), UX | ★★★ | Low | **Build (core)** |
| 7 | Smart Resolver | M (~8 h) | R1, UX, Stability | ★★★★ | Medium | **Build (core)** |
| 8 | Multilingual Retrieval (KZ/RU/EN) | S (~3 h) | Accuracy (coverage), usefulness | ★★ | Low | **Build (core)** |
| 9 | Marketing vs Reality lens | S (~2–3 h) | Case fit, Originality, UX | ★★★★ | Low–Med | **Build in B** |
| 10 | Freshness & Renders | S (~3 h) | Accuracy | ★★★ | Low–Med | **Partly (core)** |
| 11 | Compare Mode | M (~6 h) | Case fit, optional feature | ★★★★ | Medium | **B stretch** |
| 12 | Accuracy Benchmark | M (~7 h incl. labeling) | Technical, Accuracy, Q&A | ★★★ | Low | **B** (README table in A) |
| 13 | Community Flags | S (~3 h) | Scalability | ★★ | Low | Nice-to-have, last |
| 14 | Grounded Visual Q&A | M–L (~8 h) | Little (reads as generic AI) | ★★★ | High | **Don't build** (C only) |
| 15 | Virtual Campus Walk | L (~14 h+) | Wow | ★★★★★ | Very high | **Don't build** (C only) |

### 4.1 Evidence Card: "why we trust this photo"
- **User problem:** A photo alone can't tell you whether it's real, current, or even of this university.
- **Why it matters here:** Accuracy is 30% (20% in the final), and the honesty rule demands visible confidence. Round-1 judges need the product to justify itself without us.
- **Implementation:** The pipeline records signals for each photo: provenance, geo, visible text, cross-source matches, and negatives. Code computes points and a tier. A dialog shows ✓/✗ lines in plain language, the source button, the date and its type, license/author, and distance from campus if the photo is geotagged. Example: *✓ In the Wikimedia Commons category of this university · ✓ Taken 340 m from the main campus · ✓ Signage reads "Satbayev University" · Taken 12 Jun 2019 (camera data) · CC BY-SA 4.0.*
- **Complexity:** M (~6 h incl. UI), assuming the scoring engine already records reasons.
- **Hackathon value:** Very high: accuracy, verifiability, technical justification, UX.
- **Demo value:** ★★★★★. "Click any photo" is the moment judges remember.
- **Potential risk:** Photos found only via web search may have thin evidence, so their cards look weak. Make sure every source type yields at least 2–3 kinds of signal.
- **Recommendation:** **Build** (core, every direction; basic in A, full in B).

### 4.2 Filtered-Out Tray: "what we removed and why"
- **User problem:** Users and judges can't see what was removed or why, so dedup and filtering quality is invisible.
- **Why it matters here:** R4 (remove duplicates and irrelevant images) is mandatory and explicitly checked. Showing the rejects *proves* it works.
- **Implementation:** Every dropped candidate keeps a reason code: duplicate of #N, stock source, not a photo, render, other institution named, geotag far away, low quality, close-up portrait, or verification timeout. A collapsible "Filtered out (47)" section groups them by reason, with thumbnails and source links.
- **Complexity:** S (~3 h).
- **Hackathon value:** High; it makes accuracy visible and shows technical depth.
- **Demo value:** ★★★★. "We removed 23 duplicates and a photo of a different university."
- **Potential risk:** A good photo rejected by mistake becomes visible. That's acceptable, since it signals conservatism. Don't render thumbnails for portraits or unsafe content; show the reason only.
- **Recommendation:** **Build.** A: counts per reason. B: full tray.

### 4.3 Reuse Detector: "recycled and stock image catcher"
- **User problem:** Official sites and aggregators reuse stock photos or other universities' photos, so "found on the official website" doesn't guarantee authenticity.
- **Why it matters here:** The case explicitly forbids stock or foreign photos presented as a campus. Actively detecting them is a strong, original defense.
- **Implementation:** Compute perceptual hashes for all candidates in a run and keep a persistent hash index across runs (banded for fast lookup). If a candidate matches an image found on a stock domain, reject it ("stock image reused"). If it matches images attributed to *other* universities, penalize or reject it ("same image used for 3 universities").
- **Complexity:** M (~4 h), building on the dedup hashes.
- **Hackathon value:** High originality and accuracy; an excellent Q&A answer.
- **Demo value:** ★★★★, but only with a *real* example found during testing, never staged.
- **Potential risk:** Legitimate syndication (e.g., news reposts) could be penalized, so apply a penalty rather than a hard reject unless the source is a stock domain. The cross-run index starts empty and grows as profiles are generated.
- **Recommendation:** **Build in B.**

### 4.4 Geo-Proof Map
- **User problem:** "Where exactly is it? Is the dorm next to campus? How far is the city center?"
- **Why it matters here:** The map is a listed optional feature, and geotags are among the strongest verification signals.
- **Implementation:** Take campus coordinates from Wikidata and city-center coordinates from the city entity, and compute straight-line distance. Geotagged photos (Commons GPS / camera data) feed a distance rule in scoring (≤1.5 km strong positive; >50 km strong negative). A Leaflet map shows pins that open the evidence card.
- **Complexity:** Geo signal + distance text: S (~2 h). Map UI: M (~5 h).
- **Hackathon value:** Medium-high: accuracy + UX + an optional feature.
- **Demo value:** ★★★★. Photos appear where they were taken.
- **Potential risk:** Many web photos have no GPS, so the map may look sparse. Multi-campus universities complicate the distance rule. OSM tile policy is fine for light use with attribution.
- **Recommendation:** Geo signal and distance **in core**; map UI **in B**.

### 4.5 Live Pipeline Theater
- **User problem:** 20 seconds of spinner feels broken, and users don't know what's happening.
- **Why it matters here:** Speed is 15%, and judges test the "unavailable source" scenario. The theater also shows the architecture without slides.
- **Implementation:** The server streams Server-Sent Events for each stage. A progress rail (Resolve → Search → Deduplicate → Verify → Profile) shows live counts, plus per-source status chips (ok / slow / unavailable) and a real timer. Photos stream in as each verification batch completes. A documented `?simulate=` switch forces a source outage to demonstrate degradation.
- **Complexity:** Timer + streaming partial results: M (~4 h, core). Full rail + source chips + simulate switch: +S (~3 h, B).
- **Hackathon value:** High: speed perception, stability, technical visibility.
- **Demo value:** ★★★★★.
- **Potential risk:** Streaming through serverless platforms or proxies can get buffered. Test on Vercel tonight, and keep a fallback that polls the JSON result. Progress must mirror real stages (never a fake animation).
- **Recommendation:** **Build** (core: timer + streaming; B: full theater).

### 4.6 Honest Coverage Report
- **User problem:** Users don't know what's missing, and may read "no dorm photos" as "no dorms".
- **Why it matters here:** It's the honesty rule, made visible.
- **Implementation:** Per category, count photos by tier and derive a state: good / thin / none. Copy like: "No verified dormitory photos. 2 unconfirmed images — show with warning." Add a profile-level banner when overall data is limited.
- **Complexity:** S (~3 h).
- **Hackathon value:** High (accuracy/honesty, UX).
- **Demo value:** ★★★ (the sparse-university moment).
- **Potential risk:** Low.
- **Recommendation:** **Build (core).**

### 4.7 Smart Resolver
- **User problem:** People type "KBTU", "Назарбаев", "satpaev univer", or "MSU".
- **Why it matters here:** R1 is mandatory, it's the first thing judges do, and it's how the misspelled-name scenario is tested.
- **Implementation:**
  - **Index:** prebuilt from Wikidata (labels and aliases in EN/RU/KK, country, city, coordinates, website, Commons category, popularity by sitelinks), merged with the open university-domains list.
  - **Normalization:** case, diacritics, Kazakh-specific letters, Cyrillic↔Latin transliteration, and filler words (университет / university / univer).
  - **Search:** fuzzy search over the index, with live Wikidata search as a fallback.
  - **Result:** auto-select when one candidate clearly dominates; otherwise show a pick-list of cards (name, city, country, founded, logo). Non-university queries (e.g., a city name) get suggestions.
- **Complexity:** M (~8 h incl. index script and UI states).
- **Hackathon value:** Very high (mandatory, UX, stability).
- **Demo value:** ★★★★. "MSU": Moscow State or Michigan State?
- **Potential risk:** Wikidata export queries can time out (chunk them by country), and some abbreviations may be missing (keep a small generic alias file, disclosed in the README).
- **Recommendation:** **Build (core).**

### 4.8 Multilingual Retrieval (KZ/RU/EN)
- **User problem:** Real photos of Kazakh and Central Asian universities live on Russian- and Kazakh-language pages, so English-only queries miss them.
- **Why it matters here:** These are the judges' likely test universities, and coverage decides usefulness and prevents empty profiles.
- **Implementation:** Query templates per category in EN + RU (+ KK when labels exist), built from Wikidata names. Add queries restricted to the official domain (`site:`), plus locale parameters per country. Cap at ~8 queries per profile, prioritizing the weakest categories.
- **Complexity:** S (~3 h on top of the search adapter).
- **Hackathon value:** High (coverage → accuracy and usefulness).
- **Demo value:** ★★ (invisible unless shown in source details).
- **Potential risk:** More queries mean more cost and latency; use hard caps and caching.
- **Recommendation:** **Build (core).**

### 4.9 Marketing vs Reality lens
- **User problem:** Glossy ads vs. reality, which is literally the case's own problem statement.
- **Why it matters here:** Case fit and originality at low cost.
- **Implementation:** Classify each source domain as official (university domains), encyclopedic (Wikimedia), media/news, independent (blogs, photo sites, forums), social, or unknown. Show a badge on every card, a "Hide official marketing photos" toggle, and a per-profile split ("62% of verified photos come from the university itself").
- **Complexity:** S (~2–3 h).
- **Hackathon value:** Medium-high.
- **Demo value:** ★★★★. Flip the toggle and the glossy banners disappear.
- **Potential risk:** Domains can be misclassified, and small universities may have few independent photos. The toggle then reveals emptiness, which is honest but less pretty.
- **Recommendation:** **Build in B.**

### 4.10 Freshness & Renders
- **User problem:** Photos may be 15 years old, or be renders of buildings that don't exist yet.
- **Why it matters here:** The case mentions outdated photos and asks for dates.
- **Implementation:** Typed dates: taken (camera data) / uploaded / page published / retrieved. A "may be outdated" badge for old photos. When the vision model reports "render or illustration", label the image "Render, not a photo" or reject it. Do **not** claim AI-generated image detection; the vision vendor's docs say its model can't reliably do that.
- **Complexity:** S (~3 h).
- **Hackathon value:** Medium (accuracy).
- **Demo value:** ★★★.
- **Potential risk:** Web pages rarely expose dates, so often only "retrieved" is available. Render classification can be wrong.
- **Recommendation:** **Build partly:** typed dates and the render label in the core; no timeline UI.

### 4.11 Compare Mode
- **User problem:** Applicants choose between options.
- **Why it matters here:** A listed optional feature, and decision-oriented UX.
- **Implementation:** `/compare?a=…&b=…` loads two profiles (cached, or streamed in parallel). It shows them side by side per category (top 3 verified each), with coverage, distance to center, and key facts.
- **Complexity:** M (~6 h).
- **Hackathon value:** Medium.
- **Demo value:** ★★★★.
- **Potential risk:** Doubles cold-run time and cost; tricky mobile layout; late integration.
- **Recommendation:** **B stretch**, only if everything else is ready to freeze by Fri 14:00.

### 4.12 Accuracy Benchmark
- **User problem:** "Why should I trust your confidence tiers?"
- **Why it matters here:** Accuracy 30% + technical 25% + final Q&A; it turns claims into evidence.
- **Implementation:**
  - **Labeled set:** ~12 universities × ~20–25 candidates, including rejected ones. Labels: belongs / category / duplicate / stock or render. Split into tune and test halves.
  - **Script:** computes Verified-tier precision, category accuracy, duplicate leakage, p50/p90 cold latency, and cost per profile.
  - **Output:** committed JSON plus a `/benchmark` page with the method and caveats.
- **Complexity:** M (~7 h incl. ~3 h of labeling by P4).
- **Hackathon value:** Very high credibility.
- **Demo value:** ★★★ (one slide), but decisive in Q&A.
- **Potential risk:** Small sample, and the temptation to overfit. Tune only on the tune split and report the test split.
- **Recommendation:** **Build in B** (in A: script + README table only).

### 4.13 Community Flags
- **User problem:** Automated pipelines make mistakes, and users notice.
- **Why it matters here:** Supports the scalability and readiness story ("gets better with use").
- **Implementation:** A "Report this photo" button stores the image hash and a reason, which becomes a penalty signal in future runs.
- **Complexity:** S (~3 h).
- **Hackathon value:** Low–medium.
- **Demo value:** ★★.
- **Potential risk:** Abuse; use a penalty rather than removal, plus a rate limit.
- **Recommendation:** **Nice-to-have**, built last if at all.

### 4.14 Grounded Visual Q&A
- **User problem:** Specific questions ("Are dorm rooms shared?").
- **Why it's weak here:** The case asks for a visual profile. A chat reads as a generic AI feature and invites hallucinations that contradict the honesty rule.
- **Implementation:** Question → retrieve relevant verified photos and text sources → answer citing photos.
- **Complexity:** M–L (~8 h).
- **Hackathon value:** Low against the rubric.
- **Demo value:** ★★★.
- **Potential risk:** High; a hallucinated answer on camera is an accuracy failure.
- **Recommendation:** **Don't build** (C only).

### 4.15 Virtual Campus Walk
- **User problem:** A photo grid doesn't convey how the campus is laid out.
- **Why it matters here:** Wow factor and spatial understanding.
- **Implementation:** Cluster photos into places/buildings (Commons subcategories + geotags + visual similarity), turn them into named stops on a map, and let users step through a tour.
- **Complexity:** L (~14 h+).
- **Hackathon value:** Medium, with a high wow factor.
- **Demo value:** ★★★★★.
- **Potential risk:** Very high: sparse data for most universities, clustering errors, not enough time.
- **Recommendation:** **Don't build** (C only).

**Small extras worth knowing about:**
- **"Life around campus":** climate via Open-Meteo, nearby transit via OpenStreetMap. C only.
- **"Profile API for partner platforms":** the JSON endpoint exists anyway, so just document it. Use it in the pitch and scalability story.

---

## 5. Killer feature shortlist

Ranked by score impact × demo impact ÷ risk. The team makes the final call; all three can coexist in Direction B.

1. **"Proof, not pictures" bundle** = Evidence Card (#1) + Filtered-Out Tray (#2) + Reuse Detector (#3) + measured accuracy (#12).
   *Why:* It attacks the heaviest-weighted criterion directly. It's hard to copy in 72 hours for teams that built "search + GPT gallery". It demos in 30 seconds, and it survives hostile Q&A because every claim can be inspected.
2. **Geo-Proof Map** (#4): the most *visual* differentiator, and a verification signal at the same time. Weaker for universities with little GPS-tagged imagery.
3. **Marketing vs Reality lens** (#9): the best *narrative* hook, because it's the case's own problem statement. Cheap. Depends on independent photos existing.

---

## 6. Three product directions

The directions are nested, so every layer leaves a shippable product:

```
A  Verified Gallery        = MVP + trust basics
└─ B  Proof, Not Pictures  = A + evidence card (full), filtered-out tray, reuse detector,
   │                           map, source lens, pipeline theater, benchmark page
   └─ C  Campus Reality Check = B + virtual walk, grounded Q&A, life-around-campus, compare
```

### Direction A — "Verified Gallery" (safest, highest probability of finishing)

**Pitch:** *Type a university and in about 20 seconds get a clean, categorized gallery of verified photos with sources, or an honest "not enough data".*

**User experience:** Search (fuzzy, pick-list) → streaming profile with a timer → category sections with the 4 filters → photo cards showing tier, source, and date → basic evidence dialog → coverage states → sourced description → "How we verify" page.

**In scope:**
- The MVP checklist ([case-analysis §6](case-analysis.md#6-minimum-viable-solution)) and the Critical tier from §3
- #1 Evidence Card (basic)
- #2 Filtered-Out Tray (counts only)
- #4 geo signal + distance text (no map)
- #5 timer + streaming
- #6 Coverage Report, #7 Smart Resolver, #8 Multilingual Retrieval
- #10 typed dates and render label
- Eval script with a README table

**Out of scope:** map UI, reuse detector, source lens, full theater, benchmark page, compare.

**Sources and AI:** Wikidata, Wikipedia, and Commons, plus one web image search API. One vision call type (observations) and one description call.

**Effort:** ~65–95 build hours + ~15 h deliverables.

**Probability of shipping polished and on time:** ~85% for a full-time team; ~60% if members have classes Thu/Fri.

**Strengths:** stability, speed, clarity, and a small integration surface.

**Weaknesses:** less originality and a thinner technical story. Coverage gaps for local universities are visible, with fewer trust features to compensate.

**Choose if:** effective build capacity is under ~100 h, nobody on the team has shipped a deployed web app with an API before, or Checkpoint 1 or 2 slips.

### Direction B — "Proof, Not Pictures" (balanced / ambitious)

**Pitch:** *Every photo comes with inspectable proof. We show what we rejected and why, where photos were taken, and how accurate we measured ourselves to be.*

**User experience:** Everything in A, plus:
- live pipeline theater with source health;
- the full evidence card with plain-language signals;
- the filtered-out tray with reasons and thumbnails;
- an official/independent toggle with source badges;
- a map with geotagged photos and distance to the center;
- a `/benchmark` page with measured precision and latency.

Stretch: compare mode.

**In scope:** A + #1 (full), #2 (full), #3, #4 (map), #5 (full + simulate switch), #9, #12 (page). Stretch: #11, #13.

**Effort:** ~95–125 build hours + ~15 h deliverables.

**Probability:** ~55–65% for the full scope, but ~85–90% for at least an A-level result, because B is layered on top of A.

**Strengths:** accuracy and verifiability in every round, technical justification, originality, strong Q&A.

**Weaknesses:** more UI surface to polish, a tight schedule, and more moving parts in the live demo.

**Main risk:** extra layers eat the stabilization time, and unpolished extras hurt UX. Enforce the feature freeze (Fri 19:00).

**Choose if:** ≥3 members are near full-time Thu–Fri, the MVP gate passes by Thu 18:00, and the vision spike stays within its latency budget.

### Direction C — "Campus Reality Check" (high-risk / high-wow)

**Pitch:** *An explorable, evidence-backed walk through the campus and its city.*

**User experience:** Everything in B, plus:
- a virtual campus walk (photos clustered into places on the map);
- grounded Q&A over verified photos;
- a life-around-campus card (climate, transit);
- compare with an evidence diff.

**In scope:** B + #11, #14, #15, extras.

**Effort:** ~150–190 build hours + ~15 h deliverables.

**Probability of shipping polished:** ~20–30%.

**Strengths:** wow factor, final-round presentation, originality.

**Weaknesses:** stability and accuracy risk on unseen universities (sparse clusters, hallucinated answers), pressure on the speed budget, and a judges' unseen-university test that will expose thin data.

**Choose if:** the team is unusually strong (≥2 experienced full-stack developers + 1 ML-minded member), fully available, and B's layers are done by Fri 12:00. That's unlikely.

### Expected profile against the rubrics (subjective, assuming the plan is executed)

| Criterion | A | B | C |
|---|---|---|---|
| Accuracy (30 / final 20) | ●●●○ | ●●●● | ●●●○ (more surface for errors) |
| Technical implementation (25 / 15) | ●●○○ | ●●●● | ●●●○ |
| UX (20 / 10) | ●●●○ | ●●●○ | ●●○○ (clutter, less polish) |
| Speed (15) | ●●●● | ●●●○ | ●●○○ |
| Scalability / originality (10) | ●●○○ | ●●●○ | ●●●● |
| Final: functionality and stability (20) | ●●●● | ●●●○ | ●●○○ |
| Final: presentation and Q&A (15) | ●●○○ | ●●●● | ●●●● |
| **Probability of shipping polished** | **~85%** | **~60% full / ~88% ≥A** | **~25%** |

---

## 7. How to choose

You don't have to pick a ceiling tonight. Because the directions are nested, pick at the checkpoints, using data.

**Decision questions** (answer honestly tonight):
1. How many hours can each person *really* work on Thu and Fri, given school or university?
2. Has anyone on the team shipped a deployed web app with a backend/API before?
3. Is there an adult who can own billing for the AI and search APIs **tonight**?
4. Did the spikes show usable photos for Kazakh universities (≥15 relevant candidates for at least 4 of 5 test universities)?
5. Did the vision spike meet the latency budget (an 8-image batch ≤8 s at p90)?

**Capacity rule of thumb** (details in [roadmap §2](roadmap.md#2-capacity-reality-check)):

| Effective build capacity (after deliverables and overhead) | Realistic ceiling |
|---|---|
| < 70 h (several members have classes) | A, possibly with A-minimum cuts |
| 70–95 h | A, plus selected B items (#2 full, #9) |
| 95–125 h (near full-time, strong execution) | B without stretch items |
| 125–150 h | B plus stretch items (compare, flags) |
| > 150 h | C territory. Not realistic for this team size and window |

**Checkpoint gates** (the exact cut rules are in [roadmap §6](roadmap.md#6-cut-lines)):

| Checkpoint | Question | If yes | If no |
|---|---|---|---|
| CP0: Thu 00:30 | Spikes OK (KZ coverage, vision latency, streaming on Vercel)? | Keep B possible | Plan for A |
| CP1: Thu 13:00 | Deployed URL resolves a university and returns real candidates? | Stay on course | Drop ceiling to A; pair on blockers |
| CP2: Thu 18:00 | MVP end-to-end, p50 < 30 s on 10 universities? | Start B layers | A polish and stability only |
| CP3: Fri 14:00 | B layers working and nothing critical open? | Stretch items allowed until 19:00 | Cut remaining layers; stabilize |

---

## 8. What can be mocked, simplified, or precomputed

| Item | Approach | Why it's integrity-safe | Disclose in README |
|---|---|---|---|
| University index | Generated by our script from Wikidata + the open university-domains list; committed JSON | Public data about names and locations, not results; reproducible | Yes |
| Stock / news / social domain lists | Hand-written generic lists | Rules, not per-university results | Yes |
| Category definitions and query templates | Config file | Generic | Yes |
| Profile cache | TTL of 14 days; labeled "saved profile"; one-click live refresh | Real pipeline outputs, clearly labeled | Yes |
| Benchmark numbers | Script output with date, sample size, and split | Measured and reproducible | Yes |
| Distance to center | Straight-line (haversine), labeled as such | Honest approximation | Yes |
| Confidence | Evidence points + tiers, not a calibrated probability | Transparent formula | Yes |
| Description | Built only from fetched sources, with citations; Wikipedia extract as fallback | Grounded | Yes |
| Near-duplicate grouping | Perceptual hash + flags within verification batches | Documented method with stated limits | Yes |
| Fixture JSON for UI development | Development only; never used in production | Never shown to users | Don't ship it |
| **Never** | Hand-picked photos, fake progress animations, hard-coded "demo" universities, typed confidence values, a sped-up video of the pipeline | Forbidden by the case | — |

---

## 9. Automated vs. manually controlled

**Always automated** (the product itself):

| Area | What's automated |
|---|---|
| Pipeline | Resolve, search, fetch, dedup, reuse detection, visual observations, scoring, categorization, description |
| Resilience | Per-source timeouts, retries, global deadline, degraded modes with banners, caching, rate limits, budget guard |
| Engineering | Push to `main` → Vercel deploy; PR checks (typecheck, lint, unit tests); index build script; eval and latency bench scripts; `/api/health` check |

**Manually controlled during the demo** (presentation choices, never result manipulation):

| Control | How |
|---|---|
| Which universities to show | Chosen from **real** outputs after running the test matrix; include one with thin data. Never tune code for them |
| Cold run vs. saved profile | Use the documented refresh parameter for a genuine live run. Saved profiles show their cache badge |
| Demonstrating resilience | Use the documented `?simulate=web_search_down` switch, and explain what it does |
| Environment | Clean browser profile, 110–125% zoom, notifications off, pre-opened tabs, wired network + phone hotspot backup |
| Narration and pacing | Rehearsed script; one driver, one speaker |
| Fallback ladder | Live cold run → labeled saved permalink → recorded video segment |

**Never manual:** editing results, choosing which photos appear, adjusting confidence, faking progress.

---

## 10. Demo plan

### 10.1 Picking demo universities (Fri, after the test-matrix run)
1. Run the full judge-simulation matrix on production ([roadmap §9](roadmap.md#9-qa-plan-and-judge-simulation-matrix)).
2. Pick examples that are **representative, not outliers**: one ambiguous query, one Kazakh university with good data, one with thin data (to show honesty), and optionally one international university.
3. Freeze the choice, and record the video from production in real time.

### 10.2 Demo video (≤3:00)

| Time | Screen | Voice-over beat |
|---|---|---|
| 0:00–0:15 | A real mixed image-search result for a Kazakh university (other universities, stock, renders, repeats) | "Applicants choose universities from ads and messy search results. Which of these photos actually shows this university?" |
| 0:15–0:25 | Product home: search box, one-line promise | "Type a name. Get a verified visual profile in under 30 seconds, and every photo comes with proof." |
| 0:25–1:05 | **Live, uncut run:** type an ambiguous abbreviation → pick-list → choose → pipeline rail (sources, counts) → photos stream into categories → timer stops | Narrate the stages as they happen: "resolving… searching Wikimedia and the web in Russian and English… removing duplicates… verifying…" |
| 1:05–1:35 | Click the "общежитие" filter → open a photo → evidence card → click the source link | "Why do we trust this? It's on the official site, the sign reads the university name, and it was taken 400 meters from campus. Here's the original page." |
| 1:35–1:55 | Scroll to "Filtered out" → duplicates, a stock image, a photo of another university; then a thin category state | "We show what we rejected and why. And when we can't confirm dorm photos, we say so instead of guessing." |
| 1:55–2:15 | Type a misspelled name → auto-resolved; optionally the simulated source outage banner | "Typos and outages don't break it." |
| 2:15–2:40 | How-it-works / benchmark: signals, tiers, measured precision, median time | "On held-out universities, N% of 'Verified' photos were correct; median time was X seconds." (Real numbers only.) |
| 2:40–2:55 | Architecture thumbnail + "any university, no manual work" | "No manual curation. New sources and categories plug in by configuration." |
| 2:55–3:00 | Name + team | — |

**Recording rules:** record from production, keep the pipeline segment in real time (no cuts or speed-ups during the timer), and use only real numbers.

### 10.3 Final defense run-of-show (5:00 on Google Meet)

| Time | Content | Owner |
|---|---|---|
| 0:00–0:40 | Problem + insight ("proof, not pictures") | Speaker 1 |
| 0:40–3:10 | Live demo: ambiguous query → live run → evidence → filtered-out → honest gap. If the test matrix is reliably green, invite a judge to **name any university** | Driver + Speaker 2 |
| 3:10–4:10 | How verification works + measured accuracy + limitations | Speaker 2 |
| 4:10–4:40 | Architecture, cost per profile, scalability, where it plugs in | Speaker 1 |
| 4:40–5:00 | Close | Speaker 1 |

**Fallback ladder** (decide the trigger in advance): no first photos after 15 s → switch to a saved permalink (say it's saved) → if the site is unreachable, play the recorded segment from the slides.

---

## 11. Pitch and Q&A prep

**Narrative arc:** Applicants can't trust campus photos → we built a pipeline that finds photos *and proves them* → it's fast, honest about gaps, and measurable → it works for any university with no manual work → it could plug into admissions platforms.

**Likely judge questions and answer outlines:**

| # | Question | Answer outline |
|---|---|---|
| 1 | How do you know a photo belongs to the university? | Several independent signals: provenance (Commons category / depicts / official domain / Wikipedia usage), geotag distance, visible signage text, cross-source agreement. AI reports observations; a documented, unit-tested formula decides the tier; the evidence is visible per photo |
| 2 | What's your error rate? | Labeled set of N photos across M universities; precision of Verified on the held-out split; known failure modes |
| 3 | Isn't the confidence score arbitrary? | Deterministic, documented weights, tuned on a separate split, unit-tested. We call it evidence points, not a probability |
| 4 | What happens when there are no photos? | Coverage states and a toggle for unconfirmed images. We'd rather show nothing than something wrong |
| 5 | Copyright and licensing? | No re-hosting of full images; every photo links to its source; Commons license and author shown; a report button for removal requests |
| 6 | Why not just Google Images? | No provenance, duplicates, other universities, stock and renders. We add verification, structure, and honesty |
| 7 | Is using a search-results API allowed? | Disclosed in the README; the case allows search APIs. Adapters make providers swappable; the core proof comes from open data |
| 8 | Cost and scale? | ~$0.05–0.25 per fresh profile depending on the model; cached views are free; the reuse index gets better with volume; top universities can be pre-indexed with batch processing |
| 9 | Universities with multiple campuses? | Geo rules stay neutral within the same city; future work: OSM campus polygons per site |
| 10 | What's AI vs. your own logic? | AI: image type, category, visible text, near-duplicate flags, description writing with citations. Our code: resolver, retrieval, hashing, reuse detection, scoring, tiers, streaming, caching |
| 11 | What was pre-built? | The exact README list (framework, UI kit, libraries, APIs, AI coding assistants) |
| 12 | What's next? | More sources (Flickr, street-level imagery, local maps/directories via partnerships), campus polygons, community verification, a partner API |

---

## 12. UX blueprint

| Screen / state | Must contain |
|---|---|
| **Home** | Value proposition in one line; a single search box with example chips (one ambiguous, one Kazakh, one international); coverage note ("best tested for Kazakhstan, Central Asia, and major international universities"); link to "How we verify" |
| **Pick-list** (ambiguous) | 2–6 cards: name, city, country, founded year, logo/image; a "none of these" option with tips |
| **Not found** | What we tried; suggestions (closest matches); an example of a good query |
| **Profile (streaming)** | Header: name, city/country, website, key facts, live timer or cache badge. Pipeline rail and source chips. Filter bar with the 4 required filters + a "show unconfirmed" toggle (+ source type in B). Category sections (campus, dormitories, classrooms, libraries, city + sports, labs, student life). Coverage states. Description with citations. Map (B). Filtered-out section. Footer: methodology link |
| **Photo card** | Thumbnail, tier badge (icon + text, never color alone), source domain, date and its type |
| **Evidence dialog** | Large image; tier + plain-language verdict; ✓/✗ evidence list; "Open source" button; date and type; license/author; distance from campus; "also found at"; report button |
| **Degraded banners** | Which source or check is unavailable and what that means for the results |
| **How we verify** | Pipeline diagram, signals and tiers, sources, limitations, benchmark numbers |
| **Mobile** | Horizontal-scroll filter chips; 2-column grid; bottom-sheet evidence dialog |

**Tier visual language:** Verified ✓ (solid), Likely ◐, Unconfirmed ? (muted, behind a toggle), Rejected ✕ (filtered-out section only). Always pair color with an icon and text.

---

## 13. Naming

The team decides. Candidates: **CampusProof**, **TrueCampus**, **Unitrace**, **Kampus Lens**. Check that the name isn't an existing product with a similar purpose, and don't reuse the organizer's brand.
