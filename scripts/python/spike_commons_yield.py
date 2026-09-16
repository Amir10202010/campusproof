"""Spike S2 — how many usable photos does Wikimedia Commons have for our test universities?

Owner: P3 · Deadline: T+3 (13:00) · Spec: docs/architecture.md §5.2 (Commons adapter), §16 (S2)

Output:
  eval/spikes/s2_commons.json — raw counts + sample titles per university
  docs/spikes.md, section "S2"  — a markdown table the whole team can read

For each university:
  1. Resolve name → QID: wbsearchentities (language=en, type=item); pick the result whose
     description mentions "university" / "institute" / "college".
  2. wbgetentities(ids=QID, props=claims) → P373 (Commons category), P625 (coordinates).
  3. Commons, files in Category:<P373>:
       action=query, list=categorymembers, cmtitle=Category:<P373>, cmtype=file, cmlimit=500
  4. Commons, subcategory names (they hint at library/dormitory/sports…):
       action=query, list=categorymembers, cmtitle=Category:<P373>, cmtype=subcat, cmlimit=100
  5. Commons, files that "depict" the QID:
       action=query, list=search, srsearch=haswbstatement:P180=<QID>, srnamespace=6, srlimit=100
  6. Commons, geotagged files within 1000 m of the coordinates:
       action=query, list=geosearch, gscoord=<lat>|<lon>, gsradius=1000, gsnamespace=6, gslimit=100

Then open ~10 sample files for 2 universities in the browser and note how many are useful campus photos.
"""

from __future__ import annotations

from common import COMMONS_API, WIKIDATA_API, wm_get, write_json

TEST_UNIVERSITIES = [
    "Nazarbayev University",
    "Al-Farabi Kazakh National University",
    "Kazakh-British Technical University",
    "Satbayev University",
    "L. N. Gumilyov Eurasian National University",
    "KIMEP University",
    "Suleyman Demirel University",
    "Harvard University",
    "ETH Zurich",
]


def resolve_qid(name: str) -> dict | None:
    data = wm_get(WIKIDATA_API, {"action": "wbsearchentities", "search": name, "language": "en", "type": "item", "limit": 7})
    # TODO(P3): choose the best match (description contains university/institute/college)
    raise NotImplementedError


def commons_counts(qid: str, commons_category: str | None, coords: tuple[float, float] | None) -> dict:
    # TODO(P3): steps 3–6 from the docstring; return counts + up to 5 sample titles per method
    raise NotImplementedError


def main() -> None:
    rows = []
    for name in TEST_UNIVERSITIES:
        # TODO(P3): resolve → claims → commons_counts → rows.append({...})
        pass
    write_json("eval/spikes/s2_commons.json", rows)
    # TODO(P3): print a markdown table and paste it into docs/spikes.md (section S2)


if __name__ == "__main__":
    main()
