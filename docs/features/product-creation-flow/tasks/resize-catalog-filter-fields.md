---
id: T37
title: "Ширина полів у панелі фільтрів каталогу"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 2000
blocked_by: [T35]
blocks: []
updated_at: "2026-09-16"
---

# T37 — Ширина полів у панелі фільтрів каталогу

## Context

Запит 2026-09-16: удвічі зменшити ширину полів ціни («Ціна від», «Ціна до») і фільтрів
«Публікація Prom» та «Публікація OLX»; поля «Назва» й «Опис» зробити ширшими. Задача йде
після [T35](add-catalog-readiness-filter.md), щоб новий select «Картка готова» одразу
потрапив до вузьких полів разом із двома іншими булевими фільтрами.

Сьогодні ширину задає одна сітка `.filters`:
`grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr))`, тож усі поля однакові.
Окремий розмір для окремого поля така сітка не задає. Пропонується перейти на
`flex-wrap` з трьома розмірами:

| Клас | Поля | `flex` |
|---|---|---|
| `filters__field--wide` | Назва, Опис | `2 1 20rem` |
| без модифікатора | Категорія | `1 1 13rem` |
| `filters__field--narrow` | Ціна від, Ціна до, Публікація Prom, Публікація OLX, Картка готова | `0 1 6.5rem` |

**Сітка з `span` не підходить.** `grid-column: span 4` на вузькому екрані, де доріжок
менше за чотири, створює неявні колонки — і в результаті зʼявляється горизонтальний
скрол, який T22 прямо забороняє.

**Два ризики, які треба перевірити на екрані, а не в CSS.**

- 6.5rem ≈ 104 px. Мітка «Публікація Prom» у `outline`-полі довша за цю ширину і
  обріжеться трикрапкою. Якщо так і станеться, мінімум вузького поля задає мітка
  (`min-width: max-content` на `mat-form-field`), а не рівно половина. Відступ від
  «удвічі» записати в PR.
- Помилка ціни «Ціна виглядає як 2499 або 2499.00.» у вузькому полі не вміститься в
  один рядок. Її треба скоротити (наприклад, «Формат: 2499.00») або дозволити перенос
  у `mat-error`, щоб текст не обрізався.

`.filters__error` і `.filters__actions` зараз займають рядок через `grid-column: 1 / -1`.
У flex це `flex-basis: 100%`.

## Sequence

Власного сценарію немає — це верстка панелі, запит не змінюється.
[sad.md §6](../sad.md#6-runtime-view) описує таке саме для стану форми картки:

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Немає.** Правка торкається лише `product-catalog.css` і класів у `product-catalog.html`.

## API contract excerpt

Набір полів панелі — це параметри `listProducts`; задача змінює їхню ширину, а не склад:

```yaml
      operationId: listProducts
        - { $ref: "#/components/parameters/TitleFilter" }
        - { $ref: "#/components/parameters/DescriptionFilter" }
        - { $ref: "#/components/parameters/PriceMin" }
        - { $ref: "#/components/parameters/PriceMax" }
        - { $ref: "#/components/parameters/PublishedProm" }
        - { $ref: "#/components/parameters/PublishedOlx" }
```

## Acceptance criteria

Нові AC із запиту 2026-09-16; до [PRD §5](../PRD.md#5-acceptance-criteria) їх вносить
крок 5 чекліста.

**AC-33 (нове) — happy path**
**Given** `user` відкриває `/products` на екрані шириною ≥ 1280 px
**When** панель фільтрів відмальована
**Then** кожне вузьке поле (ціни, публікації, готовність) приблизно вдвічі вужче, ніж було (13rem → 6.5rem або ширина мітки, якщо вона більша), «Назва» й «Опис» ширші за «Категорію», а жодна мітка не обрізана

**AC-34 (нове) — edge case**
**Given** екран шириною 360 px або введена хибна ціна
**When** панель перебудовується
**Then** поля переносяться на нові рядки без горизонтального скролу, а повідомлення про помилку ціни читається повністю

## Checklist

1. `product-catalog.css`: `.filters` → `display: flex; flex-wrap: wrap`; класи `filters__field--wide` / `--narrow` за таблицею вище; `.filters__error` і `.filters__actions` → `flex-basis: 100%` (actions — за потреби).
2. `product-catalog.html`: класи на сімох `mat-form-field` (два wide, п'ять narrow).
3. Перевірити мітки й помилку ціни на 1280 і 360 px; якщо мітка обрізається — `min-width: max-content` на вузьких полях; якщо не влазить помилка — скоротити текст.
4. Playwright-знімок `/products` на 1280 і 360 px додати до PR — це обовʼязкова перевірка для UI-задачі.
5. `PRD.md §5`: AC-33 і AC-34 з лінком на цю story.

## Out of scope

- Склад і порядок фільтрів, їхні підписи — [T35](add-catalog-readiness-filter.md), [T36](relabel-published-filter-options.md).
- Ширина колонок таблиці — не запитувалась.

## DoD

- [ ] AC-33: на 1280 px вузькі поля ≈ вдвічі вужчі, «Назва» й «Опис» ширші за решту, мітки не обрізані — видно на знімку.
- [ ] AC-34: на 360 px горизонтального скролу немає; помилка ціни видна повністю.
- [ ] Наявні тести `product-catalog.spec.ts` лишаються зеленими; `lint` у `web` зелений.
- [ ] Коміт: `style(web): size the catalog filters by their content`.

## Links

- [T22](integrate-catalog-with-form-and-delete.md) — DoD «без горизонтального скролу на вузькому екрані»
- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 10–15 · [openapi.yaml](../contracts/openapi.yaml) — `listProducts`
