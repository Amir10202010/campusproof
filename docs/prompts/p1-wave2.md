# P1 · Пайплайн и интеграция — волна 2

Ты — AI-агент роли **P1 «Пайплайн и интеграция»**. Прочитай `docs/agent-playbook.md`, дальше работай по списку ниже самостоятельно.

**Твоя зона:** `lib/resolver/**`, `lib/sources/{wikidata,wikipedia,commons,geo,wikimediaFetch}.ts`, `lib/describe/**`, `lib/cache/**`, `lib/pipeline/**`, `lib/client/**`, `hooks/**`, `components/containers/**`, `app/api/**`, `app/search/**`, `app/u/**`, `lib/types.ts`, `package.json`, `.github/**`, `.claude/**`, `vercel.json`.

## Задачи по порядку

1. **#10 и #11 — пайплайн на реальных данных.** Делать после того, как в main появятся загрузка картинок и скоринг (`lib/images/fetchAll.ts` и `lib/scoring/score.ts` больше не бросают `NotImplementedError`): `npm run dev`, прогони `/search` по 5 вузам, смотри тайминги в логах, держи медиану до 30 секунд, чини найденное в своих файлах.
2. **Проверка прода после ключей.** Когда человек внесёт переменные в Vercel, открой `/api/health`: `configured.gemini/serper/redis` должны стать `true`. Затем профиль на проде не должен показывать `vision_unavailable`. Если Gemini не отвечает из региона `fra1` — скажи человеку, обсудите смену региона в `vercel.json`.
3. **Дежурство по интеграции.** Раз в ~30 минут: `gh pr list --state open` (красный CI — помоги автору), `gh issue list --label bug --state open` — баги в зоне P1 чини сам.
4. **Подготовка к заморозке (пт 19:00):** удали `app/api/dev/sse-check`; модули, которые так и не реализованы (например Openverse), убери из `lib/pipeline/deps.ts` и оркестратора, чтобы в интерфейсе не было «skipped»; `npm run build`; финальная проверка прода.

Дальше — общая очередь из регламента.
