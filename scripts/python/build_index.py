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

import re
import urllib.parse
from typing import Any

import requests

from common import REPO_ROOT, WDQS_SPARQL, wm_get, write_json

CENTRAL_ASIA_COUNTRIES = {
    "Q232": "KZ",  # Kazakhstan
    "Q813": "KG",  # Kyrgyzstan
    "Q265": "UZ",  # Uzbekistan
    "Q863": "TJ",  # Tajikistan
    "Q874": "TM",  # Turkmenistan
}

HIPO_URL = "https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json"

SPOT_CHECK_KZ = [
    "Nazarbayev University",
    "Al-Farabi Kazakh National University",
    "Kazakh-British Technical University",
    "Satbayev University",
    "L. N. Gumilyov Eurasian National University",
    "KIMEP University",
    "Suleyman Demirel University",
    "Kazakh National Pedagogical University",
    "Kazakh National Medical University",
    "International Information Technology University",
]

FIELDS_SELECT = """
  ?item
  (SAMPLE(?nameEn) AS ?nameEn) (SAMPLE(?nameRu) AS ?nameRu) (SAMPLE(?nameKk) AS ?nameKk)
  (GROUP_CONCAT(DISTINCT ?altEn; separator="||") AS ?altsEn)
  (GROUP_CONCAT(DISTINCT ?altRu; separator="||") AS ?altsRu)
  (GROUP_CONCAT(DISTINCT ?altKk; separator="||") AS ?altsKk)
  (SAMPLE(?short) AS ?shortName)
  (SAMPLE(?country) AS ?country) (SAMPLE(?countryLabel) AS ?countryLabel) (SAMPLE(?countryCode) AS ?countryCode)
  (SAMPLE(?city) AS ?city)
  (SAMPLE(?coord) AS ?coord)
  (SAMPLE(?website) AS ?website)
  (SAMPLE(?commons) AS ?commons)
  (SAMPLE(?logo) AS ?logo)
  (SAMPLE(?inception) AS ?inception)
  (SAMPLE(?students) AS ?students)
  (SAMPLE(?sitelinks) AS ?sitelinks)
  (SAMPLE(?wpEn) AS ?wpEn) (SAMPLE(?wpRu) AS ?wpRu) (SAMPLE(?wpKk) AS ?wpKk)
"""

FIELDS_WHERE = """
  ?item wdt:P17 ?country .
  ?item wikibase:sitelinks ?sitelinks .
  OPTIONAL { ?country wdt:P297 ?countryCode }
  OPTIONAL { ?item wdt:P131 ?city }
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item wdt:P856 ?website }
  OPTIONAL { ?item wdt:P373 ?commons }
  OPTIONAL { ?item wdt:P154 ?logo }
  OPTIONAL { ?item wdt:P571 ?inception }
  OPTIONAL { ?item wdt:P2196 ?students }
  OPTIONAL { ?item wdt:P1813 ?short . FILTER(lang(?short) = "en") }
  OPTIONAL { ?item rdfs:label ?nameEn . FILTER(lang(?nameEn) = "en") }
  OPTIONAL { ?item rdfs:label ?nameRu . FILTER(lang(?nameRu) = "ru") }
  OPTIONAL { ?item rdfs:label ?nameKk . FILTER(lang(?nameKk) = "kk") }
  OPTIONAL { ?item skos:altLabel ?altEn . FILTER(lang(?altEn) = "en") }
  OPTIONAL { ?item skos:altLabel ?altRu . FILTER(lang(?altRu) = "ru") }
  OPTIONAL { ?item skos:altLabel ?altKk . FILTER(lang(?altKk) = "kk") }
  OPTIONAL { ?wpEnSl schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?wpEn . }
  OPTIONAL { ?wpRuSl schema:about ?item ; schema:isPartOf <https://ru.wikipedia.org/> ; schema:name ?wpRu . }
  OPTIONAL { ?wpKkSl schema:about ?item ; schema:isPartOf <https://kk.wikipedia.org/> ; schema:name ?wpKk . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ru,en". ?country rdfs:label ?countryLabel. }
"""


def sparql_central_asia() -> str:
    values = " ".join(f"wd:{qid}" for qid in CENTRAL_ASIA_COUNTRIES)
    return f"""
SELECT {FIELDS_SELECT}
WHERE {{
  ?item wdt:P31/wdt:P279* wd:Q38723 .
  VALUES ?country {{ {values} }}
  {FIELDS_WHERE}
}}
GROUP BY ?item
"""


def sparql_popular_items() -> str:
    """Just the QIDs of universities with >= 30 sitelinks (cheap query, no heavy per-language joins)."""
    return """
SELECT ?item WHERE {
  ?item wdt:P31/wdt:P279* wd:Q38723 .
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 30)
}
"""


def sparql_items_batch(item_qids: list[str]) -> str:
    """Heavy per-field query, scoped to a small, pre-selected batch of items (cheap to join)."""
    values = " ".join(f"wd:{qid}" for qid in item_qids)
    return f"""
SELECT {FIELDS_SELECT}
WHERE {{
  VALUES ?item {{ {values} }}
  {FIELDS_WHERE}
}}
GROUP BY ?item
"""


def run_sparql(query: str) -> list[dict[str, Any]]:
    data = wm_get(WDQS_SPARQL, {"query": query}, timeout=90.0)
    return data.get("results", {}).get("bindings", [])


def qid_from_uri(uri: str | None) -> str | None:
    if not uri:
        return None
    return uri.rsplit("/", 1)[-1]


def parse_point(value: str | None) -> tuple[float, float] | None:
    if not value:
        return None
    match = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", value)
    if not match:
        return None
    lon, lat = float(match.group(1)), float(match.group(2))
    return lat, lon


def split_multi(value: str | None) -> list[str]:
    if not value:
        return []
    return [v for v in value.split("||") if v]


def commons_filename(url: str | None) -> str | None:
    if not url:
        return None
    name = urllib.parse.unquote(url.rsplit("/", 1)[-1])
    return name


def row_to_entry(binding: dict[str, Any]) -> dict[str, Any]:
    def val(key: str) -> str | None:
        return binding.get(key, {}).get("value")

    qid = qid_from_uri(val("item"))
    names = {
        "en": val("nameEn"),
        "ru": val("nameRu"),
        "kk": val("nameKk"),
    }
    names = {k: v for k, v in names.items() if v}

    aliases = set()
    aliases.update(split_multi(val("altsEn")))
    aliases.update(split_multi(val("altsRu")))
    aliases.update(split_multi(val("altsKk")))
    short = val("shortName")
    if short:
        aliases.add(short)
    aliases.discard(names.get("en"))
    aliases.discard(names.get("ru"))
    aliases.discard(names.get("kk"))

    website = val("website")
    domains = []
    if website:
        try:
            netloc = urllib.parse.urlparse(website).netloc.lower()
            netloc = netloc.removeprefix("www.")
            if netloc:
                domains.append(netloc)
        except ValueError:
            pass

    inception_raw = val("inception")
    inception = inception_raw[:4] if inception_raw else None

    students_raw = val("students")
    students = None
    if students_raw:
        try:
            students = int(float(students_raw))
        except ValueError:
            students = None

    sitelinks_raw = val("sitelinks")
    sitelinks = int(sitelinks_raw) if sitelinks_raw else 0

    coord = parse_point(val("coord"))

    wikipedia = []
    for lang, key in (("en", "wpEn"), ("ru", "wpRu"), ("kk", "wpKk")):
        title = val(key)
        if title:
            wikipedia.append({"lang": lang, "title": title})

    entry = {
        "qid": qid,
        "names": names,
        "aliases": sorted(a for a in aliases if a),
        "country": val("countryLabel") or "",
        "countryCode": val("countryCode") or "",
        "_cityQid": qid_from_uri(val("city")),
        "coords": {"lat": coord[0], "lon": coord[1]} if coord else None,
        "website": website,
        "domains": domains,
        "commonsCategory": val("commons"),
        "logo": commons_filename(val("logo")),
        "inception": inception,
        "students": students,
        "sitelinks": sitelinks,
        "wikipedia": wikipedia,
    }
    return entry


def sparql_city_batch(qids: list[str]) -> str:
    values = " ".join(f"wd:{q}" for q in qids)
    return f"""
SELECT ?city (SAMPLE(?nameEn) AS ?nameEn) (SAMPLE(?nameRu) AS ?nameRu)
       (SAMPLE(?coord) AS ?coord) (SAMPLE(?commons) AS ?commons) (SAMPLE(?parent) AS ?parent)
WHERE {{
  VALUES ?city {{ {values} }}
  OPTIONAL {{ ?city rdfs:label ?nameEn . FILTER(lang(?nameEn) = "en") }}
  OPTIONAL {{ ?city rdfs:label ?nameRu . FILTER(lang(?nameRu) = "ru") }}
  OPTIONAL {{ ?city wdt:P625 ?coord }}
  OPTIONAL {{ ?city wdt:P373 ?commons }}
  OPTIONAL {{ ?city wdt:P131 ?parent }}
}}
GROUP BY ?city
"""


def resolve_cities(city_qids: set[str]) -> dict[str, dict[str, Any]]:
    """Walk up P131 (up to 3 hops) until each city has coords + a Commons category."""
    info: dict[str, dict[str, Any]] = {}
    current = {q: q for q in city_qids if q}  # original city qid -> qid to look up this round
    for _hop in range(3):
        if not current:
            break
        lookup_qids = sorted(set(current.values()))
        batches = [lookup_qids[i : i + 250] for i in range(0, len(lookup_qids), 250)]
        fetched: dict[str, dict[str, Any]] = {}
        for batch in batches:
            bindings = run_sparql(sparql_city_batch(batch))
            for binding in bindings:

                def val(key: str) -> str | None:
                    return binding.get(key, {}).get("value")

                cqid = qid_from_uri(val("city"))
                fetched[cqid] = {
                    "nameEn": val("nameEn"),
                    "nameRu": val("nameRu"),
                    "coord": parse_point(val("coord")),
                    "commons": val("commons"),
                    "parent": qid_from_uri(val("parent")),
                }

        next_round: dict[str, str] = {}
        for original_qid, lookup_qid in current.items():
            data = fetched.get(lookup_qid)
            if not data:
                continue
            existing = info.get(original_qid, {})
            name = existing.get("nameRu") or existing.get("nameEn") or data["nameRu"] or data["nameEn"]
            coord = existing.get("coord") or data["coord"]
            commons = existing.get("commons") or data["commons"]
            info[original_qid] = {
                "nameEn": existing.get("nameEn") or data["nameEn"],
                "nameRu": existing.get("nameRu") or data["nameRu"],
                "coord": coord,
                "commons": commons,
                "name": name,
            }
            if (not coord or not commons) and data.get("parent"):
                next_round[original_qid] = data["parent"]
        current = next_round
    return info


def load_hipo_domains() -> dict[tuple[str, str], list[str]]:
    """normalized (name, country) -> domains, from the Hipo open university-domains-list."""
    cache_path = REPO_ROOT / "scripts" / "python" / ".cache" / "hipo_universities.json"
    if cache_path.exists():
        import json

        raw = json.loads(cache_path.read_text(encoding="utf-8"))
    else:
        response = requests.get(HIPO_URL, timeout=60)
        response.raise_for_status()
        raw = response.json()
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        import json

        cache_path.write_text(json.dumps(raw), encoding="utf-8")

    lookup: dict[tuple[str, str], list[str]] = {}
    for row in raw:
        key = (normalize_name(row.get("name", "")), (row.get("country") or "").strip().lower())
        lookup[key] = row.get("domains", [])
    return lookup


def normalize_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def main() -> None:
    all_entries: dict[str, dict[str, Any]] = {}

    print("Fetching Central Asia universities...")
    ca_bindings = run_sparql(sparql_central_asia())
    for binding in ca_bindings:
        entry = row_to_entry(binding)
        if entry["qid"]:
            all_entries[entry["qid"]] = entry
    print(f"  Central Asia: {len(ca_bindings)} rows")

    print("Fetching worldwide universities (sitelinks >= 30)...")
    item_bindings = run_sparql(sparql_popular_items())
    item_qids = sorted({qid_from_uri(b["item"]["value"]) for b in item_bindings if b.get("item")})
    print(f"  {len(item_qids)} items have sitelinks >= 30")
    batch_size = 150
    total_batches = (len(item_qids) + batch_size - 1) // batch_size
    for i in range(0, len(item_qids), batch_size):
        batch = item_qids[i : i + batch_size]
        bindings = run_sparql(sparql_items_batch(batch))
        for binding in bindings:
            entry = row_to_entry(binding)
            if entry["qid"] and entry["qid"] not in all_entries:
                all_entries[entry["qid"]] = entry
        print(f"  batch {i // batch_size + 1}/{total_batches}: {len(bindings)} rows")

    print(f"Total unique entities before filtering: {len(all_entries)}")

    entries = [e for e in all_entries.values() if e["names"]]
    print(f"After dropping entries without any label: {len(entries)}")

    city_qids = {e["_cityQid"] for e in entries if e["_cityQid"]}
    print(f"Resolving {len(city_qids)} city entities...")
    city_info = resolve_cities(city_qids)

    hipo_domains = load_hipo_domains()

    for entry in entries:
        city_qid = entry.pop("_cityQid")
        city_data = city_info.get(city_qid) if city_qid else None
        if city_data and (city_data.get("coord") or city_data.get("commons") or city_data.get("name")):
            coord = city_data.get("coord")
            entry["city"] = {
                "name": city_data.get("name") or "",
                "qid": city_qid,
                "lat": coord[0] if coord else None,
                "lon": coord[1] if coord else None,
                "commonsCategory": city_data.get("commons"),
            }
            entry["city"] = {k: v for k, v in entry["city"].items() if v is not None}
        else:
            entry["city"] = None

        name_en = entry["names"].get("en")
        key = (normalize_name(name_en or ""), entry["country"].strip().lower())
        extra_domains = hipo_domains.get(key, [])
        domains = set(entry["domains"]) | set(extra_domains)
        entry["domains"] = sorted(domains)

        entry["coords"] = entry["coords"] or None
        for optional_key in ("website", "commonsCategory", "logo", "inception", "students", "city", "coords"):
            if entry.get(optional_key) is None:
                entry.pop(optional_key, None)

    entries.sort(key=lambda e: e["sitelinks"], reverse=True)

    target = REPO_ROOT / "data" / "universities.min.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    import json

    target.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    size_mb = target.stat().st_size / (1024 * 1024)
    print(f"\nWrote {len(entries)} entries to {target} ({size_mb:.2f} MB)")

    by_country: dict[str, int] = {}
    for e in entries:
        by_country[e["countryCode"]] = by_country.get(e["countryCode"], 0) + 1
    for code, count in sorted(by_country.items(), key=lambda kv: -kv[1])[:15]:
        print(f"  {code or '??'}: {count}")

    print("\nSpot-check KZ universities:")
    by_name = {}
    for e in entries:
        for lang_name in e["names"].values():
            by_name[normalize_name(lang_name)] = e
        for alias in e["aliases"]:
            by_name.setdefault(normalize_name(alias), e)

    for name in SPOT_CHECK_KZ:
        match = by_name.get(normalize_name(name))
        if match:
            city_name = (match.get("city") or {}).get("name", "—")
            print(f"  OK  {name} -> {match['qid']} city={city_name} commons={match.get('commonsCategory')} aliases={match['aliases'][:5]}")
        else:
            print(f"  MISSING  {name}")


if __name__ == "__main__":
    main()
