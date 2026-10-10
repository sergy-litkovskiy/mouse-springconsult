# API sync report — prom-draft-sync

**Скіл:** `feature-api-forge` (локальний стейдж 05).
**Сценарій:** **A** — `data-model.md` присутній (`stage: 08`, `Draft`). Таблицю
`product_prom_sync_runs` уже створено міграцією `1791630446458`; видалення `products.category`
спроектовано, а міграцію відкладено до story US-05.
**Прогін:** перший. Три нові маршрути відправки й дельта чотирьох наявних маршрутів картки.
Незмінні частини взято через `$ref` з контрактів
[product-creation-flow](../../product-creation-flow/contracts/openapi.yaml) і
[price-range-search](../../price-range-search/contracts/openapi.yaml).

**Вхідні артефакти:** PRD.md ✓ (US-01…US-05, AC-01…AC-16, §6, §6.1) · data-model.md ✓ (дві
Open items віддано цьому етапу) · sad.md §6 ✓ (4 sequence-діаграми; методів і шляхів свідомо не
називає, тож звірка йде по репліках; §11 віддає цьому етапу звірку `PromAdapter` з OpenAPI Prom) ·
idea-brief.md ✓ (`info.description`) · CONTEXT.md фічі ✓ · `adr/` 0027–0031 ✓, усі Accepted ·
`contracts/products.contract.ts`, `ai.contract.ts`, `products-limits.ts`, `error-codes.ts`,
`error.contract.ts` ✓ · `PromSyncRun.ts` ✓ (union-и `PromSyncStatus`, `PromSyncErrorCode`) ·
`PreparationRunController.ts`, `PreparationQueue.ts`, `ProductErrors.ts` ✓ — прецедент форми ·
**OpenAPI Prom** ✓ (`public-api.docs.prom.ua/documentation`, 2026-10-10; під час SAD був недоступний).

**Рішення, прийняті цим прогоном** (власник, 2026-10-10):

1. **Код свіпу** (data-model.md Open items №2): з `prom_import_id` — `prom_timeout`, без нього —
   новий восьмий код `prom_sync_failed`, аналог `preparation_failed`. Звідси правило для фронту:
   «Перевірити ще раз» лише для `prom_timeout`, для решти — «Повторити».
2. **Посилання на кабінет** — похідне поле `promCabinetUrl`, яке сервер складає з id і шаблону в
   `config.prom`, як `ProductImage.url`. Схему адрес Prom знає лише бекенд.
3. **«Перевірити ще раз»** — `POST …/prom-sync-runs/{runId}/recheck`. Дія над наявним рядком, а не
   `PATCH status`: клієнт просить дію з побічним ефектом, а не пише стан.

## Section A — походження полів

| operation.field | origin | confidence |
|---|---|---|
| `startPromSyncRun` — без тіла | AC-04 («на Prom іде лише збережене»), sad.md сценарій 1 «читає збережену картку» | high |
| `startPromSyncRun` `201`/`200` | `product_prom_sync_runs_active_key` (частковий UNIQUE), AC-13, прецедент `startPreparationRun` | high |
| `PromSyncRun.id`, `productId` | `id UUID default uuidv7()`, `product_id UUID NOT NULL FK` | high |
| `PromSyncRun.status` | `status VARCHAR(16) CHECK IN (queued, running, succeeded, failed)` | high |
| `PromSyncRun.errorCode` — 7 кодів | `error_code VARCHAR(64)` без CHECK, union `PromSyncErrorCode` | high |
| `PromSyncRun.errorCode` — `prom_sync_failed` | рішення №1 цього прогону (data-model.md Open items №2) | high |
| `PromSyncRun.promProductId` | `prom_product_id VARCHAR(32) NULL`; цифри до 19 — `Product.id int64` OpenAPI Prom | high |
| `PromSyncRun.promCabinetUrl` | похідне; рішення №2; AC-01, AC-11, AC-12 | medium — шаблон адреси не звірено (Section C) |
| `PromSyncRun.imagesTotal` (1–10) | `images_total INT NOT NULL CHECK > 0`; верхня межа — `maxImagesPerProduct` | high |
| `PromSyncRun.imagesOnProm` (≥ 0, без верхньої межі) | `images_on_prom INT NULL CHECK >= 0`, без `<= images_total` | high |
| `PromSyncRun.createdAt`, `startedAt`, `finishedAt` | `timestamptz` колонки | high |
| `PromSyncRun` без `promImportId`, `checkCount`, `deadlineAt` | навмисно внутрішні: читає лише `worker`; фронт розрізняє дію за кодом (рішення №1) | high |
| `PromSyncNotReadyError.details.missing` | предикат `isReady` (ADR 0009), AC-02 | high |
| `PromSyncNotReadyError.details.overLimit` | AC-05, AC-06; межі PRD §6 | high |
| `overLimit` `seoKeywords` — 1024 по рядку, склеєному через `", "` | OpenAPI Prom: `keywords` — один рядок через `", "`, `maxLength: 1024` | high |
| `409 product_already_on_prom` | AC-14; `products.prom_id` | high |
| `409 prom_sync_not_recheckable` | AC-10, sad.md сценарій 3, `active_key` | high |
| `Product.promId` | `products.prom_id VARCHAR(32) NULL UNIQUE`; AC-14 | high |
| `Product.promCabinetUrl` | похідне; рішення №2 | medium — як вище |
| `Product` без `category` | US-05, AC-16; data-model.md (− `category`) | high |
| `ProductCreate/UpdateRequest.titleProm` `maxLength: 130` | AC-05, PRD §6; колонка лишається `varchar(200)` (data-model.md) | high |
| `Product.titleProm` у відповіді `maxLength: 200` | колонка `varchar(200)`: збережені до межі назви можуть бути довшими | high |
| `ProductUpdateRequest.seoKeywords` без меж Prom | AC-06 («зберегти можна») | high |
| `ProductCardRead.latestPromSyncRun` | data-model.md access patterns («читання картки — остання відправка»), ADR 0029 Negative | high |
| `listProducts` без `category` | AC-16; нестрога `productListQuerySchema` | high |

## Section B — 5-point drift check

1. **Endpoint ↔ data-model** — ✓. `startPromSyncRun` читає `products` за PK і пише
   `product_prom_sync_runs` під `active_key`. `getPromSyncRun` читає за PK. `recheckPromSyncRun`
   оновлює той самий рядок (data-model.md: виняток «перевірити ще раз»). `getProduct` читає
   останню відправку через `product_id_idx`. `updateProduct`/`createProduct`/`listProducts` —
   `products` без `category`.
2. **Error codes ↔ domain sentinels** — **waived**, специфікація для break-tasks. Наявні
   `validation_failed`, `not_authenticated`, `product_not_found` є в `error-codes.ts`. Ще не в
   коді:
   - HTTP-коди в `error-codes.ts` з класами поруч з `ProductNotFound` у `ProductErrors.ts`:
     `prom_sync_not_ready` (`PromSyncNotReady`, `details.missing`/`overLimit`),
     `product_already_on_prom` (`ProductAlreadyOnProm`), `prom_sync_not_recheckable`
     (`PromSyncNotRecheckable`);
   - коди відправки — не HTTP, тож у `error-codes.ts` не йдуть: union `PromSyncErrorCode` у
     `PromSyncRun.ts` отримує `prom_sync_failed`, а zod-схема `promSyncRunSchema` у новому
     `prom-sync.contract.ts` — увесь перелік. Класи відмов Prom — у `MarketplaceErrors.ts`
     (sad.md §5);
   - `getPromSyncRun` і `recheckPromSyncRun` на чужу чи неіснуючу відправку — `ProductNotFound`,
     як `PreparationRunService.getRun`.
3. **Validation ↔ DB constraints** — ✓ проти DDL; **waived** для констант контракту.
   `VARCHAR(32)` ↔ `PromProductId.maxLength`, CHECK `status` ↔ `PromSyncStatus`, `CHECK > 0` ↔
   `imagesTotal.minimum: 1`, `CHECK >= 0` ↔ `imagesOnProm.minimum: 0`. У `products-limits.ts` ще
   немає меж Prom: `promTitleMaxLength: 130`, `promKeywordMaxLength: 50`,
   `promKeywordsMaxLength: 1024`; число фото — наявний `maxImagesPerProduct`. Не прибрано й
   `categoryMaxLength`, `categoryFilterMaxItems`. Це story US-02 і US-05 (data-model.md, Registration
   checklist). `cardTitle` спільний для обох назв, тож для `titleProm` знадобиться окрема схема.
4. **Entity ↔ endpoint** — ✓. `products` — читання, збереження, список. `product_prom_sync_runs` —
   старт, полінг, recheck, а в читанні картки — остання відправка. `product_images` — без змін.
   Файл імпорту в R2 і лічильники звіту навмисно внутрішні (data-model.md, «Поза агрегатом»).
5. **OpenAPI ↔ sequence** — ✓, по репліках:
   - сценарій 1: «запускає відправку картки» → `startPromSyncRun` `201`; «стан відправки» у циклі
     → `getPromSyncRun`; «посилання на товар у кабінеті» → `promCabinetUrl`;
   - сценарій 2, `alt` «доступ недійсний» / «імпорт уже йде» → `errorCode` `prom_access_denied` /
     `prom_busy` у полінгу; HTTP-гілок немає, бо `api` до Prom не ходить;
   - сценарій 3: «перевірити ту саму відправку» → `recheckPromSyncRun` `200`;
   - сценарій 4, `alt` «вже є активна відправка» → `startPromSyncRun` `200` з наявною;
     «активної немає» → `201`.

   Orphan-sequence немає. Гілки `403 not-owned` немає, бо немає ролей: чужа відправка — `404`, як
   і в підготовці. Дві відповіді контракту не мають sequence: `409 prom_sync_not_ready` (його в
   сценарії 1 видно як «перевіряє готовність і межі Prom», але `alt` не намальовано) і
   `409 product_already_on_prom` (AC-14 описує лише UI).

## Section C — unresolved_origins

Обидва `## Open items` з `data-model.md`, віддані етапу 10, закрито:

- ~~Довжина `prom_import_id`~~ — **закрито**. В OpenAPI Prom id імпорту — `string` у відповіді
  `import_url` і `integer int64` у шляху `import/status/{id}`. Обидва вміщуються у `varchar(64)`,
  міграція не потрібна. **Виправлено 2026-10-10:** живий id — 24 hex-символи
  (`6aca2573f1e9d95f8f81e79e`), а не число, тож zod розбирає його як непорожній рядок, а не
  «рядок з цифр»: таке правило відхилило б кожну справжню відповідь.
- ~~Код свіпу~~ — **закрито** рішенням №1.

Третє, нове, теж закрито:

- ~~Шаблон адреси товару в кабінеті Prom~~ — **закрито 2026-10-10**. В OpenAPI Prom його не
  описано; на живому кабінеті адреса товару — `https://my.prom.ua/cms/product/edit/{id}`, тобто
  приклади збігаються зі справжнім шаблоном.

## Звірка `PromAdapter` з OpenAPI Prom (sad.md §11)

| Виклик sad.md | Ендпоінт Prom | Звірено | Примітка |
|---|---|---|---|
| товар за зовнішнім id | `GET /products/by_external_id/{id}` | ✓ | «товару немає» описано лише як `default` → `Error {error: string}`, статус не названо. Живий виклик: «немає» — 404, недійсний токен — 401, обидва HTML-сторінкою, а не JSON |
| подати імпорт | ~~`POST /products/import_url`~~ → `POST /products/import_file` | ✓ | multipart: `file` + `data` (JSON) з тими самими параметрами; `mark_missing_product_as` enum з default `none` — константа адаптера (ADR 0030, ADR 0032) |
| статус імпорту | `GET /products/import/status/{id}` | ✓ | `status` ∈ `SUCCESS`/`PARTIAL`/`FATAL`; лічильники `created`, `updated`, `not_changed`, `not_in_file`, `with_errors_count`; `errors[].download_images`. В OpenAPI — `not_in_fle`, у живій відповіді — `not_in_file` |
| статус «чернетка» + наявність | `POST /products/edit_by_external_id` | ✓ | масив `{id, status: draft, presence: available}`; обидва поля одним викликом |
| фото товару — K | той самий `by_external_id` → `Product` | ✓ | `main_image` (рядок) + `images`. Головне фото входить в `images` першим, тож K = `images.length` (знахідка 3) |

**Знахідки, які варто внести в sad.md / ADR до break-tasks** (джерела контракт не правив):

1. **Повтор для фото (AC-12) не дочитає фото з параметрами за замовчуванням.** `updated_fields`
   імпорту за замовчуванням — `[price, presence]`. Повторна подача того самого файлу для товару,
   що вже є, оновить лише ціну й наявність, а `images_urls` не зачепить. Сценарій 4 і ADR 0030
   («Prom оновлює саме цей товар») цього не враховують. Варіант — подавати повтор з
   `updated_fields: [images_urls]`. Тоді в адаптера дві константи параметрів замість однієї, і
   ADR 0030 («параметри — константи без аргументів») треба уточнити. Посилює High-ризик sad.md §11
   «Повтор для фото не перевірявся»: контрольна відправка має перевірити саме цей варіант.
   **Закрито 2026-10-10:** одного `updated_fields` мало, потрібен ще `force_update: true`. Повтор
   іде з `updated_fields: ["images_urls", "presence"]`, ADR 0030 уточнено.
2. **`prom_busy` розпізнається лише за текстом.** Відповідь `import_url` на відмову —
   `{status, message}`, окремого коду «імпорт уже йде» в схемі немає. Класифікація за `message`
   крихка, тож незнайомий текст має давати `prom_unavailable`, а не падіння (sad.md §8). Точний
   текст варто взяти з протоколу проби 2026-10-10.
   **Частково закрито 2026-10-10:** у протоколі проби текст не збережено, а паралельну подачу Prom
   приймає без відмови. Відмову дають завислий імпорт і добовий ліміт ручних імпортів. Класифікація
   — за відсутністю `id` у відповіді подачі, без розбору тексту (sad.md §11).
3. **K для «фото K з N».** Якщо `images` не містить головного фото, K = 1 + `images.length`, інакше
   K = `images.length`. Помилка в цьому правилі дає хибне «частково» на кожній відправці. Звірити
   на першому живому товарі; правило — одна функція `PromSyncService`.
   **Закрито 2026-10-10:** головне фото входить в `images`, K = `images.length`.
4. **`edit_by_external_id.name` — `maxLength: 110`**, а межа назви у файлі імпорту — 130
   (idea-brief §9, проба). Це різні шляхи, і поки адаптер не шле `name` через `edit`, межа 110 нас
   не стосується. Варто записати в `marketplace/CLAUDE.md`, щоб `edit` не почав колись слати назву.
   **Передано** story, що створює `marketplace/CLAUDE.md`.
5. **`pgboss.job.id` — `uuid`** (pg-boss 12, перевірено в контейнері). Id задачі «runId + крок +
   номер» має бути детермінованим UUID, а не рядком (events.md, «Ідемпотентність»). Формулювання
   ADR 0027 / sad.md §8 від цього не хибне, але реалізація в лоб упаде на першій постановці.
   **Записано** в events.md («Ідемпотентність»); спосіб виведення обирає story `PromSyncQueue`.

## Контрольна відправка 2026-10-10

Одна картка (3 фото + адреса четвертого, якого в R2 ще не було), три імпорти на живому магазині,
після чого товар видалено в кабінеті. Каталог до й після — 996 товарів, змін 0.

| Перевірка | Результат |
|---|---|
| `import_url` з файлом у R2 | працює, але зберігає посилання в кабінеті «Імпорт товарів» (автооновлення «Ніколи»); звідси [ADR 0032](../adr/0032-send-the-import-file-in-the-request-body.md) |
| Дві подачі одного файлу за секунду | обидві прийнято, ішли паралельно; товар один, `created: 1` дістався другій подачі, `not_changed: 1` — першій |
| Перший статус | `SUCCESS` з нулями, через ~5 хв `PARTIAL` з нулями; остаточний — через ~9,5 хв |
| Нескачане фото | `errors[].download_images`, `code` 2004, `extra.status_code` 404; `with_errors_count` 0; у товарі 3 фото з 4 |
| Чернетка + наявність одним `edit_by_external_id` | `processed_ids` з id картки; `status: draft`, `presence: available` |
| Повтор через `import_file`, `force_update: true`, `updated_fields: ["images_urls"]` | `updated: 1` за ~3 хв; фото 4 з 4, три старі id збереглися; **статус `draft` → `on_display`**, наявність без змін |
| Товар, видалений у кабінеті | `by_external_id` — 404, як для товару, якого не було |
| Кабінет про імпорт картки | «1 позиція містить невірні дані» за `with_errors_count: 0`; деталі не з'ясовано (sad.md §11) |

## Розбіжності з дефолтами `feature-api-forge`

| Дефолт | Тут | Чому |
|---|---|---|
| Ідемпотентність — ключ з бізнес-полів у `UNIQUE`-колонці `idempotency_key` | колонки немає; ключ — сама картка через частковий UNIQUE `product_prom_sync_runs_active_key` | Вхід відправки не має версії: усе береться зі збереженої картки, тож «той самий вхід» = «та сама картка, поки відправка активна». Окрема колонка дублювала б `product_id` (ADR 0029, data-model.md). |
| Inline-схеми заборонені | `409` старту — `oneOf` з двох `$ref`; `PromSyncRun.errorCode` / `promId` — `oneOf: [$ref, {type: null}]` | Це не форма об'єкта, а nullable-обгортка й вибір між іменованими схемами; JSON Schema 2020-12 інакше `$ref` з `null` не поєднує. |
| Коміт `<NN>: API contract for <slug> via feature-api-forge` | `docs(prom-draft-sync): API contract` | Попередні стейджі цього slug закомічено Conventional Commits; кореневий `CLAUDE.md` «Git» має перевагу (прецедент price-range-search). |

## Follow-up (не блокер)

- **Контракти product-creation-flow і price-range-search застаріють після US-05**: `category` у
  `Product`, `CategoryFilter`, `/products/categories`. Правити їх варто story US-05, яка змінює
  zod-схеми, а не цим прогоном: поки що живий код ще з категорією.
- **Межа 130 для назви Prom у підготовці AI** (PRD §8, sad.md §11) — поза цим контрактом. Без неї
  AI запропонує назву, яку `PATCH` відхилить з `400`.
- Знахідки 1–5 вище закрито або передано story (позначки під кожною).

## Перевірки

- **Spectral** (`spectral:oas`, у контейнері `stoplight/spectral:6`, 2026-10-10): 0 errors, 1 warning
  `info-contact` — як і в двох попередніх контрактах. Зовнішні `$ref` резолвляться, приклади
  звірено зі схемами.

  ```bash
  npx --yes @stoplight/spectral-cli lint docs/features/prom-draft-sync/contracts/openapi.yaml
  ```

- **Mock-сервер** — запропоновано, не піднято:

  ```bash
  npx --yes @stoplight/prism-cli mock docs/features/prom-draft-sync/contracts/openapi.yaml
  ```

- **Типи для фронту** — з `@contracts/*`, а не з цього файлу. `openapi.yaml` документує форму, яку
  нові `prom-sync.contract.ts` і змінений `products.contract.ts` мають набути у своїх story.

**Наступний власник:** Backend Lead → `feature-break-tasks`. На вході — класи й коди з Section B
п.2, константи з п.3, шаблон адреси з Section C, знахідки 1–5.
