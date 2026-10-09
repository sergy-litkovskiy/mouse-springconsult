# План виконання — price-range-search

Складено за графом [tracker.md](tasks/tracker.md) і тими самими правилами, що й
[план product-creation-flow](../product-creation-flow/execution-plan.md): плейбук
`TMP-DOCS/agentic-tools-playbook.md` (локальний файл, не в git), §2 і §5.3. Статус живе
лише в tracker, а цей файл описує тільки порядок і інструменти. Запуск — `/run-tasks
price-range-search [ID, …]`.

## Як читати

Кожна задача проходить два кроки:

```
гілка → Крок А: виконавець → [між кроками] → Крок Б: /mouse-trading:feature-ship <ID> → [після] → push + PR (ти)
```

| Позначка | Крок А (виконавець) | Коли |
|---|---|---|
| `tdd` | `/tdd <ID>` | поведінку можна покрити тестом, а story править **наявні** файли або створює лише `.ts` |
| `tdd·r` | `/tdd <ID> --review-tests` | те саме, але помилка в тестах коштує дорого: інваріант, квота, межа безпеки |
| `scaf` | `/mouse-trading:feature-scaffold`, обмежений story-файлом | нові файли Angular (`.html`/`.css`) чи обв'язка |
| `goal` | `/goal …` з умовою «do not commit and do not edit tracker.md» | конфіг, SDK чи інфраструктура з бінарним DoD |
| `plan` | інтерактивна сесія в Plan mode | `decision` / `verification`; `feature-ship` не потрібен |
| `docs` | пряма сесія за Checklist story, без агентів | `gate_profile: docs`; Крок Б — `feature-ship` лише закриває story й рядок tracker після gate-check теки `tasks/` |

**Між кроками:** `pw` — перевірка AC через `playwright-cli` на живому стеку до `feature-ship`.
`+обв'язка` — пункти Checklist без поведінки (`index.ts`, composition root), які `/tdd` не
робить: їх дописуєш окремим комітом до Кроку Б.
**Після кроку Б:** `cpr` — `critical-path-review`, `sec` — `security-review`, обидва перед мержем.

**Ціна викликів.** Після гейта T106 пошук іде на платному рівні Gemini (`gemini-3.5-flash-lite`,
[ADR 0026](adr/0026-search-on-the-paid-tier-with-gemini-3-5-flash-lite.md)): ≈ $0,008 за пошук,
пошукові запити — у межах безкоштовних 5 000 на місяць. Тож будь-який `pw` з живим пошуком ціни
платний: лише з дозволу, із сумою до й після. Виклик Claude («Згенерувати все», `both`) теж
платний (≈ $0,05–0,10 за запуск,
[ADR 0018](../../adr/0018-use-sonnet-5-for-card-preparation.md)).

## Перш ніж почати

1. **Розбивку змерджено.** Гілку `docs-price-range-search-tasks` (story, цей план) запушено й
   змерджено в `main` до першої задачі, бо story-файли — вхід для `/tdd`.
2. **Ключ Gemini до T106.** Ключ проєкту в Google AI Studio на free tier іде в `GEMINI_API_KEY`
   у `.env`. T104 і T105 його не потребують, бо тести йдуть без мережі. Але T106 починається саме
   з перевірки, чи ключ відкриває `gemini-2.5-flash`. Створи ключ заздалегідь, щоб гейт не чекав.
3. **Документація `@google/genai` до T105.** Агенти й цикл `/goal` не мають `WebFetch` і писали б
   SDK з пам'яті. У головній сесії перед стартом звір з [ai.google.dev](https://ai.google.dev/gemini-api/docs)
   і README пакета 2.28.0: `models.generateContent`, `tools: [{ googleSearch: {} }]`,
   `httpOptions.timeout`, форму `groundingMetadata` і клас помилки SDK з HTTP-статусом і
   деталями 429. Знайдене впиши в Checklist T105 окремим комітом до `/goal`.

## Доріжки

Граф — у [_epic.md](tasks/_epic.md). Ребра там змістовні, а спільні файли задають ще й
порядок усередині рівня:

- **гейт** (T103 → T104 → T105 → T106). Строго послідовно. Поставка 2 не стартує, поки T106 не
  дасть go. На no-go рядки 5–16 нижче переходять у `Deferred`, а T106 вирішує долю коду T104–T105;
- **`ai`** (`PreparationService.ts`, `AnthropicAdapter.ts`, `worker.ts`): T107 → T112 → T113.
  Спершу прибрати старий пошук, тоді підключити Gemini до `price`, тоді до `both`;
- **контракт запуску** (`ai.contract.ts` і його spec): T108 → T111. Обидві правлять один файл, тож
  T108 іде першою, хоча граф їх не зв'язує;
- **вхід** (`products/preparation/`): T110 → T111. `priceSearchInput` спершу, далі сервіс запуску;
- **форма** (`product-form.*`, `suggestion-field.*`, `run-failure-messages.ts`): T111 (лише виклик
  `lookUpPrice`) → T114 → T115 → T116. T108 теж чіпає `run-failure-messages.ts`, але раніше за всіх;
- **документи** (T103, T117) іншого коду не чіпають.

Один виконавець іде таблицею згори вниз. Дві доріжки можна вести паралельно лише в різних
гілках, і тоді друга ребейзиться на першу.

## Що лишилось

### Поставка 0 і 1 — документи й гейт заміру

| # | ID | Задача | Крок А | Між | Після | Обґрунтування |
|---|----|--------|--------|-----|-------|---------------|
| 1 | T103 | Узгодити PRD, CLAUDE.md і відкриті пункти | `docs` | — | — | Лише документи: PRD §1/§8, кореневий `CLAUDE.md`, `ai/CLAUDE.md`, TBD у `data-model.md`, Section C звіту. `sad.md` §11 закреслюється тут же. Після правок — gate-check теки `tasks/`, бо excerpt-и цитують `sad.md` |
| 2 | T104 | Ключ, константи, SDK, dep-cruiser | `goal` | — | — | Конфіг і межа SDK з бінарним DoD (умова нижче). Новий npm-пакет, тож порядок установки й перебудови образу — частина умови. Тестованої поведінки немає, отже `tdd` нічого б не дав |
| 3 | T105 | `GeminiAdapter` | `goal` **у головній сесії після звірки з документацією SDK** | — | `sec` | Прецедент — T27 product-creation-flow: правильність тут означає актуальну форму API, а агенти `/tdd` пишуть її з пам'яті («Перш ніж почати», п. 3). Тести на кожен варіант результату входять в умову. `sec`, бо це новий секрет і відповідь моделі як недовірений ввід |
| 4 | T106 | Гейт заміру: go / no-go | `plan` | — | — | `decision`: 10 реальних карток, Flash і Flash-Lite, з кадрами й без — ≈ 25–30 запитів квоти, $0. Першим іде один виклик на перевірку доступу до 2.5; без доступу — no-go одразу. Одноразовий скрипт у git не потрапляє. `feature-ship` не потрібен; зміну `config.ts` (модель, кадри) комітить сама сесія |

### Поставка 2 — після go

| # | ID | Задача | Крок А | Між | Після | Обґрунтування |
|---|----|--------|--------|-----|-------|---------------|
| 5 | T107 | Прибрати пошук через Anthropic | `tdd` | — | — | Видалення плюс одна нова поведінка: `price`/`both` закриваються `price_unavailable` без throw. Spec-и старого пошуку (ціна в `AnthropicAdapter.spec.ts`, гілки ціни в `PreparationService.spec.ts`) і їхні хелпери прибрати окремим комітом `test(ai): drop specs of the Anthropic price search` **до** `/tdd`, щоб базова лінія Gate 1 була без них. Рядок `web_search` в `ai/CLAUDE.md` — руками до Кроку Б |
| 6 | T108 | Коди запуску ціни | `tdd` | — | — | XS. Контракт, union `PreparationErrorCode` і два тексти `web` в одному PR, бо `Record` над enum інакше не компілюється. Контракт product-creation-flow — руками до Кроку Б |
| 7 | T110 | `priceSearchInput` | `tdd` | `+обв'язка`: експорт у `products/index.ts` | — | Чиста функція в новому `.ts`, `tdd` її створює. Експорт з `index.ts` — обв'язка без поведінки |
| 8 | T109 | Оголошення в пропозиції `price` | `tdd·r` | — | — | Межа недовіреного вводу: `^https?://`, ≤ 2048, 1–5 оголошень. Тести переглянути до GREEN, бо `javascript:` чи 2049 символів легко пропустити. Seed-и `ProductController.spec.ts` і `PreparationRepository.spec.ts` RED переписує на нову форму, а не видаляє. Контракт product-creation-flow — руками |
| 9 | T111 | Запуск `price` з чернетки | `tdd·r` | смоук: `POST` `scope: price` без опису дає `409` з `missing: [description]`; повтор під час `queued` дає `200`; рядок запуску має `model` Gemini | — | Змінюються ключ ідемпотентності, ліміт і модель запуску, а від `config.ai.pricing` залежить, чи вартість картки стане `null`: тести переглянути до GREEN. Правка `lookUpPrice()` у формі — у тому самому PR. Не `cpr`: репозиторій і міграції не змінюються. Контракт product-creation-flow — руками |
| 10 | T120 | Перевірка оголошень за JSON-LD | `tdd·r` | — | `sec` | Відкриває сторінки майданчиків і розбирає їхній HTML, тож це межа недовіреного вводу: тести переглянути до GREEN. Перед стартом — два рішення зі story: `robots.txt` і умови трьох майданчиків, `NewCondition`. Додано 2026-10-09 рішенням власника ([T106](tasks/measure-price-search-on-ten-cards.md)) |
| 11 | T112 | `price` через Gemini | `tdd·r` | `+обв'язка`: `worker.ts`; смоук: `worker` без ключа стартує з warn, з ключем один `POST` `scope: price` дає `succeeded` або код невдачі, в лозі — рівно один виклик | — | Серцевина фічі: три коди без повтору (QG-1), інваріант вилки (QG-2), жодного `recordUsage`. Тести переглянути до GREEN: «задача не кидає виняток» і «один виклик адаптера» — саме те, що з'їдає квоту, якщо його пропустити. Composition root — обв'язка окремим комітом |
| 12 | T114 | Вилка й оголошення в UI | `scaf` | — | `sec` | Новий компонент `price-listings` з `.html`/`.css`, тож `tdd` упреться в Gate 2. Блок ціни ще схований за `priceLookupEnabled`, тому `pw` нема на чому, і він переходить у T115. `sec`, бо посилання від моделі в UI |
| 13 | T113 | `both`: вилка після текстів | `tdd·r` | — | — | Тексти не губляться за жодного з трьох кодів (AC-04), `recordUsage` — лише для Claude. Тести переглянути до GREEN. Живий `both` платний, тож його перевіряє T116 |
| 14 | T115 | Кнопка «Знайти ціну» | `tdd` | `pw`: без опису кнопка вимкнена з підказкою, опис лише з тегів — теж; змішана пара шукає; вилка під полем, оголошення в новій вкладці, поле ціни порожнє; `price_not_found` і `price_quota_exhausted` — через `page.route` на полінг | — | Правка наявних `product-form.*`, `suggestion-field.*`, `run-failure-messages.ts`, нових файлів немає. Тести прихованої кнопки RED переписує, а не видаляє. `SPEC.md` — руками до Кроку Б |
| 15 | T116 | «Згенерувати все» з ціною | `tdd` | `pw` — один платний «Згенерувати все» ≈ $0,05–0,10, лише з дозволу, суму назвати до й після; невдачу ціни — через `page.route` | — | XS, правка наявного `product-form.ts`. Перевірки `scope === 'texts'` RED переписує на `both` |
| 16 | T119 | Перемикач «Пошук ціни» | `tdd` | `pw`: без запису перемикач вимкнений, «Згенерувати все» стартує `texts`, «Знайти ціну» вимкнена; після ввімкнення й перезавантаження — `both` і кнопка доступна. Старт запуску — через `page.route`, платних викликів немає | — | Правка наявних `product-form.*`, нових файлів немає. Додано 2026-10-09 рішенням власника після гейта ([ADR 0026](adr/0026-search-on-the-paid-tier-with-gemini-3-5-flash-lite.md) №6) |
| 17 | T117 | `ARCHITECTURE.md` і CONTEXT product-creation-flow | `docs` | — | — | Лише документи. Після правки — `grep -n 'web_search'` з DoD story |
| 18 | T118 | Приймання | `plan` | `pw` | — | `verification`: QG-1–QG-3 на живому стеку. Два платні `both` ≈ $0,2 лише з дозволу. Перевірка `pgboss.job` перед деплоєм. Дефекти оформлюються новими задачами |

Кроки з документами в story (`ai/CLAUDE.md`, `SPEC.md`, контракт product-creation-flow) агенти
`/tdd` не роблять, бо правлять лише код. Внеси їх руками до Кроку Б. Для `goal`-задач ці кроки
входять в умову «every Checklist item is done», тож їх робить сам цикл.

## Умови `/goal`

Шаблон і пастки — у [плані product-creation-flow](../product-creation-flow/execution-plan.md),
розділ «Умова `/goal`». `node --test` друкує назви `describe`, а не імена файлів, тож на тест
посилаємось назвою `describe`.

**T104** — пакет ставиться в спільний том `api_node_modules` і перевіряється з образу:

```
/goal docs/features/price-range-search/tasks/add-gemini-config-and-sdk.md: every Checklist item is done, `@google/genai` was installed with `docker compose run --rm --no-deps api npm install @google/genai@2.28.0` followed by `docker compose build api` and never with npm on the host, `docker compose run --rm --no-deps api node --input-type=module -e "await import('@google/genai')"` exits 0, a throwaway `import '@google/genai'` added to `apps/api/src/modules/ai/PreparationService.ts` makes `docker compose run --rm --no-deps api npm run deps:check` exit non-zero naming `google-genai-sdk-stays-in-the-adapter` and is then removed, with `GEMINI_API_KEY` absent from `.env` `docker compose run --rm --no-deps api npm run typecheck`, `lint`, `test` and `deps:check` exit 0, `rg -n 'GEMINI' apps/web` prints nothing, `git diff --stat -- '*.spec.ts'` prints nothing; do not commit and do not edit tracker.md
```

**T105** — новий spec дозволено, решта spec-ів не змінюється:

```
/goal docs/features/price-range-search/tasks/add-gemini-adapter.md: every Checklist item is done, `rg -l '@google/genai' apps/api/src` prints only `apps/api/src/modules/ai/GeminiAdapter.ts`, `rg -n 'retryOptions' apps/api/src` prints nothing, `docker compose run --rm --no-deps api npm run test` with `GEMINI_API_KEY` unset prints `ℹ fail 0` and a `describe` named `GeminiAdapter` whose tests cover a found range, an unparsed reply, an exhausted daily quota, an unavailable service, a reply fenced in ```json, six listings, a `javascript:` URL, a 2049-character URL and a 429 with and without a `PerDay` quota id, no test opens a network connection, `docker compose run --rm --no-deps api npm run typecheck`, `lint` and `deps:check` exit 0, `git diff --stat -- '*.spec.ts' ':!apps/api/src/modules/ai/GeminiAdapter.spec.ts'` prints nothing; do not commit and do not edit tracker.md
```

Хвіст `or stop after N turns` ненадійний, тож межу витрат став окремо. Для T104–T105 вона
нульова: умова не вимагає жодного живого виклику.
