---
status: Draft
owner: "Serhii"
reviewers: []
updated_at: "2026-09-21"
stage: "13"
---

# Tracker — product-creation-flow

Статус кожної задачі. Один рядок = один PR. Легенда розмірів і граф залежностей —
у [_epic.md](_epic.md). Чим задача виявилась на ділі, що знайшло рев'ю і звідки взялись
нові задачі — у [хроніці](../_audit/tracker-journal.md).

**Статуси:** `Todo` · `Blocked` (чекає на deps) · `In progress` · `In review` · `Done`.

## Зараз

**Готові до старту:** [T50](show-preparation-failures-in-catalog.md) — помилки підготовки
в каталозі, [T54](bound-the-model-call-timeout.md) — пошук ціни (порожній діапазон,
вартість, таймаут). Жодної незакритої залежності.

**Чекає на них:** [T33](verify-delivery-2.md) — приймання поставки 2.

## Поставка 0 — узгодження документів

| ID | Задача | Статус | blocked_by | Est | Закрито |
|----|--------|--------|------------|-----|---------|
| T01 | [Узгодити PRD з архітектурою](align-prd-with-architecture.md) | Done | — | S | 2026-09-07 |
| T02 | [Переписати рядок про R2](rewrite-r2-boundary-rule.md) | Done | — | XS | 2026-09-08 |

## Поставка 1 — картка й галерея

T34–T49 — доопрацювання за запитами 17–18 вересня (каталог, UI, опис Prom у HTML).

| ID | Задача | Статус | blocked_by | Est | Закрито |
|----|--------|--------|------------|-----|---------|
| T03 | [Доменні коди помилок картки](add-product-error-codes.md) | Done | T01 | S | 2026-09-07 |
| T04 | [Межа розміру кадру й типи](add-upload-limits-contract.md) | Done | — | XS | 2026-09-08 |
| T05 | [Схеми запису картки](add-product-write-contracts.md) | Done | T04 | S | 2026-09-09 |
| T06 | [Конфіг R2 і парні ліміти тіла](configure-r2-and-body-limits.md) | Done | T04 | S | 2026-09-17 |
| T07 | [`ImageStorage.ts`](add-image-storage-adapter.md) | Done | T06 | S | 2026-09-17 |
| T08 | [`MediaService.ts`](add-media-service.md) | Done | T03, T04, T07 | S | 2026-09-17 |
| T09 | [Репозиторій запису картки](add-product-write-repository.md) | Done | — | S | 2026-09-09 |
| T10 | [Сервіс картки](add-product-card-service.md) | Done | T03, T09 | S | 2026-09-12 |
| T11 | [Маршрути картки](add-product-card-routes.md) | Done | T05, T10 | S | 2026-09-17 |
| T12 | [Знести `product_images.url`](drop-product-image-url.md) | Done | T06, T11 | S | 2026-09-17 |
| T13 | [Репозиторій кадрів](add-image-repository.md) | Done | T09 | S | 2026-09-10 |
| T14 | [Приймання кадру](add-image-upload-endpoint.md) | Done | T08, T12, T13 | S | 2026-09-17 |
| T15 | [Головний кадр](add-set-main-image-endpoint.md) | Done | T11, T13 | XS | 2026-09-17 |
| T16 | [Видалення кадру](add-delete-image-endpoint.md) | Done | T08, T11, T13 | S | 2026-09-17 |
| T17 | [Видалення картки](add-delete-product-endpoint.md) | Done | T08, T09, T16 | S | 2026-09-17 |
| T18 | [Клієнт API на фронті](extend-products-api-client.md) | Done | T05 | S | 2026-09-17 |
| T19 | [Діалог підтвердження](add-confirm-dialog.md) | Done | — | XS | 2026-09-12 |
| T20 | [Форма картки (MatDialog)](add-product-form-subfeature.md) | Done | T18, T38 | M | 2026-09-17 |
| T21 | [Секція галереї](add-gallery-upload-dialog.md) | Done | T18, T19 | S | 2026-09-17 |
| T22 | [Каталог](integrate-catalog-with-form-and-delete.md) | Done | T18, T19, T20, T34 | S | 2026-09-17 |
| T23 | [Приймання поставки 1](verify-delivery-1.md) | Done | T14–T22, T37 | S | 2026-09-17 |
| T34 | [Фільтр готовності в `api`](add-readiness-list-filter.md) | Done | — | S | 2026-09-17 |
| T35 | [Фільтр «Картка готова»](add-catalog-readiness-filter.md) | Done | T34, T36 | XS | 2026-09-17 |
| T36 | [Варіанти «Всі / Так / Ні»](relabel-published-filter-options.md) | Done | — | XS | 2026-09-17 |
| T37 | [Ширина фільтрів](resize-catalog-filter-fields.md) | Done | T35 | XS | 2026-09-17 |
| T38 | [Порожня картка](allow-empty-product-card.md) | Done | — | S | 2026-09-17 |
| T39 | [Прогалини у відкритій картці](name-missing-fields-in-product-form.md) | Done | — | XS | 2026-09-17 |
| T40 | [Компактні фільтри й мітки](compact-catalog-filter-fields.md) | Done | — | XS | 2026-09-17 |
| T41 | [Висота ціни у формі](fix-product-form-field-sizing.md) | Done | T40 | XS | 2026-09-17 |
| T42 | [Кольори бейджа готовності](unify-readiness-badge-colors.md) | Done | T41 | XS | 2026-09-17 |
| T43 | [Перегляд фото з каталогу](add-catalog-image-viewer.md) | Done | — | S | 2026-09-17 |
| T44 | [Лінії в діалозі картки](divide-product-form-dialog.md) | Done | — | XS | 2026-09-17 |
| T45 | [Результат збереження картки](close-product-form-on-save.md) | Done | T44 | S | 2026-09-17 |
| T46 | [Рішення: опис Prom як HTML](decide-prom-description-html.md) | Done | — | S | 2026-09-18 |
| T47 | [Чистка HTML в `api`](sanitize-prom-description-on-save.md) | Done | T46 | S | 2026-09-18 |
| T48 | [Редактор опису Prom](add-prom-description-editor.md) | Done | T46 | S | 2026-09-18 |
| T49 | [Кнопка «Почистити html»](add-prom-description-cleanup-button.md) | Done | T47, T48 | S | 2026-09-18 |

## Поставка 2 — модель

| ID | Задача | Статус | blocked_by | Est | Закрито |
|----|--------|--------|------------|-----|---------|
| T24 | [Закрити відкриті TBD](close-preparation-open-items.md) | Done | T01 | S | 2026-09-18 |
| T25 | [Черга і `worker`](add-queue-and-worker.md) | Done | T23, T42, T43, T49 | S | 2026-09-18 |
| T26 | [Таблиці підготовки](add-preparation-tables-migration.md) | Done | T24, T25 | S | 2026-09-18 |
| T27 | [Адаптер Anthropic](add-anthropic-adapter.md) | Done | T25 | S | 2026-09-19 |
| T28 | [Сервіс підготовки](add-preparation-service.md) | Done | T26, T27 | S | 2026-09-19 |
| T29 | [Маршрути запусків](add-preparation-run-endpoints.md) | Done | T28 | S | 2026-09-19 |
| T30 | [Прийняття пропозицій](add-suggestion-resolution-endpoints.md) | Done | T29 | S | 2026-09-20 |
| T31 | [Вартість картки](add-card-cost-readout.md) | Done | T11, T26 | XS | 2026-09-20 |
| T32 | [Фронт підготовки](add-preparation-ui.md) | Done | T20, T29, T30, T31, T51, T52, T53 | M | 2026-09-20 |
| T33 | [Приймання поставки 2](verify-delivery-2.md) | Blocked | T32, T50, T54 | S | — |
| T50 | [Помилки підготовки в каталозі](show-preparation-failures-in-catalog.md) | Todo | T29, T32 | M | — |
| T51 | [Повтор після відмови](allow-retry-after-failed-run.md) | Done | T29 | S | 2026-09-20 |
| T52 | [Завислі запуски](close-stuck-preparation-runs.md) | Done | T29 | S | 2026-09-20 |
| T53 | [Непідтверджені пропозиції](expose-pending-suggestions.md) | Done | T26, T30 | S | 2026-09-20 |
| T54 | [Пошук ціни: порожній діапазон, вартість, таймаут](bound-the-model-call-timeout.md) | Todo | T27 | M | — |

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
