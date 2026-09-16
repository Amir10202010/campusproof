# Python-скрипты (P3 · Data & Eval)

Офлайн-скрипты: спайки, индекс университетов, разметка и оценка качества.
Они **не** входят в веб-приложение. С приложением общаются только через файлы (`data/`, `eval/`, `lib/vision/prompt.ts`) и HTTP API продакшена.

## Установка

```bash
cd scripts/python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Ключи берутся из `.env.local` в корне репозитория (его создаёт каждый у себя, в git он не попадает):

```
ANTHROPIC_API_KEY=...
SERPER_API_KEY=...
```

## Правила

- **Wikimedia (Wikidata / Commons / Wikipedia / SPARQL) вызывать только через `common.wm_get()`.** Без правильного User-Agent лимит около 10 запросов в минуту. Ответы кешируются в `.cache/`, повторные запуски бесплатны.
- Поиск картинок — только через `common.serper_images()`. Ответы тоже кешируются, чтобы не тратить бесплатные 2 500 запросов.
- Разметка из `eval/labels` **никогда** не используется приложением в рантайме, только для метрик.

## Скрипты

| Скрипт | Задача | Результат |
|---|---|---|
| `spike_commons_yield.py` | S2: сколько пригодных фото есть на Commons у тестовых вузов | `eval/spikes/s2_commons.json` + таблица в `docs/spikes.md` |
| `spike_search_yield.py` | S3: сколько релевантных картинок даёт Serper для KZ-вузов (RU/EN) | `eval/spikes/s3_search.json` + HTML-лист для ручной оценки |
| `spike_vision.py` | S4: выбор vision-модели (точность, латентность, стоимость) | `eval/spikes/s4_vision.json` + решение в `docs/spikes.md` |
| `build_index.py` | Индекс университетов для резолвера | `data/universities.min.json` (формат `UniversityIndexEntry` из `lib/types.ts`) |
| `label_sheet.py` | HTML-лист для разметки кандидатов пайплайна | `eval/labels/<qid>.json` |
| `eval_run.py` | Метрики качества по продакшен-API | `eval/results/<дата>.json` + `.md` |

Запуск: `python spike_commons_yield.py` (из папки `scripts/python` с активированным venv).
