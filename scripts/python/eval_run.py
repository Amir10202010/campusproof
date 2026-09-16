"""Compute quality metrics against the deployed API.

Owner: P3 · Spec: docs/architecture.md §10

For each labeled university (eval/labels/<split>/<qid>.json):
  1. GET <BASE_URL>/api/profile/stream?qid=<qid>&refresh=1 (read SSE until `done`) — a cold run, for latency;
     or GET <BASE_URL>/api/profile/<qid> for the cached profile when latency isn't measured.
  2. Match profile photos to labels by imageUrl / sourcePageUrl.
Metrics:
  - precision of tier "verified" (belongs == yes) — target ≥ 90%
  - precision of verified + likely — target ≥ 80%
  - category accuracy on correct photos — target ≥ 85%
  - visible duplicates per profile — target 0
  - cold latency p50 / p90 (timings.totalMs) — targets ≤ 20 s / ≤ 27 s
Output: eval/results/<YYYY-MM-DD>.json and .md (table with sample sizes — numbers for README/slides).
Usage: python eval_run.py --base-url https://<production-url> --split tune
"""

from __future__ import annotations

import argparse


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--split", choices=["tune", "test"], default="tune")
    args = parser.parse_args()
    # TODO(P3): implement (use requests with stream=True to read SSE lines)
    raise NotImplementedError(args)


if __name__ == "__main__":
    main()
