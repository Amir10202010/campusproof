# QA-отчёт: smoke-тест — 2026-09-18, вечер (после заморозки)

> Сгенерирован `node scripts/qa/smoke.mjs` (P4 · #39). База: https://campusproof.vercel.app · refresh: нет (сохранённые профили) · запросов: 27 · начало: 2026-09-18 18:18 UTC.

**Итог:** ✅ 25 · ⚠️ 2 · ❌ 0 · ⏭️ 0

## Разбор (P4)

Прогон после заморозки, на том же наборе из 27 запросов, что и [утренний](qa-report-2026-09-18.md) (01:31 UTC). Все профили собраны заново: деградированные профили не сохраняются, поэтому у всех «Кеш: нет».

- **Нарушений правил честности нет (0 FAIL).** В 21 профиле 603 фото; у каждого есть ссылка на источник `http(s)`, дата получения и допустимый уровень. Очки каждого фото равны сумме его доказательств, панель «Что удалось подтвердить» совпадает с фото.
- **Скорость** считается от отправки запроса до события на клиенте, по 21 профилю:

  | Момент | Медиана | Максимум |
  |---|---|---|
  | Вуз определён | 0,4 с | 1,7 с |
  | Первые фото | 3,2 с | 5,9 с |
  | Готовый профиль | 3,3 с | 6,0 с |

  Предел по кейсу — 30 с.
- **Уровни.** 18 обычных профилей (14 разных вузов, без симуляций сбоев) дали 534 фото:

  | Уровень | Фото | Доля |
  |---|---|---|
  | ✓ Проверено | 70 | 13,1 % |
  | ◐ Вероятно | 375 | 70,2 % |
  | ? Не подтверждено (скрыто по умолчанию) | 89 | 16,7 % |

  На профиль приходится от 21 до 35 фото, медиана 30,5. В пяти профилях из 18 нет ни одного «Проверено»: Satbayev University, Korkyt Ata Kyzylorda University, Karaganda Buketov University, Kozybayev University и American University of Central Asia. Их фото не набирают 60 очков. Одна категория Commons даёт 40 очков. Добрать до «Проверено» может геометка у кампуса, статья Википедии или название вуза на снимке, но название видит только визуальная проверка, а она не работала.
- **Что изменилось с утра:**
  - веб-поиск отвечает во всех профилях, 49–60 кандидатов вместо `error` (#83);
  - подключён Openverse (#103);
  - ETH Zurich: было 0 фото из-за тайм-аута Commons, теперь 11 / 21 / 0 за 3,1 с (#85, #98);
  - симуляция `wikimedia_down` даёт профиль с 17 фото из веб-поиска и Openverse. Повторная проверка группы `simulate` в 18:36 UTC: все три сбоя деградируют честно, #110 закрыт.
- **Визуальная проверка не работает ни в одном профиле** (`vision:error`): Gemini отвергает ключ, #96. Уровни ставятся только по происхождению, геометкам и совпадениям источников, описание — цитата из Википедии. Поэтому:
  - ни один профиль не сохраняется в кеш;
  - шаг 10 из README (бейдж «Сохранённый профиль») не воспроизводится;
  - `/compare` показывает «профиль ещё не сохранён».

  Нужен человек с доступом к Vercel: заменить ключ на ключ AI Studio и сделать redeploy.
- **Предупреждения:**
  - `ЕНУ` → «не найден», подсказок 0. При этом `Gumilev` и полное название находят Q127745. Баг у P1, #109.
  - `SDU` → сразу профиль SDU University (Q2370088) вместо списка выбора. Это не ошибка: у элемента Wikidata ярлык «SDU University» совпадает с запросом. В матрице для `SDU` теперь допустимы и профиль, и выбор.
  - `Karaganda Buketov University` по-прежнему ведёт на элемент Q133874558 без статьи в Википедии и без Commons. Все 33 фото пришли из веб-поиска (Openverse ничего не нашёл).

| Группа | Запрос | Итог | resolved | первые фото | done | Фото ✓ / ◐ / ? | Источники | Деградация | Кеш | Статус |
|---|---|---|---|---|---|---|---|---|---|---|
| Казахстан, известные | Nazarbayev University | профиль: Назарбаев Университет (Q2783344) | 1,7 с | 4,1 с | 4,2 с | 2 / 26 / 5 | wikipedia:ok(2), web_search:ok(54), commons:ok(92), openverse:ok(15), vision:error(0) | vision_unavailable | нет | ✅ PASS |
| Казахстан, известные | KBTU | профиль: Казахстанско-Британский технический университет (Q1734762) | 0,4 с | 2,7 с | 2,8 с | 6 / 11 / 6 | wikipedia:ok(2), web_search:ok(54), openverse:ok(2), commons:ok(79), vision:error(0) | vision_unavailable | нет | ✅ PASS |
| Казахстан, известные | Satbayev University | профиль: Казахский национальный исследовательский технический университет имени К. И. Сатпаева (Q1513804) | 0,4 с | 3,2 с | 3,2 с | 0 / 33 / 2 | wikipedia:ok(2), web_search:ok(55), commons:ok(67), openverse:ok(4), vision:error(0) | vision_unavailable | нет | ✅ PASS |
| Казахстан, известные | L.N. Gumilyov Eurasian National University | профиль: Евразийский национальный университет имени Л. Н. Гумилёва (Q127745) | 0,4 с | 2,7 с | 2,7 с | 5 / 19 / 4 | wikipedia:ok(2), web_search:ok(57), commons:ok(41), openverse:ok(0), vision:error(0) | vision_unavailable | нет | ✅ PASS |
| Казахстан, известные | KIMEP University | профиль: Казахстанский институт менеджмента, экономики и прогнозирования (Q1046224) | 0,3 с | 3,4 с | 3,4 с | 2 / 16 / 12 | wikipedia:ok(2), web_search:ok(55), commons:ok(75), openverse:ok(0), vision:error(0) | vision_unavailable | нет | ✅ PASS |
| Казахстан, региональные | Korkyt Ata Kyzylorda University | профиль: Кызылординский университет имени Коркыт ата (Q16434809) | 0,3 с | 4,5 с | 4,6 с | 0 / 18 / 13 | wikipedia:ok(1), web_search:ok(57), commons:ok(11), openverse:ok(0), vision:error(0) | vision_unavailable | нет | ✅ PASS |
| Казахстан, региональные | Karaganda Buketov University | профиль: Karaganda Buketov University (Q133874558) | 0,4 с | 4,2 с | 4,2 с | 0 / 31 / 2 | wikipedia:ok(0), web_search:ok(52), commons:ok(0), openverse:ok(0), vision:error(0) | vision_unavailable | нет | ✅ PASS |
| Казахстан, региональные | Kozybayev University | профиль: Северо-Казахстанский государственный университет (Q4412495) | 0,4 с | 3,2 с | 3,3 с | 0 / 16 / 12 | wikipedia:ok(2), web_search:ok(57), commons:ok(54), openverse:ok(0), vision:error(0) | vision_unavailable | нет | ✅ PASS |
| Центральная Азия | American University of Central Asia | профиль: Американский университет в Центральной Азии (Q1141697) | 0,4 с | 5,9 с | 6,0 с | 0 / 25 / 2 | wikipedia:ok(2), web_search:ok(54), commons:ok(24), openverse:ok(0), vision:error(0) | vision_unavailable | нет | ✅ PASS |
| Центральная Азия | Westminster International University in Tashkent | профиль: Международный Вестминстерский университет в городе Ташкенте (Q1552065) | 1,2 с | 4,3 с | 4,3 с | 3 / 17 / 1 | wikipedia:ok(1), web_search:ok(49), commons:ok(80), openverse:ok(6), vision:error(0) | vision_unavailable | нет | ✅ PASS |
| Международные | Harvard University | профиль: Гарвардский университет (Q13371) | 0,9 с | 4,6 с | 4,6 с | 12 / 21 / 1 | wikipedia:ok(2), web_search:ok(60), commons:ok(177), openverse:ok(23), vision:error(0) | vision_unavailable | нет | ✅ PASS |
| Международные | ETH Zurich | профиль: Швейцарская высшая техническая школа Цюриха (Q11942) | 0,5 с | 3,1 с | 3,1 с | 11 / 21 / 0 | wikipedia:ok(2), web_search:ok(59), commons:ok(192), openverse:ok(20), vision:error(0) | vision_unavailable | нет | ✅ PASS |
| Международные | University of Tartu | профиль: Тартуский университет (Q204181) | 0,5 с | 3,7 с | 3,7 с | 13 / 19 / 2 | wikipedia:ok(2), web_search:ok(58), commons:ok(151), openverse:ok(19), vision:error(0) | vision_unavailable | нет | ✅ PASS |
| Неоднозначные | MSU | выбор (2) | — | — | — | 0 / 0 / 0 | — | — | — | ✅ PASS |
| Неоднозначные | SDU | профиль: SDU University (Q2370088) | 0,5 с | 5,9 с | 6,0 с | 1 / 20 / 7 | wikipedia:ok(1), web_search:ok(56), commons:ok(3), openverse:ok(14), vision:error(0) | vision_unavailable | нет | ⚠️ WARN |
| С опечатками | Nazarbaev Univercity | профиль: Назарбаев Университет (Q2783344) | 0,3 с | 2,3 с | 2,4 с | 2 / 26 / 5 | wikipedia:ok(2), web_search:ok(54), commons:ok(92), openverse:ok(15), vision:error(0) | vision_unavailable | нет | ✅ PASS |
| С опечатками | Harvrad | не найден (подсказок: 6) | — | — | — | 0 / 0 / 0 | — | — | — | ✅ PASS |
| С опечатками | Gumilev | профиль: Евразийский национальный университет имени Л. Н. Гумилёва (Q127745) | 1,1 с | 3,9 с | 4,0 с | 5 / 19 / 4 | wikipedia:ok(2), web_search:ok(57), commons:ok(41), openverse:ok(0), vision:error(0) | vision_unavailable | нет | ✅ PASS |
| Кириллица и сокращения | КБТУ | профиль: Казахстанско-Британский технический университет (Q1734762) | 0,5 с | 2,7 с | 2,8 с | 6 / 11 / 6 | wikipedia:ok(2), web_search:ok(54), commons:ok(79), openverse:ok(2), vision:error(0) | vision_unavailable | нет | ✅ PASS |
| Кириллица и сокращения | ЕНУ | не найден (подсказок: 0) | — | — | — | 0 / 0 / 0 | — | — | — | ⚠️ WARN |
| Кириллица и сокращения | Назарбаев Университет | профиль: Назарбаев Университет (Q2783344) | 0,5 с | 2,8 с | 2,8 с | 2 / 26 / 5 | wikipedia:ok(2), web_search:ok(54), commons:ok(92), openverse:ok(15), vision:error(0) | vision_unavailable | нет | ✅ PASS |
| Не вуз и мусор | asdfgh | не найден (подсказок: 0) | — | — | — | 0 / 0 / 0 | — | — | — | ✅ PASS |
| Не вуз и мусор | pizza | не найден (подсказок: 0) | — | — | — | 0 / 0 / 0 | — | — | — | ✅ PASS |
| Не вуз и мусор | <script>alert(1)</script> | не найден (подсказок: 0) | — | — | — | 0 / 0 / 0 | — | — | — | ✅ PASS |
| Симуляция сбоев | KBTU · simulate=web_search_down | профиль: Казахстанско-Британский технический университет (Q1734762) | 0,5 с | 2,5 с | 2,6 с | 8 / 21 / 0 | web_search:simulated_down(0), wikipedia:ok(2), commons:ok(79), openverse:ok(2), vision:error(0) | web_search_unavailable, vision_unavailable | нет | ✅ PASS |
| Симуляция сбоев | KBTU · simulate=vision_down | профиль: Казахстанско-Британский технический университет (Q1734762) | 0,3 с | 2,0 с | 2,1 с | 6 / 11 / 6 | wikipedia:ok(2), web_search:ok(54), commons:ok(79), openverse:ok(2), vision:simulated_down(0) | vision_unavailable | нет | ✅ PASS |
| Симуляция сбоев | KBTU · simulate=wikimedia_down | профиль: Казахстанско-Британский технический университет (Q1734762) | 0,3 с | 2,0 с | 2,1 с | 0 / 7 / 10 | wikipedia:simulated_down(0), commons:simulated_down(0), web_search:ok(54), openverse:ok(2), vision:error(0) | wikimedia_unavailable, vision_unavailable | нет | ✅ PASS |

## Нарушения и предупреждения

- ⚠️ **SDU** — ожидали ambiguous, получили profile
- ⚠️ **ЕНУ** — ожидали profile, получили not_found
