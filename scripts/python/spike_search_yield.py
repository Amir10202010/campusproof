"""Spike S3 — how many relevant images does web search return for Kazakh universities?

Owner: P3 · Deadline: T+3 (13:00) · Needs: SERPER_API_KEY · Spec: docs/architecture.md §5.2, §16 (S3)

Plan: 5 Kazakh universities × 4 categories (dormitory, library, lab, sports) × 2 languages (RU, EN)
= 40 queries = 40 Serper credits (results are cached, re-runs are free).

Query templates come from lib/config/categories.ts (copy them here), e.g.:
  RU: '"{name_ru}" общежитие'    EN: '"{name_en}" dormitory'

Output:
  eval/spikes/s3_search.json   — raw results (imageUrl, link, domain, title) per query
  eval/spikes/s3_sheet.html    — contact sheet: thumbnails grouped by query with checkboxes
                                 → count "relevant in top 10" by eye
  docs/spikes.md, section "S3" — table: university × category × language → relevant/10, top domains

Decision it drives (write it in docs/spikes.md): which language/templates work, which domains
look official vs stock, whether we need `site:<official domain>` queries.
"""

from __future__ import annotations

from common import serper_images, write_json

UNIVERSITIES = [
    # (name_en, name_ru)
    ("Nazarbayev University", "Назарбаев Университет"),
    ("Al-Farabi Kazakh National University", "КазНУ имени аль-Фараби"),
    ("Kazakh-British Technical University", "Казахстанско-Британский технический университет"),
    ("Satbayev University", "Сатпаев Университет"),
    ("L. N. Gumilyov Eurasian National University", "Евразийский национальный университет имени Л. Н. Гумилёва"),
]

CATEGORIES = {
    "dormitory": ('"{en}" dormitory', '"{ru}" общежитие'),
    "library": ('"{en}" library', '"{ru}" библиотека'),
    "lab": ('"{en}" laboratory', '"{ru}" лаборатория'),
    "sports": ('"{en}" sports complex', '"{ru}" спорткомплекс'),
}


def main() -> None:
    results = []
    for name_en, name_ru in UNIVERSITIES:
        for category, (tpl_en, tpl_ru) in CATEGORIES.items():
            for lang, query in (("en", tpl_en.format(en=name_en)), ("ru", tpl_ru.format(ru=name_ru))):
                data = serper_images(query, gl="kz", hl=lang)
                results.append({"university": name_en, "category": category, "lang": lang, "query": query,
                                "images": data.get("images", [])[:10]})
    write_json("eval/spikes/s3_search.json", results)
    # TODO(P3): generate eval/spikes/s3_sheet.html (thumbnail grid per query, link to source page)
    # TODO(P3): after judging by eye, write the S3 table + conclusions into docs/spikes.md


if __name__ == "__main__":
    main()
