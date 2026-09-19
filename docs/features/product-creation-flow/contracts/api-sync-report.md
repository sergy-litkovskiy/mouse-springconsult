# API sync report — product-creation-flow

**Скіл:** `feature-api-forge` (локальний стейдж 05 цього проєкту).
**Сценарій:** **A** — `data-model.md` присутній (`stage: 08`, `status: Draft`).
**Прогін:** оновлення наявного `openapi.yaml` на місці — звірено поле в поле проти
джерел, змінено один опис (нижче).

**Вхідні артефакти:** PRD.md ✓ · data-model.md ✓ (stage 08, Draft) · sad.md §6 (9
sequence-діаграм: 4 container-level поставки 1, 5 endpoint-level поставки 2) ✓ ·
idea-brief.md ✓ (info.description) · `adr/`: усі десять прочитано — 0004, 0006, 0007,
0009, 0011, 0012, 0013 (Accepted) впливають на форму HTTP-контракту; 0005 (Superseded
0011) і 0008 (Superseded 0013) — внутрішні storage/module-wiring рішення, на контракт не
впливають. `apps/api/src/contracts/products.contract.ts` + `products-limits.ts` ✓ —
джерело істини для delivery 1: у `ProductController.ts` реалізовано лише `list`
(`GET /products`), решта ендпоінтів контракту — специфікація наперед. `error-codes.ts` +
`error.contract.ts` ✓.

**`apps/api/db/migrations/` перевірено напряму** (3 файли): `products` і `product_images`
накотились міграцією `1787756956906-create-products-tables`, включно з колонкою
`product_images.url` (ще не прибрана — етап 13, ADR 0007 виконано лише частково).
`product_preparation_runs` і `product_field_suggestions` — без міграції. Контракт це
відображає коректно в описах операцій поставки 2.

## Section A — походження полів

Звірено поле в поле проти `data-model.md` + `products.contract.ts`.

| operation.field | origin | confidence |
|---|---|---|
| `Product.titleProm/titleOlx` | `products.title_prom/title_olx VARCHAR(200)`, `productConstraints.titleMaxLength` | high |
| `Product.price` | `products.price NUMERIC(12,2)`, `productConstraints.pricePattern` | high |
| `Product.seoKeywords` (maxItems 30) | `products.seo_keywords TEXT[]`, межа — код (AC-07), не SQL | high |
| `Product.condition` enum | `products.condition CHECK IN (new,used)` | high |
| `Product.publishedProm/publishedOlx` | `products.published_prom/published_olx BOOLEAN`, AC-13 | high |
| `Product.isReady` | похідне, не колонка — [ADR 0009](../adr/0009-derive-card-readiness-instead-of-storing-it.md) | high |
| `ProductImage.r2Key/url/position/isMain` | `product_images` (перевірено міграцією — колонка `url` реально ще існує, не лише в схемі) | high |
| `ProductCreateRequest.category` | `products.category VARCHAR(120) NOT NULL` | high |
| `ProductUpdateResponse.discardedKeywordsCount` | AC-07, рахує сервіс, колонки немає | medium |
| `PreparationRun.*` | `product_preparation_runs` — міграція `1789736913481-create-preparation-tables` (T26) | high |
| `FieldSuggestion.field` enum | `product_field_suggestions.field CHECK IN (...)` | high |
| `FieldSuggestion.value` (форма для `price`) | data-model.md Open items: `{priceFrom, priceTo}`, закрито 2026-09-13 | high |
| `PreparationRunCreateRequest.scope` | `product_preparation_runs.scope CHECK IN (texts,price,both,field)`; тіло — `z.discriminatedUnion('scope', …)` ([ADR 0015](../adr/0015-add-per-field-text-rewrite-scope.md)) | high |
| `Product.totalInputTokens/OutputTokens` | AC-14, `sum(...)`; валюта не вводиться (PRD §8 open) | medium |

## Section B — 5-point drift check

1. **Endpoint ↔ data-model** — ✓.
2. **Error codes ↔ domain sentinels** — **waived, не ✗.** Перевірено напряму:
   `apps/api/src/modules/products/ProductErrors.ts` досі не існує (є лише
   `modules/auth/AuthErrors.ts` як взірець). Одинадцять кодів контракту лишаються
   специфікацією для стейджу break-tasks.
   **Waiver знято 2026-09-07 частково:** [T03](../tasks/add-product-error-codes.md)
   ввів `ProductErrors.ts` із сімома кодами поставки 1. Чотири коди поставки 2
   (`preparation_input_incomplete`, `preparation_rate_limited`, `suggestion_not_found`,
   `suggestion_already_resolved`) досі без класів — за ними T29 і T30.
3. **Validation ↔ DB constraints** — ✓.
4. **Entity ↔ endpoint** — ✓.
5. **OpenAPI ↔ sequence** — ✓, з двома нотатками (supporting, не блокер):
   - **Термінологічний дрейф `sad.md`, не контракту.** Сценарій 7 (рядок 568): «після
     межі задача йде в DLQ». Конвенція репо (шаблон
     `feature-api-forge/templates/events.md`, CLAUDE.md «Не додаємо Redis/RabbitMQ») —
     окремого DLQ немає, вичерпаний `retryLimit` лишає рядок job'и у стані `failed`
     тієї самої таблиці pg-boss. `PreparationRun.status` у контракті вже відповідає
     конвенції (enum без dlq-стану) — контракту правка не потрібна. Джерело (`sad.md`)
     не редагувалось (інваріант скіла «ніколи не редагувати джерела») — власник
     вирішує, чи правити речення там.
   - **Сценарій 5 (AC-10b, `scope: both`, часткова відмова).** Worker пише пропозиції
     текстів, потім `worker->>pg: позначає цінову частину невиконаною` — але
     `product_preparation_runs.status` (data-model.md) одна колонка на весь запуск, не
     per-scope. Контракту нема звідки взяти, яким має бути `status` такого запуску:
     `succeeded` (тексти є) чи `failed` (ціна ні). Перенесено в Section C — не вигадано
     поля.

**Core checks (1, 2, 3):** 1 ✓, 2 waived, 3 ✓.

## Section C — unresolved_origins

Порожньо. Обидва рядки закрила [T24](../tasks/close-preparation-open-items.md): форму
`value` для `price` — 2026-09-13, `status` при частковій відмові `scope: both` — 2026-09-18
(`failed` з `error_code: price_unavailable`, без статусу per-scope; data-model.md, Open items).

## Conflicts

Жодного з чотирьох типів таблиці Conflicts скіла (`#unused-in-prd`, `#orphan-sequence`,
`#stale`, `#manual-addition`) не виявлено. Прогалину зі `status` під частковою відмовою
спершу було зафіксовано в Section C; закрито в T24 2026-09-18.

## Self-check DoD

- [x] Lint: не запускався (`spectral` не вписаний у жоден `package.json`).
- [x] Приклади на кожній операції.
- [x] Модель помилок з кодами — Section B п.2 waived, причина перевірена напряму (файл
      і досі відсутній).
- [ ] Mock-сервер (Prism) — не піднімався: `npx --yes @stoplight/prism-cli mock
      docs/features/product-creation-flow/contracts/openapi.yaml`.
- [x] Core checks 1/3 ✓, 2 waived.
- [x] Сценарій зафіксовано: **A**.

## events.md — навмисно не створено

> **2026-09-19:** створено в [T28](../tasks/add-preparation-service.md) разом з обробником у `worker.ts` — [events.md](events.md). Нижче — обґрунтування станом на прогін.

Delivery 2 має pg-boss-задачу лише як намір у `sad.md` (сценарії 5, 7, 8: `API->>Worker:
ставить задачу`), не як код: перевірено напряму — `apps/api/src/worker.ts` і
`apps/api/src/queue.ts` не існують, `pg-boss` відсутній у `apps/api/package.json`
(`sad.md` §2 сам це називає: «фіча вперше вводить у package.json... pg-boss»), а
`product_preparation_runs` без міграції. `events.md` за шаблоном
`feature-api-forge/templates/events.md` документував би producer/consumer/retry для
черги, якої в жодному коміченому файлі, крім наміру в `sad.md`, ще немає — передчасно.
Створити разом із міграцією й `worker.ts` поставки 2 (стейдж break-tasks), не цим
прогоном.

## Наступний власник

Backend Lead → стейдж break-tasks:
1. `ProductErrors.ts` за переліком кодів Section B п.2.
2. ~~Форма `FieldSuggestion.value` для `price` (Section C).~~ Закрито 2026-09-13.
3. ~~Рішення для `PreparationRun.status` під частковою відмовою `scope: both`~~
   Закрито в T24 2026-09-18.
4. ~~`events.md` разом із чергою поставки 2.~~ Створено в T28 2026-09-19.
