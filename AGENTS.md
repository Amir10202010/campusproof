<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CampusProof — rules for AI coding assistants

LOCUS Startup Hackathon 2026, Case 01 "Visual University Profile". Direction **B: "Proof, Not Pictures"**.
A user types a university name and, within 30 s, gets a verified, categorized, deduplicated photo profile.
**Every photo has a clickable source, a typed date, and a confidence tier backed by recorded evidence.**
Hard deadline: **Sat 19 Sep 2026, 12:00 Astana time**. Feature freeze Fri 19:00. Four people work in parallel from different computers, each with an AI agent.

## Read before coding

1. **`docs/module-map.md`** — which file is yours, its exact signature, how to see it live. **Start here.**
2. The GitHub issue you're working on (`gh issue view <N> --comments`), including handoff comments from previous sessions.
3. `lib/types.ts` — data contracts. Import types from here; never redefine them.
4. `docs/architecture.md` — the spec: pipeline stages §5, scoring §5.6, security §9.
5. `docs/team-workflow.md` — team process (branches, PRs, handoffs).

## Architecture: contract-first, walking skeleton

- **Every module already exists** with its final exported name and type. Unimplemented ones throw `NotImplementedError(owner, issue)` from `lib/notImplemented.ts`. **Fill in the existing file. Do not create parallel versions or new abstractions.**
- `lib/pipeline/orchestrator.ts` runs all stages. Unimplemented stages are reported as `skipped`, so the app works end-to-end now and lights up as lanes merge. `lib/pipeline/deps.ts` wires every module, so there's no extra wiring to do.
- **UI components already exist with final props** and render plain-text placeholders from real data. `components/containers/ProfileView.tsx` wires stream state to them.
- **Keep exported names, types and props stable.** Changing a contract = issue with label `contract-change` + P1.

## Stack (exact)

- Next.js 16.3 App Router + React 19.2 + TypeScript (strict). Turbopack. Node.js 24 runtime on Vercel (`fra1`).
- Tailwind CSS 4 + **shadcn/ui with the Radix base** (`components/ui/*`, style `radix-nova`, icons `lucide-react`). Use the Radix API (`asChild`), not Base UI's `render` prop.
- zod 4 · `@anthropic-ai/sdk` · sharp · `@upstash/redis` + `@upstash/ratelimit` · minisearch · leaflet/react-leaflet.
- vitest (`tests/**/*.test.ts`) · Prettier (`.prettierrc.json`) · ESLint.
- Python (offline scripts only): `scripts/python/`.

## Commands

```bash
npm run dev     # http://localhost:3000 — real pipeline: /search?q=KBTU · fixture replay: /search?q=demo&replay=1 · /dev/fixtures
npm run fix     # prettier --write + eslint --fix
npm run check   # typecheck + lint + format:check + tests — MUST pass before every PR (CI runs the same)
npm run build   # production build
```

**Team skills (Claude Code), defined in `.claude/skills/`:**

| Skill | Use |
|---|---|
| `/cp-task <issue>` | Take an issue: claim it, branch, implement, test |
| `/cp-ship <issue>` | Rebase, check, commit, push, open PR, enable auto-merge |
| `/cp-sync` | Update the branch from `main` using the ownership conflict rules |
| `/cp-handoff <issue>` | Push the branch and post a progress comment so another computer can continue |
| `/cp-review <pr>` | Review a teammate's PR |
| `/cp-standup` | Checkpoint summary |

Other agents: open the matching `SKILL.md` and follow its steps.

## Ownership (edit only your lane; ask before touching others)

| Area | Owner |
|---|---|
| `lib/resolver/**`, `lib/sources/{wikidata,wikipedia,commons,geo,wikimediaFetch}.ts`, `lib/describe/**`, `lib/cache/**`, `lib/pipeline/**`, `lib/client/**`, `hooks/**`, `components/containers/**`, `app/api/**`, `app/search/**`, `app/u/**`, `lib/types.ts`, `package.json`, `.github/**`, `.claude/**`, `vercel.json` | **P1** Pipeline |
| `lib/images/**`, `lib/sources/webSearch/**`, `lib/sources/classifyDomain.ts`, `lib/vision/{provider,claude,schema,observeAll}.ts`, `lib/scoring/**`, `lib/config/**` | **P2** Verification |
| `scripts/python/**`, `data/**`, `eval/**`, `lib/vision/prompt.ts`, `docs/spikes.md` | **P3** Data & Eval |
| `components/profile/**`, `components/search/**`, `lib/ui/**`, `app/page.tsx`, `app/how-it-works/**`, `app/dev/**`, `fixtures/**`, `public/fixtures/**` | **P4** UI & Product |

- `components/profile/*` and `components/search/*` stay **presentational**: props in, JSX out, no data fetching.
- New npm dependency or change to `lib/types.ts` → ask P1 first (lockfile and contract conflicts).

## Integrity rules (breaking these can disqualify the team)

1. **No per-university special cases:** no hard-coded photos, whitelists, overrides, or "demo" universities. Only generic rules and configs.
2. **Points and tiers are computed only in `lib/scoring`** from recorded evidence. Never let an LLM output the score or tier; never type numbers by hand. Never show an unscored photo.
3. **No fake progress.** Stream events must mirror real work. Fixtures and replay exist only in dev/preview (`lib/devOnly.ts`).
4. Every shown `Photo` has a `sourcePageUrl` (a page the pipeline actually retrieved) and a `retrievedAt`.
5. Cached results are labeled as cached, with their original generation time. Degraded profiles are never cached.
6. No stock-photo sources. No HTML scraping of Google Images / Instagram / Facebook / VK / 2GIS. Official APIs and open data only.
7. Never ask the vision model to identify people; exclude close-up portraits.
8. **Never read, print, or commit secrets** (`.env*`, `.vercel/`). Keys live in `.env.local` and Vercel env.

## Technical rules

- **Wikimedia (Wikidata/Wikipedia/Commons): always call through `lib/sources/wikimediaFetch.ts`.** It sets the required User-Agent; without it the limit is ~10 req/min. Batch requests and cache results.
- **Every external call gets an `AbortSignal` and a timeout** (`withTimeout` in `lib/pipeline/deadline.ts`, values from `lib/config/limits.ts`). A failing source degrades the profile; it never crashes the request.
- **Route handlers** run on Node.js (don't export `runtime = "edge"`). Dynamic `params` and `searchParams` are Promises: `const { qid } = await params`.
- **Server-only modules** (`lib/env.ts`, `lib/sources/**`, `lib/vision/**`, `lib/cache/**`, `lib/pipeline/orchestrator.ts`, `lib/pipeline/deps.ts`) must never be imported from `"use client"` files. Client-safe: `lib/types.ts`, `lib/config/*`, `lib/client/*`, `lib/ui/*`, `lib/pipeline/coverage.ts`.
- **Streaming** goes through `lib/pipeline/events.ts` on the server and `hooks/useProfileStream.ts` on the client. Don't open your own `EventSource` elsewhere: it must close on terminal events or the browser re-runs the paid pipeline.
- **Third-party photos:** plain `<img src loading="lazy" referrerPolicy="no-referrer">` with an `onError` fallback. Don't use `next/image` for them.
- **Claude API:** the model id comes from `env.visionModel` (never hard-code it). Images: base64 JPEG, long edge 640 px, batches of 8. Validate output with zod; retry once with a smaller batch; then degrade.
- **UI language:** Russian. Category and filter labels come from `lib/config/categories.ts` (they match the case wording).
- **Leaflet** loads client-side only (dynamic import with `ssr: false`).

## Git workflow

- `main` is protected: PR + green `check` required, squash merge, auto-merge allowed.
- **Never push to `main` directly and never force-push.**
- One task = one branch (`p1/…`, `p2/…`, `p3/…`, `p4/…`) = one small PR (< ~400 lines) with `Closes #N`.
- Commit messages: English imperative with lane prefix, e.g. `feat(p2): dHash and hamming distance`.
- Before ending a session: push your branch and run `/cp-handoff`. Nothing important may live only on one computer.
