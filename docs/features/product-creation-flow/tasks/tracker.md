---
status: Draft
owner: "Serhii"
reviewers: []
updated_at: "2026-10-07"
stage: "13"
---

# Tracker — product-creation-flow

Статус кожної задачі. Один рядок = один PR. Легенда розмірів і граф залежностей —
у [_epic.md](_epic.md). Чим задача виявилась на ділі, що знайшло рев'ю і звідки взялись
нові задачі — у [хроніці](../_audit/tracker-journal.md).

**Статуси:** `Todo` · `Blocked` (чекає на deps) · `In progress` · `In review` · `Done` ·
`Deferred` (відкладено рішенням власника; нічого не блокує й у план не входить) ·
`Dropped` (скасовано рішенням власника; не повернеться, номер не перевикористовується).

## Зараз

**Готові до старту:** T96.
T102 закрито 2026-10-07 й нічого не розблокувала: від неї ніщо не залежить.
T101 закрито 2026-10-07: вона розблокувала T102 — остання з її `blocked_by`.
T101–T102 заведено 2026-10-07 (поставка 3): каталог за замовчуванням — найсвіжіші зверху, фільтри застосовуються самі. Ребро T101 → T102 — спільні `product-catalog.*`.
T95 закрито 2026-10-06 й нічого не розблокувала: T100 ще чекає на T99.
T94 закрито 2026-10-06: вона розблокувала T95 (теж закрито того ж дня); T97 ще чекає на T96.
T94–T100 заведено 2026-10-05 (поставка 4): вартість картки в доларах і цінова вилка всередині «Згенерувати все».
Доріжка вартості T94 → T95, доріжка ціни T96 → T97 → T98 → T99 → T100; сходяться на T100 через `product-form.*`.
T54 скасовано 2026-10-05 (`Dropped`): кнопку ціни скасовано, її фікси перейшли в T96, T98 і T99.
T82 закрито 2026-10-04 й нічого не розблокувала: від неї ніщо не залежить.
T81 закрито 2026-10-04 й нічого не розблокувала: від неї ніщо не залежить.
T93 закрито 2026-10-03 й нічого не розблокувала: від неї ніщо не залежить.
T93 заведено 2026-10-03: довга пропозиція моделі розтягує панель, і кнопки AI з'їжджають донизу. Ребер не має.
T92 закрито 2026-10-03: вона розблокувала T82 — остання з її `blocked_by`.
T91 закрито 2026-10-03: вона розблокувала T92; T82 ще чекає на T92.
T66 закрито 2026-10-03: вона розблокувала T81 — остання з її `blocked_by`.
T90 закрито 2026-10-03: вона розблокувала T91 і T66; T81 ще чекає на T66.
T89 скасовано 2026-10-03 (`Dropped`): падіння не відтворилось на 120 прогонах під навантаженням; ребро до T81 знято.
T87 закрито 2026-10-03 й нічого не розблокувала: T81 ще чекає на решту своїх `blocked_by`.
T86 закрито 2026-10-03 й нічого не розблокувала: від неї ніщо не залежить.
T83 закрито 2026-10-03: вона розблокувала T90; T81 ще чекає на решту своїх `blocked_by`.
T84 скасовано 2026-10-02 (`Dropped`, [ADR 0017](../adr/0017-keep-one-latest-suggestion-per-field.md)), замість неї
заведено T90–T92: одна пропозиція на поле, без статусів.
T80 закрито 2026-10-02: вона розблокувала T87; T81 ще чекає на решту своїх `blocked_by`.
T76 закрито 2026-10-02 й нічого не розблокувала: від неї ніщо не залежить.
T89 заведено 2026-10-02 за нестабільним першим тестом форми, знайденим під час T88.
T88 закрито 2026-10-02 й нічого не розблокувала: T81 ще чекає на решту своїх `blocked_by`.
T85 закрито 2026-10-02 й нічого не розблокувала: T81 ще чекає на решту своїх `blocked_by`.
T79 закрито 2026-10-02: вона розблокувала T80. T75 закрито того ж дня й нічого не розблокувала: T80 тоді ще чекала на T79.
T74 закрито 2026-10-02: вона розблокувала T84 і T82; T66 ще чекає на T84, T81 — на решту своїх `blocked_by`.
T83–T87 заведено 2026-10-02 за UX-аудитом, T88 — того ж дня за нестабільним тестом редактора. T68 і T70 закрито 2026-10-02 й нічого не розблокували: T81 ще чекає на решту своїх `blocked_by`.

Записи про закриті й заведені задачі з 2026-09-21 — у [хроніці](../_audit/tracker-journal.md).

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
| T33 | [Приймання поставки 2](verify-delivery-2.md) | Done | T32, T50 | S | 2026-09-21 |
| T50 | [Помилки підготовки в каталозі](show-preparation-failures-in-catalog.md) | Done | T29, T32 | M | 2026-09-21 |
| T51 | [Повтор після відмови](allow-retry-after-failed-run.md) | Done | T29 | S | 2026-09-20 |
| T52 | [Завислі запуски](close-stuck-preparation-runs.md) | Done | T29 | S | 2026-09-20 |
| T53 | [Непідтверджені пропозиції](expose-pending-suggestions.md) | Done | T26, T30 | S | 2026-09-20 |
| T54 | [Пошук ціни: порожній діапазон, вартість, таймаут](bound-the-model-call-timeout.md) | Dropped | T27 | M | — |
| T55 | [Тексти, застосовані `api`, у формі](show-applied-suggestions-in-product-form.md) | Done | — | S | 2026-09-21 |

## Поставка 3 — UI каталогу й форми

Запит 2026-09-21 після приймання поставки 2; T67–T74 додано 2026-09-23, T75–T77 — 2026-09-25, T78–T82 — 2026-09-30, T83–T87 — 2026-10-02 (UX-аудит), T88 — 2026-10-02 (нестабільний тест), T89 — 2026-10-02 (знахідка T88), T90–T92 — 2026-10-02 (ADR 0017, замість T84), T93 — 2026-10-03, T101–T102 — 2026-10-07. Ланцюжки в `blocked_by` — здебільшого спільні файли
(`product-catalog.*`, `product-form.*`), а не смислові залежності; деталі — в [_epic.md](_epic.md).

| ID | Задача | Статус | blocked_by | Est | Закрито |
|----|--------|--------|------------|-----|---------|
| T56 | [Підсвітка рядка каталогу](highlight-catalog-row-on-hover.md) | Done | — | XS | 2026-09-22 |
| T57 | [Пагінатор над таблицею](add-top-catalog-paginator.md) | Done | — | XS | 2026-09-23 |
| T58 | [Назви Prom/OLX у textarea](wrap-product-titles-in-textarea.md) | Done | — | XS | 2026-09-22 |
| T59 | [Ключові слова як chips](edit-keywords-as-chips.md) | Done | — | S | 2026-09-25 |
| T60 | [Вужчі фільтри-прапорці](narrow-catalog-flag-filters.md) | Done | — | XS | 2026-09-25 |
| T61 | [Перелік категорій і фільтр за кількома в `api`](add-category-list-and-multi-filter.md) | Done | — | S | 2026-09-24 |
| T62 | [Кілька категорій з автодоповненням](pick-catalog-categories-with-autocomplete.md) | Done | T59, T60, T61 | S | 2026-09-25 |
| T63 | [Живий пошук від трьох символів](search-titles-live-from-three-chars.md) | Done | — | S | 2026-09-24 |
| T64 | [Відмітки публікації як іконки](show-published-as-icons.md) | Done | — | XS | 2026-09-25 |
| T65 | [Ціна й стан у комірці](edit-price-and-condition-inline.md) | Done | T64 | S | 2026-09-27 |
| T66 | [Локальний індикатор AI](show-local-ai-progress.md) | Done | T58, T59, T73, T74, T90 | S | 2026-10-03 |
| T67 | [Назви Prom/OLX із «Згенерувати все»](generate-titles-with-texts.md) | Done | — | S | 2026-09-27 |
| T68 | [Опис Prom після повторного відкриття](keep-prom-description-on-reopen.md) | Done | — | XS | 2026-10-02 |
| T69 | [«Згенерувати все» під галереєю](move-generate-all-below-gallery.md) | Done | — | XS | 2026-09-27 |
| T70 | [ID товару з копіюванням](show-copyable-product-id.md) | Done | — | XS | 2026-10-02 |
| T71 | [Чернетка поля без тегів](strip-tags-from-field-draft.md) | Done | — | XS | 2026-09-28 |
| T72 | [Режими поля: покращити й промпт](add-improve-and-prompt-field-modes.md) | Done | T67, T71 | S | 2026-10-01 |
| T73 | [Три кнопки AI біля поля](add-improve-button-and-tonal-ai-actions.md) | Done | T72 | S | 2026-10-01 |
| T74 | [Остання пропозиція на поле](show-latest-suggestions-in-product-form.md) | Done | T73 | S | 2026-10-02 |
| T75 | [Компактніший шрифт](compact-app-typography.md) | Done | — | XS | 2026-10-02 |
| T76 | [Кадри картки 120×120](shrink-card-gallery-frames.md) | Done | — | XS | 2026-10-02 |
| T77 | [Рівні відступи в картці](even-out-card-form-spacing.md) | Done | T69 | XS | 2026-09-27 |
| T78 | [Компактні іконки редагування в комірці](shrink-cell-editor-icons.md) | Done | — | XS | 2026-10-01 |
| T79 | [Скролиться лише вміст таблиці](pin-catalog-header-filters-and-paginator.md) | Done | T78 | S | 2026-10-02 |
| T80 | [Нижчі тулбар, шапка й фільтри](shrink-app-bar-catalog-header-and-filters.md) | Done | T75, T79 | XS | 2026-10-02 |
| T81 | [Номери задач і AC з коду `web`](drop-task-references-from-web-code.md) | Done | T66, T68, T70, T74, T80, T83, T85, T87, T88, T90 | S | 2026-10-04 |
| T82 | [Номери задач і AC з коду `api`](drop-task-references-from-api-code.md) | Done | T74, T91, T92 | S | 2026-10-04 |
| T83 | [Незбережені правки картки](confirm-discarding-unsaved-card-edits.md) | Done | — | S | 2026-10-03 |
| T84 | [Відхилити пропозицію](add-reject-suggestion-button.md) | Dropped | T74 | S | — |
| T85 | [Кома в ціні](accept-decimal-comma-in-price.md) | Done | — | XS | 2026-10-02 |
| T86 | [Одна помилка входу](show-login-credentials-error-once.md) | Done | — | XS | 2026-10-03 |
| T87 | [Назва OLX другим рядком](show-olx-title-under-prom-title.md) | Done | T80 | XS | 2026-10-03 |
| T88 | [Spec-и чекають редактор за часом](wait-for-prom-editor-by-time-in-specs.md) | Done | — | XS | 2026-10-02 |
| T89 | [Перший тест форми під навантаженням](stabilize-first-product-form-spec-test.md) | Dropped | — | XS | — |
| T90 | [Стрілка копіює у форму](copy-suggestion-into-form-field.md) | Done | T74, T83 | S | 2026-10-03 |
| T91 | [Без прийняття пропозицій в `api`](drop-server-side-suggestion-accept.md) | Done | T90 | S | 2026-10-03 |
| T92 | [Одна пропозиція на поле](keep-one-suggestion-per-field.md) | Done | T91 | S | 2026-10-03 |
| T93 | [Кнопки AI вгорі, пропозиція з межею](cap-suggestion-height-and-pin-ai-buttons.md) | Done | — | XS | 2026-10-03 |
| T101 | [Найсвіжіші картки зверху](sort-catalog-newest-first.md) | Done | — | S | 2026-10-07 |
| T102 | [Фільтри без кнопки «Застосувати»](apply-catalog-filters-live.md) | Done | T101 | S | 2026-10-07 |

## Поставка 4 — вартість і ціна від AI

Запит 2026-10-05. Ребро T95 → T100 — спільні `product-form.*`, а не смисл; решта ребер змістовні,
деталі — в [_epic.md](_epic.md). Якщо замір T96 дасть no-go, T97–T100 стають `Deferred`.

| ID | Задача | Статус | blocked_by | Est | Закрито |
|----|--------|--------|------------|-----|---------|
| T94 | [Вартість картки в доларах в `api`](add-card-cost-in-usd.md) | Done | — | S | 2026-10-06 |
| T95 | [Вартість картки в доларах у формі](show-card-cost-in-usd.md) | Done | T94 | XS | 2026-10-06 |
| T96 | [Рішення: ціна в «Згенерувати все»](decide-price-range-in-generate-all.md) | Todo | — | S | — |
| T97 | [Кількість пошуків у запуску](record-web-searches-per-run.md) | Blocked | T94, T96 | S | — |
| T98 | [Пошук ціни падає видимо](make-price-lookup-fail-loudly.md) | Blocked | T96, T97 | S | — |
| T99 | [Ціна за згенерованими текстами](find-price-from-generated-texts.md) | Blocked | T98 | S | — |
| T100 | [Вилка — підказкою під ціною](show-ai-price-range-as-hint.md) | Blocked | T95, T99 | S | — |

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
