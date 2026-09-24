---
status: Draft
owner: "Serhii"
reviewers: []
updated_at: "2026-09-24"
stage: "13"
---

# Tracker — product-creation-flow

Статус кожної задачі. Один рядок = один PR. Легенда розмірів і граф залежностей —
у [_epic.md](_epic.md). Чим задача виявилась на ділі, що знайшло рев'ю і звідки взялись
нові задачі — у [хроніці](../_audit/tracker-journal.md).

**Статуси:** `Todo` · `Blocked` (чекає на deps) · `In progress` · `In review` · `Done` ·
`Deferred` (відкладено рішенням власника; нічого не блокує й у план не входить).

## Зараз

**Готові до старту:** T59, T60, T64, T67, T68, T69, T70, T71 — поставка 3, UI каталогу
й форми. Порядок і інструменти — у [плані виконання](../execution-plan.md). T62 чекає на T59 і T60,
T65 — на T64. Ланцюжок AI-кнопок: T72 чекає на T67 і T71, T73 — на T72, T74 — на T73, T66 — на
T59 і T73.

2026-09-24 закрито T63 (живий пошук за назвою й описом від трьох символів). Нічого не розблокувала:
задач, що на неї чекають, немає. Регістр кирилиці `ILIKE` на `postgres:18-alpine` доведено тестом, тож
міграція не знадобилась.

2026-09-24 закрито T61 (перелік категорій і фільтр за кількома в `api`). T62 вона не розблокувала:
та ще чекає на T59 і T60.

2026-09-23 заведено T68–T74 за десятьма правками форми картки від власника. [T68](keep-prom-description-on-reopen.md)
— дефект: опис для Prom зникає після повторного відкриття. Найімовірніша причина — гонка в редакторі
Tiptap, і задачу починають з її відтворення. [T69](move-generate-all-below-gallery.md) переносить
«Згенерувати все» під галерею, а [T70](show-copyable-product-id.md) показує ID з копіюванням.
[T71](strip-tags-from-field-draft.md) знімає теги з чернетки до моделі.
[T72](add-improve-and-prompt-field-modes.md) заводить два режими поля, `improve` і `prompt`, а
[T73](add-improve-button-and-tonal-ai-actions.md) дає формі третю кнопку й tonal-іконки.
[T74](show-latest-suggestions-in-product-form.md) показує праворуч останню пропозицію з її станом.
Пункт 8 (лоадер замість кнопок) не став новою задачею: це доопрацювання [T66](show-local-ai-progress.md),
яка тепер чекає ще й на T73.

2026-09-23 заведено [T67](generate-titles-with-texts.md): «Згенерувати все» не повертає назв, хоча
модель уже розпізнає товар у тому самому виклику, а без назв картка не стає «Готово» (AC-36).
Прогалина лишилась з часів, коли розпізнавання було ручним: ADR 0014 зробив його автоматичним, але
US-03 і AC-05 так і не переглянули. Задача править лише `ai` і документи, тож від нічого не
залежить; на неї спирається T72.

2026-09-23 закрито [T57](add-top-catalog-paginator.md): пагінатор каталогу стоїть і над таблицею,
і під нею; обидва читають той самий стан із URL, тож перехід у будь-якому видно в іншому. Задача
нічого не розблоковує: залежних у неї немає.

2026-09-22 закрито [T58](wrap-product-titles-in-textarea.md): назви для Prom і OLX у формі — `textarea`,
що росте з текстом; перенос зі вставки стає пробілом, `Enter` нічого не додає. T66 лишається `Blocked`:
вона чекає ще на T59.

2026-09-22 закрито [T56](highlight-catalog-row-on-hover.md): рядок каталогу під курсором
підсвічено токеном `--mat-sys-surface-container`. Задача нічого не розблоковує: залежних у неї немає.

2026-09-21 заведено поставку 3 (T56–T66): десять правок UI каталогу й форми картки, які власник
запросив після приймання поставки 2. Пункт 6 (кілька категорій) розрізано на `api` (T61) і фронт (T62).

2026-09-21 закрито [T55](show-applied-suggestions-in-product-form.md): після «Згенерувати все»
форма показує тексти, які `api` застосував сам, і «Зберегти» їх більше не стирає. Задача нічого
не розблоковує: залежних у неї немає. Далі — деплой поставки 2 на VPS, і його дату треба вписати в
[PRD §7](../PRD.md#7-metrics--kpis).

2026-09-21 закрито [T33](verify-delivery-2.md) — приймання поставки 2
([протокол](../_audit/delivery-2-acceptance-2026-09-21.md)): 9 з 10 AC PASS, AC-05 у формі — FAIL,
звідси T55. Дату релізу поставки 2 визначено як день деплою на VPS, питання «предмет з особистої
колекції» закрито: заяви не вимагаємо. Того ж дня закрито [T50](show-preparation-failures-in-catalog.md),
а [T54](bound-the-model-call-timeout.md) відкладено: пошук ціни через AI задорогий, ціну вписують руками.

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
| T54 | [Пошук ціни: порожній діапазон, вартість, таймаут](bound-the-model-call-timeout.md) | Deferred | T27 | M | — |
| T55 | [Тексти, застосовані `api`, у формі](show-applied-suggestions-in-product-form.md) | Done | — | S | 2026-09-21 |

## Поставка 3 — UI каталогу й форми

Запит 2026-09-21 після приймання поставки 2; T67–T74 додано 2026-09-23. Ланцюжки в `blocked_by` — здебільшого спільні файли
(`product-catalog.*`, `product-form.*`), а не смислові залежності; деталі — в [_epic.md](_epic.md).

| ID | Задача | Статус | blocked_by | Est | Закрито |
|----|--------|--------|------------|-----|---------|
| T56 | [Підсвітка рядка каталогу](highlight-catalog-row-on-hover.md) | Done | — | XS | 2026-09-22 |
| T57 | [Пагінатор над таблицею](add-top-catalog-paginator.md) | Done | — | XS | 2026-09-23 |
| T58 | [Назви Prom/OLX у textarea](wrap-product-titles-in-textarea.md) | Done | — | XS | 2026-09-22 |
| T59 | [Ключові слова як chips](edit-keywords-as-chips.md) | Todo | — | S | — |
| T60 | [Вужчі фільтри-прапорці](narrow-catalog-flag-filters.md) | Todo | — | XS | — |
| T61 | [Перелік категорій і фільтр за кількома в `api`](add-category-list-and-multi-filter.md) | Done | — | S | 2026-09-24 |
| T62 | [Кілька категорій з автодоповненням](pick-catalog-categories-with-autocomplete.md) | Blocked | T59, T60, T61 | S | — |
| T63 | [Живий пошук від трьох символів](search-titles-live-from-three-chars.md) | Done | — | S | 2026-09-24 |
| T64 | [Відмітки публікації як іконки](show-published-as-icons.md) | Todo | — | XS | — |
| T65 | [Ціна й стан у комірці](edit-price-and-condition-inline.md) | Blocked | T64 | S | — |
| T66 | [Локальний індикатор AI](show-local-ai-progress.md) | Blocked | T58, T59, T73 | S | — |
| T67 | [Назви Prom/OLX із «Згенерувати все»](generate-titles-with-texts.md) | Todo | — | S | — |
| T68 | [Опис Prom після повторного відкриття](keep-prom-description-on-reopen.md) | Todo | — | XS | — |
| T69 | [«Згенерувати все» під галереєю](move-generate-all-below-gallery.md) | Todo | — | XS | — |
| T70 | [ID товару з копіюванням](show-copyable-product-id.md) | Todo | — | XS | — |
| T71 | [Чернетка поля без тегів](strip-tags-from-field-draft.md) | Todo | — | XS | — |
| T72 | [Режими поля: покращити й промпт](add-improve-and-prompt-field-modes.md) | Blocked | T67, T71 | S | — |
| T73 | [Три кнопки AI біля поля](add-improve-button-and-tonal-ai-actions.md) | Blocked | T72 | S | — |
| T74 | [Остання пропозиція на поле](show-latest-suggestions-in-product-form.md) | Blocked | T73 | S | — |

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
