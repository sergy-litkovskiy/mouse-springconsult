---
status: Draft
owner: "Serhii"
reviewers: []
updated_at: "2026-09-05"
stage: "13"
---

# Tracker — product-creation-flow

Статус кожної задачі. Один рядок = один PR. Легенда розмірів і граф залежностей —
у [_epic.md](_epic.md).

**Статуси:** `Todo` · `Blocked` (чекає на deps) · `In progress` · `In review` · `Done`.

## Поставка 0 — узгодження документів

| ID | Задача | Статус | blocked_by | Est | Owner | PR |
|----|--------|--------|------|-----|-------|-----|
| T01 | [Узгодити PRD з архітектурою](align-prd-with-architecture.md) | Todo | — | S | Serhii | — |
| T02 | [Переписати рядок про R2](rewrite-r2-boundary-rule.md) | Todo | — | XS | Serhii | — |

## Поставка 1 — картка й галерея

| ID | Задача | Статус | blocked_by | Est | Owner | PR |
|----|--------|--------|------|-----|-------|-----|
| T03 | [Доменні коди помилок картки](add-product-error-codes.md) | Blocked | T01 | S | Serhii | — |
| T04 | [Межа розміру кадру й типи](add-upload-limits-contract.md) | Todo | — | XS | Serhii | — |
| T05 | [Схеми запису картки](add-product-write-contracts.md) | Blocked | T04 | S | Serhii | — |
| T06 | [Конфіг R2 і парні ліміти тіла](configure-r2-and-body-limits.md) | Blocked | T04 | S | Serhii | — |
| T07 | [`ImageStorage.ts`](add-image-storage-adapter.md) | Blocked | T06 | S | Serhii | — |
| T08 | [`MediaService.ts`](add-media-service.md) | Blocked | T04, T07 | S | Serhii | — |
| T09 | [Репозиторій запису картки](add-product-write-repository.md) | Todo | — | S | Serhii | — |
| T10 | [Сервіс картки](add-product-card-service.md) | Blocked | T03, T09 | S | Serhii | — |
| T11 | [Маршрути картки](add-product-card-routes.md) | Blocked | T05, T10 | S | Serhii | — |
| T12 | [Знести `product_images.url`](drop-product-image-url.md) | Blocked | T06, T11 | S | Serhii | — |
| T13 | [Репозиторій кадрів](add-image-repository.md) | Blocked | T09 | S | Serhii | — |
| T14 | [Приймання кадру](add-image-upload-endpoint.md) | Blocked | T08, T12, T13 | S | Serhii | — |
| T15 | [Головний кадр](add-set-main-image-endpoint.md) | Blocked | T11, T13 | XS | Serhii | — |
| T16 | [Видалення кадру](add-delete-image-endpoint.md) | Blocked | T08, T11, T13 | S | Serhii | — |
| T17 | [Видалення картки](add-delete-product-endpoint.md) | Blocked | T08, T09, T16 | S | Serhii | — |
| T18 | [Клієнт API на фронті](extend-products-api-client.md) | Blocked | T05 | S | Serhii | — |
| T19 | [Діалог підтвердження](add-confirm-dialog.md) | Todo | — | XS | Serhii | — |
| T20 | [Форма картки](add-product-form-subfeature.md) | Blocked | T18 | S | Serhii | — |
| T21 | [Діалог галереї](add-gallery-upload-dialog.md) | Blocked | T18, T19 | S | Serhii | — |
| T22 | [Каталог](integrate-catalog-with-form-and-delete.md) | Blocked | T18, T19, T20 | S | Serhii | — |
| T23 | [Приймання поставки 1](verify-delivery-1.md) | Blocked | T14–T22 | S | Serhii | — |

## Поставка 2 — модель

| ID | Задача | Статус | blocked_by | Est | Owner | PR |
|----|--------|--------|------|-----|-------|-----|
| T24 | [Закрити чотири TBD](close-preparation-open-items.md) | Blocked | T01 | S | Serhii | — |
| T25 | [Черга і `worker`](add-queue-and-worker.md) | Blocked | T23 | S | Serhii | — |
| T26 | [Таблиці підготовки](add-preparation-tables-migration.md) | Blocked | T24, T25 | S | Serhii | — |
| T27 | [Адаптер Anthropic](add-anthropic-adapter.md) | Blocked | T25 | S | Serhii | — |
| T28 | [Сервіс підготовки](add-preparation-service.md) | Blocked | T26, T27 | S | Serhii | — |
| T29 | [Маршрути запусків](add-preparation-run-endpoints.md) | Blocked | T28 | S | Serhii | — |
| T30 | [Прийняття пропозицій](add-suggestion-resolution-endpoints.md) | Blocked | T29 | S | Serhii | — |
| T31 | [Вартість картки](add-card-cost-readout.md) | Blocked | T11, T26 | XS | Serhii | — |
| T32 | [Фронт підготовки](add-preparation-ui.md) | Blocked | T20, T29, T30, T31 | S | Serhii | — |
| T33 | [Приймання поставки 2](verify-delivery-2.md) | Blocked | T32 | S | Serhii | — |

## Готові до старту просто зараз

T01, T02, T04, T09, T19 — жодної незакритої залежності. T24 не залежить від коду поставки 1
і може вестись паралельно з усією нею.

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
