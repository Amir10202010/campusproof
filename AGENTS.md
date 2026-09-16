<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CampusProof — rules for AI coding assistants

LOCUS Startup Hackathon 2026, Case 01 "Visual University Profile". Direction **B: "Proof, Not Pictures"**.
User types a university name → within 30 s gets a verified, categorized, deduplicated photo profile where
**every photo has a clickable source, a typed date, and a confidence tier backed by recorded evidence**.
Hard deadline: **Sat 19 Sep 2026, 12:00 Astana time**. Feature freeze Fri 19:00.

## Read before coding

1. `docs/plan-thursday.md` — who owns what today, milestones, handoffs.
2. `docs/architecture.md` — the spec (pipeline stages §5, scoring §5.6, contracts §7, security §9).
3. `lib/types.ts` — data contracts. Import types from here; never redefine them.
4. `lib/config/*` — categories (RU labels from the case), domain lists, limits/thresholds.

## Stack (exact)

- Next.js 16.3 App Router + React 19.2 + TypeScript (strict). Turbopack. Node.js 24 runtime.
- Tailwind CSS 4 + **shadcn/ui, Radix base** (`components/ui/*`, style `radix-nova`, icons `lucide-react`).
  Add components with `npx shadcn@latest add <name>`. Use the Radix API (`asChild`), not Base UI's `render` prop.
- zod 4 · `@anthropic-ai/sdk` · sharp · `@upstash/redis` + `@upstash/ratelimit` · minisearch · leaflet/react-leaflet.
- Tests: vitest (`tests/**/*.test.ts`). CI runs `npm run typecheck && npm run lint && npm test`.
- Python (offline scripts only): `scripts/python/` — see its README.

## Commands

```bash
npm run dev        # http://localhost:3000  (fixtures: /dev/fixtures, replay stream: /api/dev/replay)
npm run check      # typecheck + lint + tests — run before every PR
npm run build      # production build
```

## Ownership (don't edit other lanes' files without asking)

| Area | Owner |
|---|---|
| `app/api/**`, `lib/pipeline/**`, `lib/resolver/**`, `lib/sources/{wikidata,wikipedia,commons,geo}.ts`, `lib/cache/**`, `hooks/**`, `app/u/**`, `lib/types.ts`, `package.json`, CI, `vercel.json` | **P1** Pipeline |
| `lib/sources/webSearch/**`, `lib/images/**`, `lib/vision/{claude,schema}.ts`, `lib/scoring/**`, `lib/describe/**`, `lib/config/{categories,domains,limits}.ts` | **P2** Verification |
| `scripts/python/**`, `data/**`, `eval/**`, `lib/vision/prompt.ts`, `docs/spikes.md` | **P3** Data & Eval |
| `components/profile/**`, `components/search/**`, `app/page.tsx`, `app/how-it-works/**`, `app/dev/**`, `fixtures/**`, `public/fixtures/**` | **P4** UI & Product |

- Changing `lib/types.ts` or adding an npm dependency → tell P1 first (contract + lockfile conflicts).
- UI components must be **presentational**: props in, JSX out. No fetching inside `components/profile/*`.

## Integrity rules (breaking these can disqualify the team)

1. **No per-university special cases**: no hard-coded photos, whitelists, overrides, or "demo" universities. Only generic rules/configs.
2. **Confidence is computed in `lib/scoring` from recorded evidence.** Never let an LLM output the score/tier; never type numbers by hand.
3. **No fake progress.** Stream events must mirror real work. Fixtures/replay exist only in dev/preview (`lib/devOnly.ts`).
4. Every shown `Photo` has `sourcePageUrl` (a page the pipeline actually retrieved) and `retrievedAt`.
5. Cached results are labeled as cached with their original generation time.
6. No stock-photo sources; no HTML scraping of Google Images / Instagram / Facebook / VK / 2GIS. Official APIs + open data only.
7. Never ask the vision model to identify people; exclude close-up portraits.
8. Never commit secrets. Keys live in `.env.local` (git-ignored) and Vercel env. Don't print them in logs, issues, or PRs.

## Technical rules

- **Wikimedia (Wikidata/Wikipedia/Commons): always call through `lib/sources/wikimediaFetch.ts`** (sets the required User-Agent; without it the limit is ~10 req/min). Batch requests, cache results.
- Every external call gets an `AbortSignal` and a timeout from `lib/config/limits.ts`. A failing source degrades the profile; it never crashes the request.
- Route handlers run on Node.js (don't export `runtime = "edge"`). Dynamic `params` are Promises: `const { qid } = await params`.
- Server-only modules (`lib/env.ts`, `lib/sources/**`, `lib/vision/**`, `lib/cache/**`) must never be imported from `"use client"` files.
- Streaming: encode with `lib/sse.ts`. Client `EventSource` **must call `.close()` on `done`/`error`**, otherwise it auto-reconnects and re-runs the pipeline (costs money).
- Third-party photos: plain `<img src loading="lazy" referrerPolicy="no-referrer">` with an `onError` fallback. Don't use `next/image` for them.
- Claude API: model id comes from `env.visionModel` (never hard-code it elsewhere). Images: base64 JPEG, long edge 640 px, batches of 8. Validate model output with zod; retry once with a smaller batch; then degrade.
- UI language: **Russian**. Category/filter labels come from `lib/config/categories.ts` (they match the case wording).
- Leaflet must be loaded client-side only (dynamic import with `ssr: false`).

## Git workflow

- Branch per task: `p1/resolver`, `p2/dhash`, `p3/index`, `p4/photo-card`. Small PRs (< ~400 lines).
- PR → CI green → Vercel preview link checked → 1 review (P1↔P2, P1 reviews P4, P2 reviews P3's TS) → squash merge.
- Don't push directly to `main` (P1 hotfixes only). Commit from your own GitHub account; commit early and often.
- Definition of done: works on the preview deploy, `npm run check` passes, issue checklist ticked.
