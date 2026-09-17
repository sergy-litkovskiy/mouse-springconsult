---
status: Draft
owner: "Serhii"
reviewers: []
updated_at: "2026-09-17"
stage: "13"
---

# Tracker — product-creation-flow

Статус кожної задачі. Один рядок = один PR. Легенда розмірів і граф залежностей —
у [_epic.md](_epic.md).

**Статуси:** `Todo` · `Blocked` (чекає на deps) · `In progress` · `In review` · `Done`.

## Поставка 0 — узгодження документів

| ID | Задача | Статус | blocked_by | Est | Owner | PR |
|----|--------|--------|------|-----|-------|-----|
| T01 | [Узгодити PRD з архітектурою](align-prd-with-architecture.md) | Done | — | S | Serhii | — |
| T02 | [Переписати рядок про R2](rewrite-r2-boundary-rule.md) | Done | — | XS | Serhii | — |

## Поставка 1 — картка й галерея

| ID | Задача | Статус | blocked_by | Est | Owner | PR |
|----|--------|--------|------|-----|-------|-----|
| T03 | [Доменні коди помилок картки](add-product-error-codes.md) | Done | T01 | S | Serhii | — |
| T04 | [Межа розміру кадру й типи](add-upload-limits-contract.md) | Done | — | XS | Serhii | — |
| T05 | [Схеми запису картки](add-product-write-contracts.md) | Done | T04 | S | Serhii | — |
| T06 | [Конфіг R2 і парні ліміти тіла](configure-r2-and-body-limits.md) | Done | T04 | S | Serhii | — |
| T07 | [`ImageStorage.ts`](add-image-storage-adapter.md) | Done | T06 | S | Serhii | — |
| T08 | [`MediaService.ts`](add-media-service.md) | Done | T03, T04, T07 | S | Serhii | — |
| T09 | [Репозиторій запису картки](add-product-write-repository.md) | Done | — | S | Serhii | — |
| T10 | [Сервіс картки](add-product-card-service.md) | Done | T03, T09 | S | Serhii | — |
| T11 | [Маршрути картки](add-product-card-routes.md) | Done | T05, T10 | S | Serhii | — |
| T12 | [Знести `product_images.url`](drop-product-image-url.md) | Done | T06, T11 | S | Serhii | — |
| T13 | [Репозиторій кадрів](add-image-repository.md) | Done | T09 | S | Serhii | — |
| T14 | [Приймання кадру](add-image-upload-endpoint.md) | Done | T08, T12, T13 | S | Serhii | — |
| T15 | [Головний кадр](add-set-main-image-endpoint.md) | Done | T11, T13 | XS | Serhii | — |
| T16 | [Видалення кадру](add-delete-image-endpoint.md) | Done | T08, T11, T13 | S | Serhii | — |
| T17 | [Видалення картки](add-delete-product-endpoint.md) | Done | T08, T09, T16 | S | Serhii | — |
| T18 | [Клієнт API на фронті](extend-products-api-client.md) | Todo | T05 | S | Serhii | — |
| T19 | [Діалог підтвердження](add-confirm-dialog.md) | Done | — | XS | Serhii | — |
| T20 | [Форма картки (MatDialog)](add-product-form-subfeature.md) | Todo | T18 | M | Serhii | — |
| T21 | [Секція галереї](add-gallery-upload-dialog.md) | Todo | T18, T19 | S | Serhii | — |
| T22 | [Каталог](integrate-catalog-with-form-and-delete.md) | Blocked | T18, T19, T20, T34 | S | Serhii | — |
| T23 | [Приймання поставки 1](verify-delivery-1.md) | Blocked | T14–T22, T37 | S | Serhii | — |

## Поставка 1 — доопрацювання каталогу

| ID | Задача | Статус | blocked_by | Est | Owner | PR |
|----|--------|--------|------|-----|-------|-----|
| T34 | [Фільтр готовності в `api`](add-readiness-list-filter.md) | Done | — | S | Serhii | — |
| T35 | [Фільтр «Картка готова»](add-catalog-readiness-filter.md) | Blocked | T34, T36 | XS | Serhii | — |
| T36 | [Варіанти «Всі / Так / Ні»](relabel-published-filter-options.md) | Todo | — | XS | Serhii | — |
| T37 | [Ширина фільтрів](resize-catalog-filter-fields.md) | Blocked | T35 | XS | Serhii | — |

## Поставка 2 — модель

| ID | Задача | Статус | blocked_by | Est | Owner | PR |
|----|--------|--------|------|-----|-------|-----|
| T24 | [Закрити відкриті TBD](close-preparation-open-items.md) | Todo | T01 | S | Serhii | — |
| T25 | [Черга і `worker`](add-queue-and-worker.md) | Blocked | T23 | S | Serhii | — |
| T26 | [Таблиці підготовки](add-preparation-tables-migration.md) | Blocked | T24, T25 | S | Serhii | — |
| T27 | [Адаптер Anthropic](add-anthropic-adapter.md) | Blocked | T25 | S | Serhii | — |
| T28 | [Сервіс підготовки](add-preparation-service.md) | Blocked | T26, T27 | S | Serhii | — |
| T29 | [Маршрути запусків](add-preparation-run-endpoints.md) | Blocked | T28 | S | Serhii | — |
| T30 | [Прийняття пропозицій](add-suggestion-resolution-endpoints.md) | Blocked | T29 | S | Serhii | — |
| T31 | [Вартість картки](add-card-cost-readout.md) | Blocked | T11, T26 | XS | Serhii | — |
| T32 | [Фронт підготовки](add-preparation-ui.md) | Blocked | T20, T29, T30, T31 | M | Serhii | — |
| T33 | [Приймання поставки 2](verify-delivery-2.md) | Blocked | T32 | S | Serhii | — |

## Готові до старту просто зараз

T20, T21, T24, T36 — жодної незакритої залежності. T24 не залежить від коду поставки 1 і може
вестись паралельно з усією нею.

**2026-09-17 закрито бекенд-доріжку поставки 1:** T06, T07, T08, T11, T12, T34, T15, T14, T16, T17.
Розблоковано: T07 (після T06), T08 (після T07), T12, T15 і T16 (після T11), T14 (після T12), T17
(після T16). T34 нічого не розблокувала: T35 чекає ще й на T36, T22 — на T18 і T20. T23 чекає
на решту поставки, зокрема на веб-доріжку T18 → T36 → T35 → T37 → T20 → T21 → T22.

**2026-09-17 закрито T18** (перша задача веб-доріжки). Вона розблокувала T20 і T21 (T19 уже Done).
T22 чекає ще й на T20.

Раніше: T13 закрито 2026-09-10, T10 і T19 — 2026-09-12. T21 і T22 чекають ще й на T18,
а T22 — і на T20.

## Спільний DoD

Кожен PR, окрім задач поставки 0 (тільки документи):

- [ ] `docker compose run --rm api npm run typecheck` · `lint` · `test` · `deps:check` — зелені
- [ ] `docker compose run --rm web npm run lint` · `test` — зелені, якщо PR чіпає `apps/web/`
- [ ] Коміт за Conventional Commits: `feat(products): ...`, `fix(media): ...`
- [ ] Діапазон правки ≤ 500 рядків. Більше — story була завелика, і це привід її розрізати

Перед мержем правок у самій теці `tasks/`:

```bash
python3 .claude/skills/feature-break-tasks/references/gate-check.py \
        docs/features/product-creation-flow/tasks/
```

Вісім gate на кожну story, симетрія `blocks`/`blocked_by`, ациклічність графа й висячі
лінки — одним прогоном.

Команди — скіл `mouse-commands`.
