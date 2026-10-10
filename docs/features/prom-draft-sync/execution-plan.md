# План виконання — prom-draft-sync

Складено за графом [tracker.md](tasks/tracker.md) і тими самими правилами, що й
[план price-range-search](../price-range-search/execution-plan.md). Статус живе лише в tracker, а
цей файл описує тільки порядок і інструменти. Запуск — `/run-tasks prom-draft-sync [ID, …]`.

## Як читати

Кожна задача проходить два кроки:

```
гілка → Крок А: виконавець → [між кроками] → Крок Б: /mouse-trading:feature-ship <ID> → [після] → push + PR (ти)
```

| Позначка | Крок А (виконавець) | Коли |
|---|---|---|
| `tdd` | `/tdd <ID>` | поведінку можна покрити тестом, а story править **наявні** файли або створює лише `.ts` |
| `tdd·r` | `/tdd <ID> --review-tests` | те саме, але помилка в тестах коштує дорого: інваріант каталогу, повтор подачі, рядок відправки |
| `scaf` | `/mouse-trading:feature-scaffold`, обмежений story-файлом | нові файли Angular (`.html`/`.css`) |
| `goal` | `/goal …` з умовою «do not commit and do not edit tracker.md» | конфіг чи видалення з бінарним DoD |
| `plan` | інтерактивна сесія в Plan mode | `decision` / `verification`; `feature-ship` не потрібен |
| `docs` | пряма сесія за Checklist story, без агентів | `gate_profile: docs`; Крок Б — `feature-ship` лише закриває story й рядок tracker після gate-check теки `tasks/` |

**Між кроками:** `pw` — перевірка AC через `playwright-cli` на живому стеку до `feature-ship`.
`+обв'язка` — пункти Checklist без поведінки (`index.ts`, composition root, `CLAUDE.md`), які
`/tdd` не робить: їх дописуєш окремим комітом до Кроку Б.
**Після кроку Б:** `cpr` — `critical-path-review`, `sec` — `security-review`, обидва перед мержем.

**Ціна викликів.** Грошей фіча не витрачає: Prom API безкоштовний, а Claude у
[T141](tasks/keep-ai-title-within-prom-limit.md) не викликається живцем. Дорогий тут живий
магазин: тестової компанії Prom немає, кожна подача пише в магазин на ~1000 товарів, а ручних
імпортів — до 10 на добу, спільних з кабінетом ([sad.md §11](sad.md#11-risks-and-technical-debt)).
Тому жива подача є лише в T143, і запускає її людина. Класифікатор auto mode блокує записи в
магазин, а читання (статус, товар) дозволяє. Усі `pw` і смоуки до T143 йдуть без
`PROM_API_TOKEN`, і відправка закривається `prom_access_denied` без жодного виклику Prom.

## Перш ніж почати

1. **Розбивку змерджено.** Гілку `docs-prom-draft-sync-control-submission` (story, правки після
   рев'ю, цей план) запушено й змерджено в `main` до першої задачі, бо story-файли — вхід для `/tdd`.
2. **T121 — до T129, і це робота людини.** Звіт імпорту в кабінеті й перевипуск токена агент не
   зробить. Строк токена — 2026-10-17. Поки T121 не закрито, T129 і весь ланцюг `worker` за нею
   стоять, тож почни з неї.
3. **Токена в дев-`.env` немає.** `PROM_TOKEN` з контрольної відправки прибирає T121. Тести й
   смоуки розраховані на стек без токена, тож він у деві лише заважав би.
4. **Міграцію T126 — лише з `--no-deps`.** `docker compose run` без `--no-deps` піднімає `migrate`
   і накочує нову міграцію на dev-базу ще до перевірки. `down -v` не запускати.

## Доріжки

Граф — у [_epic.md](tasks/_epic.md). Ребра там змістовні, а спільні файли задають ще й порядок
усередині рівня:

- **адаптер і кроки `worker`** (`modules/marketplace/`, критичний шлях): T124 → T128 → T129 →
  T135 → T136 → T137 → T138. Строго послідовно, бо кожен крок ставить наступний;
- **«Категорія» і контракт картки** (`products.contract.ts`, `ProductController.ts`,
  `product-form.*`): T125 → T126 → T127 → T134. Фронт прибирає поле, поки тип його ще має;
  T127 і T134 файлово стоять за T126;
- **маршрути відправки** (`products/prom-sync/`): T130, T131 → T132 → T133. T134 іде після T132,
  щоб винести спільний мапінг DTO, а не копіювати його;
- **`ai`** (`PreparationService.*`, `AnthropicAdapter.*`): T141 після T126, бо T126 прибирає
  `category` з фікстур `ai/PreparationService.spec.ts`;
- **фронт відправки** (`products/prom-sync/` у `web`, `products-api.ts`, `product-form.*`):
  T139 → T140;
- **документи** (T121, T122, T142) коду не чіпають.

Один виконавець іде таблицею згори вниз. Дві доріжки можна вести паралельно лише в різних гілках,
і тоді друга ребейзиться на першу.

## Що лишилось

### Поставка 0 — рішення й PRD

| # | ID | Задача | Крок А | Між | Після | Обґрунтування |
|---|----|--------|--------|-----|-------|---------------|
| 1 | T121 | «Невірні дані» імпорту й токен | `plan` | — | — | `decision`, але не go / no-go: рішення змінює колонки файлу, а не долю фічі. Кабінет і перевипуск токена — руки людини, сесія записує рішення в SAD §11 і Checklist T129. Живої подачі немає |
| 2 | T122 | PRD після ADR 0032 | `docs` | — | — | Лише PRD: §1, §8, AC-09 (текст `prom_busy` після рев'ю). Після правок — gate-check теки `tasks/`, бо excerpt-и цитують PRD |

### Поставка 1 — основа й адаптер

| # | ID | Задача | Крок А | Між | Після | Обґрунтування |
|---|----|--------|--------|-----|-------|---------------|
| 3 | T123 | Коди, межі Prom і DTO відправки | `tdd` | — | — | Нові `.ts` (`prom-sync.contract.ts`) і правки наявних констант. Фронт їх ще не імпортує, тож PR зелений на обох застосунках |
| 4 | T124 | Конфіг Prom, токен і черга | `goal` | — | — | Конфіг з бінарним DoD (умова нижче): необов'язковий секрет, константи, `promSyncQueue`. Поведінка одна — env-схема з токеном і без, і її spec входить в умову |
| 5 | T128 | `marketplace` і `PromAdapter` | `tdd·r` | `+обв'язка`: `marketplace/index.ts`, `marketplace/CLAUDE.md`, кореневий `CLAUDE.md` | `sec` | На відміну від T105 price-range-search, SDK немає, а форма відповідей Prom записана в протоколі контрольної відправки, тож `/tdd` не пише API з пам'яті. Тести переглянути до GREEN: `mark_missing_product_as: none` без аргументу (AC-03) і 401 HTML до zod — саме те, що захищає живий каталог. `sec`: новий секрет і відповідь Prom як недовірений ввід |
| 6 | T129 | `buildPromImportFile` | `tdd·r` | — | — | Стартує лише після рішення T121 про колонки. Тести переглянути до GREEN: ціна — рядок без округлення, головне фото першим, uuid картки у `Ідентифікатор_товару`. Помилку тут видно лише на живому магазині в T143 |

### Поставка 1 — «Категорія» і межі

| # | ID | Задача | Крок А | Між | Після | Обґрунтування |
|---|----|--------|--------|-----|-------|---------------|
| 7 | T125 | Фронт без «Категорії» | `tdd` | `pw`: форма картки й каталог без «Категорії», закладка `/products?category=Миші` відкриває каталог без фільтра | — | Правка наявних файлів, нових немає. Spec-и прибраної поведінки (`products-api.spec.ts`, `product-form.spec.ts`, `product-catalog-query.spec.ts`, `product-catalog.spec.ts`) прибрати окремим комітом `test(web): drop specs of the category field and filter` **до** `/tdd`. Типізовані фікстури `Product` лишають `category`, бо тип її ще має |
| 8 | T126 | Видалити `products.category` | `goal` | — | — | Названий виняток атомарності: міграція, entity, контракт, репозиторій, контролер, скрипт імпорту й специ обох застосунків нероздільні. `/tdd` тут застрягає: RED без `category` в контракті не компілюється, а GREEN не править фікстури `web`. DoD бінарний (умова нижче). Міграцію вниз і вгору перевіряє `feature-ship` |
| 9 | T130 | `promReadiness` | `tdd` | — | — | Чиста функція в новому `.ts`. Якщо предикат `isReady` повертає лише bool, винесення перевірки полів RED покриває наявними spec-ами готовності, а не новими |
| 10 | T131 | `PromSyncRepository` | `tdd·r` | `+обв'язка`: експорт у `products/index.ts` | `cpr` | Унікальність «одна активна на картку», транзакція `succeedRun`, `recheck` з `check_count + 1` (правка після рев'ю). Тести проти тестової БД переглянути до GREEN |
| 11 | T127 | Назва для Prom ≤ 130 при збереженні | `tdd` | `pw`: 131 знак — підказка з числом зайвих і неактивне збереження; 130 — без підказки | — | Правка наявних `products.contract.ts` і `product-form.*`. Файлово стоїть за T126 |

### Поставка 1 — маршрути

| # | ID | Задача | Крок А | Між | Після | Обґрунтування |
|---|----|--------|--------|-----|-------|---------------|
| 12 | T132 | Старт і стан відправки | `tdd·r` | `+обв'язка`: `src/api.ts`, `products/index.ts`; смоук: старт непідготовленої картки — `409 prom_sync_not_ready`, готової — `201` і задача в `pgboss.job` | `sec` | Порядок перевірок старту й детермінований UUID задачі — тести переглянути до GREEN. `worker` ще не підписаний, тож задача лишається в черзі. `sec`: нові маршрути з вводом |
| 13 | T134 | Стан Prom у читанні картки | `tdd` | — | — | Нові поля `Product` RED додає в контракт як сигнатуру разом з фікстурами `web`, інакше typecheck `web` впаде. Спільний мапінг DTO з T132 — винести, а не копіювати |
| 14 | T133 | «Перевірити ще раз» | `tdd·r` | — | `sec` | Саме тут рев'ю знайшло зупинку опитування через номер спроби: тести переглянути до GREEN, зокрема два «Перевірити ще раз» поспіль. `sec`: новий маршрут |

### Поставка 1 — кроки `worker`

| # | ID | Задача | Крок А | Між | Після | Обґрунтування |
|---|----|--------|--------|-----|-------|---------------|
| 15 | T135 | Крок «подати» | `tdd·r` | `+обв'язка`: експорт у `marketplace/index.ts` | — | `retryLimit` 0 і повтор `retry`, а не `first`, для товару, що вже є (AC-13): пропущений тест тут означає другий імпорт у живий магазин. Жодна відмова не кидається — spec на кожну гілку |
| 16 | T136 | Крок «перевірити» | `tdd·r` | — | — | Правило остаточного звіту (`with_errors_count`, `PARTIAL` з нулями) і `prom_access_denied` уточнено після рев'ю. Тести переглянути до GREEN на звітах з протоколу контрольної відправки |
| 17 | T137 | Крок «довершити» | `tdd·r` | — | `cpr` | Чернетка до підрахунку фото, конфлікт `products_prom_id_key` → `prom_sync_failed` без throw. `cpr`: запис `prom_id` у транзакції |
| 18 | T138 | `worker` і свіп завислих | `tdd` | `+обв'язка`: `worker.ts`; смоук без токена: старт готової картки → `failed` з `prom_access_denied` за ≤ 5 с, підготовка працює як раніше | — | Поведінка — обробник з розгалуженням за `step` і свіп, решта — composition root |

### Поставка 1 — AI, фронт, документи, приймання

| # | ID | Задача | Крок А | Між | Після | Обґрунтування |
|---|----|--------|--------|-----|-------|---------------|
| 19 | T141 | AI-назва для Prom ≤ 130 | `tdd` | `+обв'язка`: PRD product-creation-flow (межа 130) | — | Тести перевіряють записаний запит, жодного живого виклику Claude. Після T126, бо обидві правлять `ai/PreparationService.spec.ts` |
| 20 | T139 | Кнопка й підказки меж | `scaf` | `pw`: брудна форма — кнопка неактивна з підказкою; готова збережена — активна; слово понад 50 — підказка біля ключових слів; картка з `promId` (через `page.route` на `GET` картки) — посилання замість кнопки | — | Новий компонент у `web/products/prom-sync/` з `.html`/`.css`, тож `tdd` упреться в Gate 2. Натискання без токена закриває відправку `prom_access_denied`, тож запису в Prom немає |
| 21 | T140 | Стан відправки на картці | `scaf` | `pw`: лоадер → «Чернетку створено, фото 4 з 4»; `prom_photos_incomplete` → «Повторити»; `prom_timeout` → «Перевірити ще раз» — через `page.route` на полінг; одна справжня відправка без токена → текст `prom_access_denied` | — | Новий поллер і компонент з `.html`/`.css`. Тексти за кодом — `Record` над `NonNullable<PromSyncRunDto['errorCode']>` (правка після рев'ю) |
| 22 | T142 | `ARCHITECTURE.md`, `SPEC.md`, PRD product-creation-flow | `docs` | — | — | Лише документи, після коду: таблиця модулів описує змерджене. Після правки — рядки розходжень sad.md §11 закрито |
| 23 | T143 | Приймання: QG-1–QG-3 | `plan` | `pw` | — | `verification`. Без токена — Claude сам; дві живі подачі — скрипт фаз, який людина запускає через `! bash …`, Claude читає лог. Перевіряє й те, що контрольна відправка не покрила: ціну рядком і `presence` у повторі. Обидва тестові товари видалити в кабінеті. Дефекти — новими задачами |

Кроки з документами в story (`marketplace/CLAUDE.md`, кореневий `CLAUDE.md`, PRD
product-creation-flow) агенти `/tdd` не роблять, бо правлять лише код. Внеси їх руками до Кроку Б.
Для `goal`-задач ці кроки входять в умову «every Checklist item is done», тож їх робить сам цикл.

## Умови `/goal`

Шаблон і пастки — у [плані product-creation-flow](../product-creation-flow/execution-plan.md),
розділ «Умова `/goal`». `node --test` друкує назви `describe`, а не імена файлів, тож на тест
посилаємось назвою `describe`.

**T124** — новий spec схеми env дозволено, решта spec-ів не змінюється:

```
/goal docs/features/prom-draft-sync/tasks/add-prom-config-and-queue.md: every Checklist item is done, `.env` has no `PROM_API_TOKEN` and no `PROM_TOKEN`, `.env.example` has an empty `PROM_API_TOKEN=` line, `docker compose run --rm --no-deps api npm run test` prints `ℹ fail 0` and a `describe` whose tests parse the env with and without `PROM_API_TOKEN`, `docker compose run --rm --no-deps api npm run typecheck`, `lint` and `deps:check` exit 0, `docker compose up -d api worker` leaves both containers running without a config error in `docker compose logs api worker`, `rg -n 'PROM_API_TOKEN|my\.prom\.ua' apps/web` prints nothing, `rg -ln 'my\.prom\.ua' apps/api/src` prints only `apps/api/src/config.ts`, `git diff --stat -- '*.spec.ts' ':!apps/api/src/config.spec.ts'` prints nothing; do not commit and do not edit tracker.md
```

**T126** — специ правляться лише видаленням рядків, нові перевірки — лише в двох файлах.
`GeminiAdapter` згадує «category pages» майданчиків, а не поле картки, тож він поза пошуком:

```
/goal docs/features/prom-draft-sync/tasks/drop-product-category.md: every Checklist item is done, `rg -n 'category' apps/api/src apps/api/db apps/web/src -g '!apps/api/db/migrations/**' -g '!**/GeminiAdapter*'` prints nothing, `apps/api/db/migrations/` has a new `*-drop-product-category.ts` whose `down` adds `category varchar(120) not null default ''`, `docker compose run --rm --no-deps api npm run test` prints `ℹ fail 0` and a test that `products.category` is absent from the schema, `docker compose run --rm --no-deps web npm run test` exits 0, `docker compose run --rm --no-deps api npm run typecheck`, `lint` and `deps:check` and `docker compose run --rm --no-deps web npm run typecheck` exit 0, `git diff -U0 -- '*.spec.ts' ':!apps/api/db/schema.spec.ts' ':!apps/api/src/contracts/products.contract.spec.ts' | rg '^\+[^+]'` prints nothing, no `docker compose run` without `--no-deps` and no `db:migrate` against the dev database were run; do not commit and do not edit tracker.md
```

Хвіст `or stop after N turns` ненадійний, тож межу витрат став окремо. Для T124 і T126 вона
нульова: умови не вимагають жодного виклику Prom чи моделі.
