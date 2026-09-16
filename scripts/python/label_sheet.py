"""Generate an HTML labeling sheet from real pipeline candidates.

Owner: P3 · Spec: docs/architecture.md §10 (evaluation harness)

Input: a profile JSON from production (GET /api/profile/<qid>, available after P1 ships the cache)
       — it contains photos (all tiers) and rejected items → sample ~20–25 per university, including rejects.
Output: eval/labels/sheets/<qid>.html — thumbnails with radio buttons:
          belongs: yes / no / unsure · true category · is duplicate of … · stock/render
        The page has a "Download JSON" button → save as eval/labels/<qid>.json:
          [{"imageUrl": "...", "sourcePageUrl": "...", "belongs": "yes", "category": "library",
            "duplicateOf": null, "stockOrRender": false}]
Split: 6 universities → eval/labels/tune/, 6 → eval/labels/test/ (never tune thresholds on test).
"""

from __future__ import annotations


def main() -> None:
    # TODO(P3): fetch profile JSON, sample candidates, render HTML with a small inline <script> that exports JSON
    raise NotImplementedError


if __name__ == "__main__":
    main()
