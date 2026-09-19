---
status: Draft
owner: "Serhii"
reviewers: []
updated_at: "2026-09-19"
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
| T18 | [Клієнт API на фронті](extend-products-api-client.md) | Done | T05 | S | Serhii | — |
| T19 | [Діалог підтвердження](add-confirm-dialog.md) | Done | — | XS | Serhii | — |
| T20 | [Форма картки (MatDialog)](add-product-form-subfeature.md) | Done | T18, T38 | M | Serhii | — |
| T21 | [Секція галереї](add-gallery-upload-dialog.md) | Done | T18, T19 | S | Serhii | — |
| T22 | [Каталог](integrate-catalog-with-form-and-delete.md) | Done | T18, T19, T20, T34 | S | Serhii | — |
| T23 | [Приймання поставки 1](verify-delivery-1.md) | Done | T14–T22, T37 | S | Serhii | — |

## Поставка 1 — доопрацювання каталогу

| ID | Задача | Статус | blocked_by | Est | Owner | PR |
|----|--------|--------|------|-----|-------|-----|
| T34 | [Фільтр готовності в `api`](add-readiness-list-filter.md) | Done | — | S | Serhii | — |
| T35 | [Фільтр «Картка готова»](add-catalog-readiness-filter.md) | Done | T34, T36 | XS | Serhii | — |
| T36 | [Варіанти «Всі / Так / Ні»](relabel-published-filter-options.md) | Done | — | XS | Serhii | — |
| T37 | [Ширина фільтрів](resize-catalog-filter-fields.md) | Done | T35 | XS | Serhii | — |
| T38 | [Порожня картка](allow-empty-product-card.md) | Done | — | S | Serhii | — |
| T39 | [Прогалини у відкритій картці](name-missing-fields-in-product-form.md) | Done | — | XS | Serhii | — |

## Поставка 1 — UI-доопрацювання

Запит 2026-09-17. Задачі треба закрити до старту поставки 2, тому T25 чекає на T42 і T43.

| ID | Задача | Статус | blocked_by | Est | Owner | PR |
|----|--------|--------|------|-----|-------|-----|
| T40 | [Компактні фільтри й мітки](compact-catalog-filter-fields.md) | Done | — | XS | Serhii | — |
| T41 | [Висота ціни у формі](fix-product-form-field-sizing.md) | Done | T40 | XS | Serhii | — |
| T42 | [Кольори бейджа готовності](unify-readiness-badge-colors.md) | Done | T41 | XS | Serhii | — |
| T43 | [Перегляд фото з каталогу](add-catalog-image-viewer.md) | Done | — | S | Serhii | — |
| T44 | [Лінії в діалозі картки](divide-product-form-dialog.md) | Done | — | XS | Serhii | — |
| T45 | [Результат збереження картки](close-product-form-on-save.md) | Done | T44 | S | Serhii | — |

## Поставка 1 — опис Prom у HTML

Запит 2026-09-18. Задачі треба закрити до старту поставки 2, тому T25 чекає на T49. T46 — рішення
(ADR 0016): запит суперечить правилу «Не додаємо WYSIWYG-редактор» з кореневого `CLAUDE.md`.

| ID | Задача | Статус | blocked_by | Est | Owner | PR |
|----|--------|--------|------|-----|-------|-----|
| T46 | [Рішення: опис Prom як HTML](decide-prom-description-html.md) | Done | — | S | Serhii | — |
| T47 | [Чистка HTML в `api`](sanitize-prom-description-on-save.md) | Done | T46 | S | Serhii | — |
| T48 | [Редактор опису Prom](add-prom-description-editor.md) | Done | T46 | S | Serhii | — |
| T49 | [Кнопка «Почистити html»](add-prom-description-cleanup-button.md) | Done | T47, T48 | S | Serhii | — |

## Поставка 2 — модель

| ID | Задача | Статус | blocked_by | Est | Owner | PR |
|----|--------|--------|------|-----|-------|-----|
| T24 | [Закрити відкриті TBD](close-preparation-open-items.md) | Done | T01 | S | Serhii | — |
| T25 | [Черга і `worker`](add-queue-and-worker.md) | Done | T23, T42, T43, T49 | S | Serhii | — |
| T26 | [Таблиці підготовки](add-preparation-tables-migration.md) | Done | T24, T25 | S | Serhii | — |
| T27 | [Адаптер Anthropic](add-anthropic-adapter.md) | Done | T25 | S | Serhii | — |
| T28 | [Сервіс підготовки](add-preparation-service.md) | Todo | T26, T27 | S | Serhii | — |
| T29 | [Маршрути запусків](add-preparation-run-endpoints.md) | Blocked | T28 | S | Serhii | — |
| T30 | [Прийняття пропозицій](add-suggestion-resolution-endpoints.md) | Blocked | T29 | S | Serhii | — |
| T31 | [Вартість картки](add-card-cost-readout.md) | Todo | T11, T26 | XS | Serhii | — |
| T32 | [Фронт підготовки](add-preparation-ui.md) | Blocked | T20, T29, T30, T31 | M | Serhii | — |
| T33 | [Приймання поставки 2](verify-delivery-2.md) | Blocked | T32, T50 | S | Serhii | — |
| T50 | [Помилки підготовки в каталозі](show-preparation-failures-in-catalog.md) | Blocked | T29, T32 | M | Serhii | — |

## Готові до старту просто зараз

T28, T31 — жодної незакритої залежності.

**2026-09-17 закрито бекенд-доріжку поставки 1:** T06, T07, T08, T11, T12, T34, T15, T14, T16, T17.
Розблоковано: T07 (після T06), T08 (після T07), T12, T15 і T16 (після T11), T14 (після T12), T17
(після T16). T34 нічого не розблокувала: T35 чекає ще й на T36, T22 — на T18 і T20. T23 чекає
на решту поставки, зокрема на веб-доріжку T18 → T36 → T35 → T37 → T20 → T21 → T22.

**2026-09-17 закрито T18** (перша задача веб-доріжки). Вона розблокувала T20 і T21 (T19 уже Done).
T22 чекає ще й на T20.

**2026-09-17 закрито T36.** Вона розблокувала T35 (T34 уже Done).

**2026-09-17 закрито T35.** Вона розблокувала T37.

**2026-09-17 закрито T37.** Нічого не розблокувала: T23 чекає ще й на T20–T22.

**2026-09-17 додано T38.** Без порожньої картки діалог T20 не може створити нову: кадр
вантажиться лише в наявну картку, а поля до першого кадру вимкнені (AC-20). T20 знову Blocked до T38.

**2026-09-17 закрито T38.** Вона розблокувала T20.

**2026-09-17 закрито T20.** Вона розблокувала T22. Порядок з execution-plan лишається: спершу T21, бо T22 перевіряє форму разом із галереєю.

**2026-09-17 закрито T21.** Нічого не розблокувала: T23 чекає ще й на T22.

**2026-09-17 закрито T22** і з нею веб-доріжку поставки 1. Вона розблокувала T23 (приймання, Plan mode).

**2026-09-17 закрито T23** і з нею поставку 1: закрито T23 — розблокувала T25. Протокол —
[_audit/delivery-1-acceptance-2026-09-17.md](../_audit/delivery-1-acceptance-2026-09-17.md). Приймання
знайшло один дефект: форма не називає, чого бракує до готовності (AC-15). Його заведено як T39, і він нічого не блокує.

**2026-09-17 закрито T39.** Нічого не розблокувала: жодна задача на неї не чекала.

**2026-09-17 додано T40–T43** (UI-доопрацювання, запит 2026-09-17): їх треба закрити до поставки 2.
T25 знову Blocked, тепер до T42 і T43.

**2026-09-17 закрито T40.** Вона розблокувала T41.

**2026-09-17 закрито T41.** Вона розблокувала T42.

**2026-09-17 закрито T42.** Нічого не розблокувала: T25 чекає ще й на T43.

**2026-09-17 закрито T43** і з нею UI-доопрацювання. Вона розблокувала T25, тож поставку 2 можна починати.

**2026-09-18 закрито T24.** Нічого не розблокувала: T26 чекає ще й на T25. Рішення №5 схему не
змінює (`failed` з `price_unavailable`, без статусу per-scope), тож міграція T26 іде за data-model.md
як є; вікно частоти — 20 запусків на картку за годину.

**2026-09-18 закрито T25.** Вона розблокувала T26 (T24 закрита раніше) і T27. Задача доходить до
`worker` за 249–787 мс. Готові до старту: T26 і T27, у будь-якому порядку.

**2026-09-18 закрито T26.** Вона розблокувала T31 (T11 закрита раніше). T28 чекає ще й на T27.

**2026-09-19 закрито T27.** Вона розблокувала T28 (T26 закрита раніше): обидві залежності T28
тепер Done. Живий прогін на 4 реальних фото (у story) знайшов, що `user_location.country: 'UA'`
провайдер пошуку не підтримує — замінено на `timezone: 'Europe/Kyiv'`.

**2026-09-19 додано T50** (запит під час T28): кількість невдалих запусків підготовки в каталозі й попап з текстами помилок. T33 тепер чекає й на неї.

**2026-09-17 додано T44 і T45** (друга хвиля UI-доопрацювання): лінії в діалозі картки й результат збереження. Вони нічого не блокують.

**2026-09-17 закрито T44.** Вона розблокувала T45.

**2026-09-17 закрито T45** і з нею другу хвилю UI-доопрацювання. Нічого не розблокувала: жодна задача на неї не чекала. Друга GWT з T39 знята.

**2026-09-18 додано T46–T49** (опис Prom у HTML, запит 2026-09-18): їх треба закрити до поставки 2.
T25 знову Blocked, тепер до T49.

**2026-09-18 закрито T46** ([ADR 0016](../adr/0016-store-the-prom-description-as-html.md)). Вона розблокувала T47 і T48.

**2026-09-18 закрито T47.** Нічого не розблокувала: T49 чекає ще й на T48. Ліміт довжини
знято з обох описів (ADR 0016 №6).

**2026-09-18 закрито T48.** Вона розблокувала T49: T47 закрита раніше.

**2026-09-18 закрито T49** і з нею третю хвилю (опис Prom у HTML). Вона розблокувала T25, тож
поставку 2 можна починати.

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
