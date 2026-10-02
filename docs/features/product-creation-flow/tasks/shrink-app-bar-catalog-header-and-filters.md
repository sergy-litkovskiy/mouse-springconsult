---
id: T80
title: "Нижчі тулбар, шапка й фільтри каталогу"
status: Done
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 2000
blocked_by: [T75, T79]
blocks: [T81, T87]
updated_at: "2026-10-02"
---

# T80 — Нижчі тулбар, шапка й фільтри каталогу

## Context

Запит 2026-09-30, пункт 3. Над таблицею стоять три блоки, і разом вони займають майже половину екрана.
Виміряно на `/products` при 1280×720:

| Блок | Зараз |
|---|---|
| `mat-toolbar` | 64 px |
| `.catalog` (відступ зверху й між блоками) | 24 px і 16 px |
| `.catalog__header` | 40 px (кнопка «Нова картка» 40 px) |
| `.catalog__filters` | 172 px: два рядки полів по 66 px (поле 46 + 20 px зарезервованого місця під помилку), відступ картки 16 px |
| верх таблиці | 332 px із 720 |

Після [T79](pin-catalog-header-filters-and-paginator.md) ці блоки ще й прикріплені, тож кожен їхній піксель
забирає місце в таблиці постійно. Власник просить значно менше.

**Експеримент** (2026-09-30, стилі вписано в живу сторінку без правки коду): токени тулбара (48 px), відступи
`.catalog` 8 px, поле 36 px й відступ картки 8 px дали верх таблиці на 253 px, а картка фільтрів вийшла 114 px.
Решту з'їли два місця, які самими токенами не виправити: рядок `filters__actions` тримає висоту 54 px, а
усі поля, крім двох полів ціни, резервують під помилку 20 px (`subscriptSizing="dynamic"` стоїть лише на них). Звідси й цілі нижче.

**Цілі при 1280 px** (звужувати нижче не треба):

| Блок | Було | Стане |
|---|---|---|
| `mat-toolbar` | 64 | 48 |
| `.catalog__header` | 40 | ≤ 34 |
| `.catalog__filters` | 172 | ≤ 100 |
| верх таблиці | 332 | ≤ 216 |

**Як.** Токени `mat-toolbar` (`--mat-toolbar-standard-height` і `--mat-toolbar-mobile-height`, бо на вузькому екрані
береться друга); менші відступи `.catalog`; щільніші кнопки в шапці й у `.filters__actions`; висота поля й відступ
картки фільтрів; `subscriptSizing="dynamic"` на решті полів фільтра. Назви токенів звірити з prebuilt-темою в
контейнері `web`. Шрифт не чіпаємо: розмір тексту — справа [T75](compact-app-typography.md), тому ця задача
стоїть за нею, а висоту шапки міряємо вже з h1 у 20 px.

Помилки полів фільтра ще мають бути видимі: `dynamic` дає їм місце лише тоді, коли вони є.

## Sequence

Власного сценарію немає: це верстка, запити не змінюються. Так само
[sad.md §6](../sad.md#6-runtime-view) описує стан форми:

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Немає.** Правка торкається `app-layout.*`, `product-catalog.css` і `product-catalog.html` (атрибут `subscriptSizing`).

## API contract excerpt

Фільтри лишаються тими самими параметрами `listProducts`; змінюється лише розмір панелі:

```yaml
      operationId: listProducts
        - { $ref: "#/components/parameters/Page" }
        - { $ref: "#/components/parameters/PageSize" }
```

## Acceptance criteria

Нове AC із запиту 2026-09-30; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 4 чекліста.

**AC-75 (нове) — happy path**
**Given** `user` відкриває `/products` на екрані 1280×720
**When** каталог відмальований
**Then** `mat-toolbar` має висоту 48 px, шапка каталогу — не більше 34 px, панель фільтрів — не більше 100 px, а верх таблиці стоїть не нижче за 216 px від верху вікна

**AC-75 — edge case**
**Given** `user` відкриває `/products` на екрані 360×740, а в фільтрі «Ціна від» некоректне значення
**When** каталог відмальований
**Then** верх таблиці стоїть не нижче за 560 px (було 748), помилка поля видна повністю, а горизонтального скролу сторінки немає

## Checklist

1. Звірити назви токенів `mat-toolbar`, кнопок і `mat-form-field` з prebuilt-темою в контейнері `web`; `app-layout.css` — висота тулбара 48 px (обидва токени).
2. `product-catalog.css`: відступи й проміжки `.catalog`, щільні кнопки шапки й `.filters__actions`, висота поля й відступ картки `.filters`; без `px` для кольорів і без `!important`.
3. `product-catalog.html`: `subscriptSizing="dynamic"` на полях «Назва», «Опис», «Категорія» і трьох селектах, щоб не резервувати місце під помилку.
4. `PRD.md §5`: AC-75 з посиланням на цю story.
5. `pw`: 1280×720 і 360×740, з помилкою в «Ціна від» і без; `getBoundingClientRect()` тулбара, шапки, фільтрів і таблиці; знімки зберегти.

## Out of scope

- Розмір шрифту ([T75](compact-app-typography.md)) і висота рядків таблиці.
- Згортання фільтрів у панель, що розкривається, і прикріплення блоків до вікна ([T79](pin-catalog-header-filters-and-paginator.md)).

## DoD

- [x] AC-75: на 1280 px тулбар 48, шапка ≤ 34, фільтри ≤ 100, верх таблиці ≤ 216; на 360 px верх таблиці ≤ 560.
- [x] Наявні тести `web` зелені без правок, `lint` зелений.
- [x] Коміт: `style(web): shrink the app bar, catalog header and filters`.

## Links

- [T79](pin-catalog-header-filters-and-paginator.md) — прикріплений каркас сторінки · [T75](compact-app-typography.md) — шрифт, від якого залежить висота шапки
- [T40](compact-catalog-filter-fields.md) — попереднє ущільнення полів · [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 10–15 · [openapi.yaml](../contracts/openapi.yaml) — `listProducts`
