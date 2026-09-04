# API sync report — product-creation-flow

**Скіл:** `api-forge` (SDLC stage 10, локальна нумерація проєкту — коміт `05`).
**Сценарій:** **A** — `data-model.md` присутній (`stage: 08`, `status: Draft`).
`unresolved_origins` формально порожній; нижче — секція C з нюансом навіть у
сценарії A.
**Вхідні артефакти:** PRD.md ✓ · data-model.md ✓ · sad.md §6 (9 sequence-діаграм,
контейнерного рівня) ✓ · idea-brief.md ✓ (пішов у `info.description`) · adr/0004,
0006, 0007, 0009, 0012, 0013 ✓ (посилання в описах операцій).
**Існуючий контракт:** `apps/api/src/contracts/products.contract.ts` +
`ProductController.ts` (реалізовано лише `GET /products`) — прочитано як джерело
істини для наявної поведінки, не перезаписано.

## Розбіжності зі скіл-дефолтами (`.claude/rules/openapi.md` цього скіла)

Дефолти скіла — узгоджений мінімум із публічних гайдлайнів (Microsoft/Google/Zalando),
але цей репозиторій має власні, уже підписані конвенції (`CLAUDE.md`,
`modules/auth/CLAUDE.md`, наявний код). За правилом «дефолти SDLC-скілів
поступаються CLAUDE.md» — розбіжність називається тут таблицею, а не ховається.

| # | Тема | Дефолт скіла | Що в контракті і чому |
|---|---|---|---|
| 1 | Пагінація списків | Курсорна (`after`/`limit`, UUID v7) | Offset (`page`/`pageSize`/`total`) — так уже реалізовано в `productListQuerySchema` і `ProductController.list`; курсор довелося б впроваджувати ретроактивно на живому ендпоінті заради відповідності скілу, а не задачі |
| 2 | Форма помилки | Пласко `{code, message, details?}` | Обгорнуто `{error: {code, message, details?}}` — форма `contracts/error.contract.ts` і фактичного `api.ts` error-handler'а |
| 3 | Неймспейс кодів помилок | `<module>.<error_name>` | Пласкі snake_case без крапки (`gallery_full`, `image_not_found`) — так виглядають усі шість наявних кодів у `error-codes.ts`, дотована крапка не має прецеденту в коді |
| 4 | Авторизація | `BearerAuth` (http/bearer) | `apiKey`/`cookie` `mouse_session` — сесія JWT у httpOnly-cookie ([ADR 0002](../../adr/0002-auth-jwt-and-typeorm.md), `modules/auth/CLAUDE.md`: «Ні Authorization: Bearer, ні localStorage») |
| 5 | Версіювання URL | `/api/v1/...` | `/api/...` без версії — Caddy (`infra/caddy/Caddyfile`, `handle_path /api/*`) знімає префікс, Fastify реєструє `/products` без жодного `/v1`; один адмін-клієнт, зовнішніх споживачів немає, вводити версію нема для кого |
| 6 | Ідемпотентність мутацій, що повторюються | `Idempotency-Key` заголовок клієнта | Ключ обчислює **сервер** із (картка, область, версія входу) → `product_preparation_runs.idempotency_key UNIQUE`; sad.md §6 сценарій 7 прямо каже «ключ ідемпотентності», не «заголовок». POST повертає `200` з наявним запуском замість `201` при повторному вході — контракт, а не заголовок, несе ідемпотентність |
| 7 | Регістр JSON-полів | snake_case (Zalando) | camelCase — так повертає вже реалізований `productSchema` (`titleProm`, `publishedOlx`, …); БД snake_case, TS/JSON camelCase — саме розмежування, яке `CLAUDE.md` називає explicitly для шару БД, а не для дроту |

Жодна з семи — не помилка ані скіла, ані контракту: скіл описує дефолт для
проєкту з нуля, тут же треба узгодити ендпоінти поставки 1 із уже реалізованим
`GET /products`.

## Section A — походження полів (вибірка; повний перелік — 41 поле)

| operation.field | origin | confidence |
|---|---|---|
| `Product.titleProm/titleOlx` | `data-model.md` → `products.title_prom/title_olx VARCHAR(200)` | high |
| `Product.price` | `products.price NUMERIC(12,2)`, взірець `productConstraints.pricePattern` | high |
| `Product.seoKeywords` (maxItems 30) | `products.seo_keywords TEXT[]`, межа — код (`productConstraints.maxKeywords`), не SQL (AC-07) | high |
| `Product.condition` enum | `products.condition CHECK IN (new,used)` | high |
| `Product.publishedProm/publishedOlx` | `products.published_prom/published_olx BOOLEAN`, PRD AC-13 | high |
| `Product.isReady` | похідне, не колонка — [ADR 0009](../adr/0009-derive-card-readiness-instead-of-storing-it.md) | high |
| `ProductImage.r2Key/url/position/isMain` | `product_images` (r2_key, position, is_main); `url` НЕ з колонки — колонка `url` іде на злам етапом 13, DTO складає адресу з ключа ([ADR 0007](../adr/0007-serve-images-from-a-public-bucket.md)) | high |
| `ProductCreateRequest.category` | `products.category VARCHAR(120) NOT NULL` — обов'язковість вимагає значення до вставки | high |
| `ProductUpdateResponse.discardedKeywordsCount` | PRD AC-07 («система повідомляє, якщо частину відкинуто») — поля-джерела в БД немає, число рахує сервіс | medium |
| `PreparationRun.*` | `product_preparation_runs` (data-model.md, «поставка 2, спроектовано») — таблиця без міграції | medium (spec'd, unmigrated) |
| `FieldSuggestion.field` enum | `product_field_suggestions.field CHECK IN (...)` | high |
| `FieldSuggestion.value` (price shape) | data-model.md **Open items**: «Форма значення `value` для поля `price` — TBD» | **low** |
| `PreparationRunCreateRequest.scope` | `product_preparation_runs.scope CHECK IN (texts,price,both)` | high |
| `Product.totalInputTokens/OutputTokens` | AC-14 (вартість картки) + `sum(product_preparation_runs.input_tokens/output_tokens)`; валюта не вводиться — курсу токен→гроші немає в жодному вхідному артефакті (PRD §8 відкрите питання) | medium |

## Section B — 5-point drift check

1. **Endpoint ↔ data-model** — ✓. Кожен ендпоінт має мутацію/читання проти сутності
   data-model.md: `products` (CRUD), `product_images` (upload/delete/set-main),
   `product_preparation_runs` (start/poll), `product_field_suggestions`
   (accept/reject).
2. **Error codes ↔ domain sentinels** — **waived, не ✗.** `ProductErrors.ts` іще
   не існує (sad.md §5, файл позначено «новий», етап 13). Контракт-спершу
   передує коду за задумом SDLC; одинадцять доменних кодів контракту
   (`product_not_found`, `gallery_full`, `image_not_found`, `invalid_price`,
   `invalid_file`, `file_too_large`, `storage_unavailable`,
   `preparation_input_incomplete`, `preparation_rate_limited`,
   `suggestion_not_found`, `suggestion_already_resolved`) — це специфікація
   для `ProductErrors.ts`, яку етап 13 має реалізувати «за взірцем
   `AuthErrors.ts`» буквально.
3. **Validation ↔ DB constraints** — ✓. `titleMaxLength 200` ↔ `VARCHAR(200)`;
   `descriptionMaxLength 8000` — код, DDL `TEXT` без межі (свідомо, межа лише
   в коді); `categoryMaxLength 120` ↔ `VARCHAR(120)`; `pricePattern` ↔
   `NUMERIC(12,2)` + `CHECK >= 0`; `maxImagesPerProduct 10` — код, не SQL
   (data-model.md явно: «межа... в SQL не виражена»); `condition` enum ↔
   `CHECK IN`.
4. **Entity ↔ endpoint** — ✓, усі чотири сутності обслужені (Section A).
5. **OpenAPI ↔ sequence** — ✓ з приміткою: sad.md §6 навмисно не називає HTTP-
   методи/шляхи («імена ендпоінтів і HTTP-методи народжує етап 10» — сам
   документ делегує це сюди), тож звірка — не буквальне співставлення рядків,
   а перевірка, що кожна репліка sequence-діаграми («ставить задачу з ключем
   ідемпотентності», «перевіряє ліміт частоти», «звіряє поточне значення з
   останньою прийнятою пропозицією») має відповідний ендпоінт або поле
   відповіді. Розходжень не знайдено.

**Core checks (1, 2, 3):** 1 ✓, 2 waived (обґрунтування вище — не блокер), 3 ✓.

## Section C — unresolved / низька впевненість попри сценарій A

Формально порожній (сценарій A, `data-model.md` присутній для всіх сутностей).
Один виняток, який data-model.md сам називає невирішеним:

| schema_path | поточне походження | що витягне reconcile/наступний прохід |
|---|---|---|
| `FieldSuggestion.value` (форма для `field: price`) | Здогад із sad.md сценарію 8 («діапазон "від — до"») → `{priceFrom, priceTo}` decimal-рядки | data-model.md Open items: «імена ключів JSON-обʼєкта фіксує етап 10 разом зі схемою відповіді» — цей контракт **є** тим фіксуванням; власник Serhii має підтвердити форму до міграції поставки 2 |

## Conflicts — жодного, що потребує паузи

Перевірено проти таблиці «Conflicts» скіла: жодного поля з data-model.md без
історії в PRD; жодної репліки sequence без відповідного ендпоінту (orphan-
sequence); жодної розбіжності PRD-валідації з DDL (`price`/`title` збігаються
дослівно); наявного `openapi.yaml` не було — «manual-addition» неможливий.

## Self-check DoD

- [x] Lint: **не запускався** — `spectral` не вписаний у `package.json` жодного
      з `apps/api`/`apps/web`; додати в `make sdlc-check` — окрема задача, не
      цей прохід.
- [x] Приклади на кожній операції.
- [x] Модель помилок з кодами (Section B, п.2 — waived з причиною, не мовчки).
- [ ] Mock-сервер (Prism) — не піднімався в межах цього прогону; команда для
      наступного разу: `npx --yes @stoplight/prism-cli mock
      docs/features/product-creation-flow/contracts/openapi.yaml`.
- [x] `api-sync-report.md` — core checks 1/3 ✓, 2 waived.
- [x] Сценарій явно зафіксовано: **A**.

## Прогін --update: rehearsal розходження (2026-09-04)

Механіку `--update`/reconcile й наскрізний codegen-пайплайн перевірено навмисним
розходженням, а не лише прочитано зі SKILL.md:

1. У `data-model.md` додано `products.weight_kg NUMERIC(6,2) NULL` — поле без
   жодного US/AC у PRD.
2. `api-forge --update` перечитав `data-model.md`, побачив нове поле й додав
   `weightKg` у `Product` (як `required`, `[string, null]`) з коментарем
   `# unused-in-prd` — рівно та поведінка, яку описує таблиця Conflicts скіла
   («поле без історії в PRD → додати з приміткою, спитати людину»).
3. `openapi-typescript@7.13.0` згенерував `.d.ts` з reconciled-контракту без
   помилок (codegen сам собою мовчки проковтнув би нову форму).
4. Існуюча frontend-подібна fixture (`Product`-обʼєкт, написаний проти
   контракту **до** reconcile) прогнана через пінований `typescript@6.0.3`:
   **`TS1360: Property 'weightKg' is missing`** — компіляція впала, як і мала:
   контракт розійшовся з кодом, і це видно на етапі складання, а не в проді.
5. Рішення людини (не скіла): поле не має обґрунтування в PRD — приберено з
   `data-model.md` **і** з `openapi.yaml` тим самим комітом, а не залишено як
   борг. `openapi-typescript` перегенеровано, та сама fixture перекомпільована
   тим самим `tsc` — **exit code 0**, без змін у fixture (бо контракт
   повернувся до форми, під яку її було написано).

Висновок: reconcile ловить дрейф `data-model.md → openapi.yaml` механічно;
codegen перетворює цей дрейф на помилку компіляції на боці споживача типів —
саме той контур, заради якого contract-first існує. Тимчасові файли rehearsal
(`.d.ts`, fixture, `node_modules`) жили поза репозиторієм, у scratchpad сесії,
і в коміт не входять.

## Наступний власник

Backend Lead → етап 13 (`break-tasks`): реалізувати `ProductErrors.ts` за
переліком кодів Section B п.2, підтвердити форму `FieldSuggestion.value` для
`price` (Section C) до міграції поставки 2.
