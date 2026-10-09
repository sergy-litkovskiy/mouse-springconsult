# API sync report — price-range-search

**Скіл:** `feature-api-forge` (локальний стейдж 05).
**Сценарій:** **A** — `data-model.md` присутній (`stage: 08`, `Draft`), схему БД фіча не змінює.
**Прогін:** перший, контракт з нуля. Нових маршрутів немає: `openapi.yaml` описує дельту трьох
наявних маршрутів, а незмінні частини бере `$ref`-ом з
[контракту product-creation-flow](../../product-creation-flow/contracts/openapi.yaml).

**Вхідні артефакти:** PRD.md ✓ (AC-01…AC-10, §6, §6.1) · data-model.md ✓ (форма `value` для
`price`, нові `error_code`, два Open items) · sad.md §6 ✓ (4 sequence-діаграми; методів і шляхів
свідомо не називає, тож звірка йде по репліках) · idea-brief.md ✓ (`info.description`) ·
`adr/` 0020–0025 ✓, усі Accepted: на форму HTTP-контракту впливають 0021 (тіло `price`), 0022
(`listings`), 0023 (коди), 0024 (лише `http(s)`), 0025 (`model` і токени); 0020 — внутрішнє
рішення про адаптер · `contracts/ai.contract.ts`, `products.contract.ts`, `products-limits.ts`,
`error-codes.ts`, `error.contract.ts` ✓ — джерело наявної поведінки ·
`PreparationRunService.ts`, `ProductErrors.ts`, `PreparationRun.ts`, `PreparationService.ts` ✓ —
перевірено, що з дельти вже є в коді (нічого).

**Рішення, прийняті цим прогоном** (власник, 2026-10-08; обидва `data-model.md` → `## Open items`
віддав етапу контракту):

1. `listings[].url` — `maxLength: 2048`; задовге посилання робить увесь результат
   `price_not_found`, а не обрізається й не відкидається поодинці.
2. Ціни оголошень у межах [`priceFrom`, `priceTo`] бути не мусять: інваріант ADR 0023 №2 не
   розширюється.

## Section A — походження полів

| operation.field | origin | confidence |
|---|---|---|
| `startPreparationRun` · `PriceRunRequest.scope` | `product_preparation_runs.scope CHECK IN (texts, price, both, field)` | high |
| `PriceRunRequest.titleProm/titleOlx/descriptionProm/descriptionOlx` | ADR 0021 №1: «рядки з чернетки форми»; AC-01/AC-02 — змішана пара | high |
| `PriceRunRequest.*` без `maxLength` | ADR 0021 №2 (обрізання `config.ai.priceSearch.maxInputChars`), ADR 0016 №6 | medium — див. розбіжності |
| `TextsRunRequest`, `FieldRunRequest` | `preparationRunRequestSchema` в `ai.contract.ts`, без змін | high |
| `PreparationInputIncompleteError.details.missing` + `description` | AC-02, ADR 0021 №2, `PreparationInputIncomplete` у `ProductErrors.ts` | high |
| `missing` перелічує обидва значення разом | рішення контракту: PRD і ADR про форму мовчать, масив її вже має | medium |
| `PreparationRun.errorCode` + `price_not_found`, `price_quota_exhausted` | `product_preparation_runs.error_code VARCHAR(64)` без CHECK; ADR 0023 №2–4 | high |
| `PreparationRun.model` (`maxLength: 64`, Gemini для `price`) | `product_preparation_runs.model VARCHAR(64) NOT NULL`; ADR 0025 №1–2 | high |
| `PreparationRun.inputTokens/outputTokens` = 0 для `price` | `INT NOT NULL DEFAULT 0`; ADR 0025 №1 | high |
| `PreparationRun.*` решта | `preparationRunSchema`, без змін | high |
| `PriceFieldSuggestion.field` = `price` | `product_field_suggestions.field VARCHAR(32)` CHECK | high |
| `PriceRange.priceFrom/priceTo` | data-model.md: decimal string, `productConstraints.pricePattern`; > 0 і `≤` — код (ADR 0023) | high |
| `PriceRange.listings` (1–5) | data-model.md; `maxPriceListings: 5` (sad.md §7) | high |
| `PriceListing.price` | data-model.md: decimal string, `pricePattern` | high |
| `PriceListing.url` (`^https?://`) | data-model.md; PRD §6.1; ADR 0023 №2, ADR 0024 №2 | high |
| `PriceListing.url` (`maxLength: 2048`) | рішення власника цього прогону (data-model.md Open items №1) | high |
| `PriceFieldSuggestion.createdAt` як дата пошуку | `product_field_suggestions.created_at`, upsert переписує (ADR 0022 №2) | high |
| `Text-`/`KeywordsFieldSuggestion` | `fieldSuggestionSchema`, без змін форми | high |
| `ProductCardRead` | `$ref` на product-creation-flow + звужений `latestSuggestions` | high |
| `events.md` · `title`/`description` у payload `price` | ADR 0021 №3 каже «payload несе обрану пару», імен не дає; імена прийнято 2026-10-09 | high — Section C закрито |

## Section B — 5-point drift check

1. **Endpoint ↔ data-model** — ✓. Старт пише `product_preparation_runs` (ліміт за
   `product_id`+`created_at`, частковий UNIQUE `idempotency_key`); полінг і перелік читають його за PK
   і `product_id`; читання картки віддає `product_field_suggestions` за UNIQUE (`product_id`, `field`).
2. **Error codes ↔ domain sentinels** — ✓ для HTTP-кодів, **waived** для дельти.
   `validation_failed`, `not_authenticated`, `product_not_found`, `preparation_input_incomplete`,
   `preparation_rate_limited` є в `error-codes.ts` і мають класи. Ще не в коді, специфікація для
   break-tasks:
   - `PreparationInputIncomplete` приймає лише `'gallery' | 'title' | 'draft'` і одне значення:
     треба `'description'` і масив;
   - `PreparationErrorCode` у `PreparationRun.ts` і `errorCode` у `preparationRunSchema` — без
     `price_not_found`, `price_quota_exhausted`. Це коди запуску, а не HTTP, тож у
     `error-codes.ts` вони не йдуть: їх пише `worker`, а читає `web/run-failure-messages.ts`.
3. **Validation ↔ DB constraints** — ✓ проти DDL; **waived** для констант контракту.
   `pricePattern`, `VARCHAR(64)` для `model` і `error_code`, CHECK на `scope`/`field` збігаються.
   `maxPriceListings: 5` і межі `listings[].url` у `products-limits.ts` ще немає: це story
   контракту після go на гейті заміру (data-model.md, Migrations).
4. **Entity ↔ endpoint** — ✓. `products` — читання; `product_preparation_runs` — старт, полінг,
   перелік; `product_field_suggestions` — у читанні картки. Окремого ендпоінту оголошень немає
   свідомо: вони не живуть окремо від вилки (ADR 0022).
5. **OpenAPI ↔ sequence** — ✓, по репліках:
   - сценарій 1, `alt` «немає назви чи опису» → `409 preparation_input_incomplete`; «ліміт 20» →
     `429`; «запуск прийнято» → `201`; «перечитує картку» → `getProduct` з `PriceRange`;
   - сценарій 3 → `errorCode` `price_quota_exhausted` / `price_unavailable` у полінгу, тексти — у
     `BothRunPriceUnavailable`;
   - сценарій 4 → `200` з тим самим запуском, поки він `queued`/`running`; `price_not_found`; новий
     `201` після завершення.

   Orphan-sequence немає. Гілки `403 not-owned` немає, бо немає ролей: запуск чужої картки — `404`,
   як і в наявному коді.

## Section C — unresolved_origins

1. ~~**Імена пари в payload `price`** (`events.md`). ADR 0021 №3 фіксує зміст, а не імена;
   `title`/`description` — пропозиція контракту. Межу API payload не перетинає, тож закриває
   story `priceSearchInput`. Іменувати можна будь-як, аби однаково в `PreparationJob` і в
   `PreparationRunService`.~~ **Закрито 2026-10-09:** прийнято `title`/`description` з
   [events.md](events.md), однакові в `PreparationJob` (`ai`) і `PreparationRunJob`
   (`products/preparation`).

Обидва `## Open items` з `data-model.md` закрито рішеннями вище; 2026-10-09 їх закрито й у самому
`data-model.md`.

## Розбіжності з дефолтами `feature-api-forge`

| Дефолт | Тут | Чому |
|---|---|---|
| `maxLength` обов'язковий для обмежених полів | `PriceRunRequest.*` без `maxLength` | Це вхід пошуку з чернетки, а не поле картки. Сервер обрізає обрані рядки сам (ADR 0021 №2), опис не обмежений і в картці (ADR 0016 №6). Межа на назву давала б `400` на кнопці ціни, поки user ще дописує назву довшу за 200 символів, — той самий прецедент, що `draftText` без межі. |
| Коміт `<NN>: API contract for <slug> via feature-api-forge` | `docs(price-range-search): API contract` | Попередні стейджі цього slug закомічено Conventional Commits (`docs(price-range-search): PRD`, `… SAD and ADRs 0020-0025`, `… data model without schema changes`); кореневий `CLAUDE.md` «Git» має перевагу над дефолтом скіла. |

## Follow-up (не блокер)

- **Контракт product-creation-flow застаріє, щойно дельта ляже в код.** Його `FieldSuggestion` описує
  `price` як `{priceFrom, priceTo}`, 409 `title` — як назву збереженої картки (AC-27, який цей PRD
  замінює), а `PreparationRun.errorCode` знає два коди. Правити його варто тими story, які змінюють
  відповідні zod-схеми, а не цим прогоном: до go на гейті заміру живий код усе ще той.
- `PreparationRunService` рахує ключ `both` з `priceQueryInput` збереженої картки. За ADR 0021 №4 пошук у
  `both` іде за щойно згенерованими текстами, тож збережені назва й опис у ключі `both` більше нічого
  не означають. Ключ `price` рахується з пари з тіла запиту.

## Перевірки

- **Spectral** (`spectral:oas`, у контейнері `stoplight/spectral:6`, 2026-10-08): 0 errors, 1 warning
  `info-contact` — як і в контракті product-creation-flow. Приклади звірено зі схемами, зокрема через
  зовнішні `$ref`.

  ```bash
  npx --yes @stoplight/spectral-cli lint docs/features/price-range-search/contracts/openapi.yaml
  ```

- **Mock-сервер** — запропоновано, не піднято:

  ```bash
  npx --yes @stoplight/prism-cli mock docs/features/price-range-search/contracts/openapi.yaml
  ```

- **Типи для фронту** — з `@contracts/*`, а не з цього файлу. `openapi.yaml` документує форму, яку
  `ai.contract.ts` і `products.contract.ts` мають набути в story контракту.

**Наступний власник:** Backend Lead → `feature-break-tasks`: класи й union-и з Section B п.2,
константи з п.3, імена payload з Section C.
