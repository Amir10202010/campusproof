# Frontend closure · 19 September 2026

Follow-up to #166 and #170, tracked in #171. Backend, scoring, contracts and dependencies are unchanged.

## Changes

- Search-first home with shorter copy; examples are quiet text actions with 44px touch targets.
- Score arithmetic moved to a native disclosure on the methodology page; all 16 current signals are included.
- Trust explanations cover strong evidence, visual contradictions, unavailable vision and hard rejects. Scores are not percentages or exclusive tier ranges.
- Completed pipeline details collapse; source limitations remain visible. Running stages remain expanded.
- First-visit guidance is compact, with an expandable legend and persistent dismissal.

## Browser checks

- Home: light/dark themes, phone and desktop; no horizontal overflow after fixing the grid's min-content sizing.
- Methodology: mobile layout; Enter opens the score disclosure with all 16 rows.
- Replay profile: loading to completion; filter counts, empty laboratories, 12 default photo actions and 14 with unconfirmed photos enabled.
- Pipeline details: keyboard expand/collapse retains source counts and failure explanations.
- Guide: keyboard expansion, dismissal via “Понятно”; stays dismissed on reload.
- Evidence: opens from a photo pin, source/date/evidence visible, mobile dialog fits viewport, Escape closes it.
- Map: 8 SVG paths (campus, city centre, dashed connector, 5 photo pins), tiles present and pin clicks open evidence.
- Responsive checks used phone, tablet and desktop viewports; the browser's existing zoom was retained.
- Clean development profile loads produced no console warnings/errors. The reported Leaflet reuse/appendChild error did not reproduce, so no speculative lifecycle patch or Strict Mode change was made.

## Verification

- `npm run fix`
- `npm run check` (typecheck, lint, formatting, 34 suites / 291 tests)
- `npm run build` (all routes compiled)

Replay data is explicitly fictional and dev-only. These checks do not claim live-source availability or replace the separately assigned Lighthouse/accessibility audit #40.
