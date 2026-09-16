"""Build data/universities.min.json — the resolver's local index.

Owner: P3 · Deadline: T+6 (16:00) · Consumer: P1 (lib/resolver) · Spec: docs/architecture.md §5.1

Output format: a JSON array of UniversityIndexEntry objects (see lib/types.ts), for example:
  {"qid": "Q…", "names": {"en": "…", "ru": "…", "kk": "…"}, "aliases": ["NU", "…"],
   "country": "Kazakhstan", "countryCode": "KZ",
   "city": {"name": "Astana", "qid": "Q…", "lat": 51.16, "lon": 71.47, "commonsCategory": "Astana"},
   "coords": {"lat": …, "lon": …}, "website": "https://…", "domains": ["…"],
   "commonsCategory": "…", "logo": "….svg", "inception": "2010", "students": 6000,
   "sitelinks": 42, "wikipedia": [{"lang": "ru", "title": "…"}]}

Steps:
  1. SPARQL on WDQS (use common.wm_get with url=WDQS_SPARQL, params={"query": ..., "format": "json"}):
     items with wdt:P31/wdt:P279* wd:Q38723 (higher education institution) —
       a) country in Kazakhstan (Q232), Kyrgyzstan (Q813), Uzbekistan (Q265), Tajikistan (Q863), Turkmenistan (Q874): all items
       b) worldwide: only items with ≥ 30 sitelinks (popular)
     Fields: labels + aliases in en/ru/kk (P1813 short name too), P17 country (+ ISO code P297), P131 → city,
     P625 coords, P856 website, P373 Commons category, P154 logo, P571 inception, P2196 students,
     wikibase:sitelinks, Wikipedia article titles (ru/en/kk).
     Query per country / in chunks — the query service times out after 60 s.
  2. City: for P131, walk up until an item that has coordinates and a Commons category (usually 1 step).
  3. Merge the open university-domains list (https://github.com/Hipo/university-domains-list, MIT) by
     normalized name + country → add domains. Derive domains from P856 too.
  4. Deduplicate by QID, drop items without any label, sort by sitelinks desc.
  5. Write data/universities.min.json (compact, no indent). Print counts per country.
Acceptance: ≥ 300 entries for Kazakhstan + Central Asia; spot-check 10 well-known KZ universities.
"""

from __future__ import annotations

from common import WDQS_SPARQL, wm_get, write_json  # noqa: F401


def main() -> None:
    # TODO(P3): implement steps 1–5
    raise NotImplementedError


if __name__ == "__main__":
    main()
