---
id: T125
title: "Прибрати поле «Категорія» і фільтр каталогу з фронту"
status: Todo
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1500
blocked_by: []
blocks: [T126]
updated_at: "2026-10-10"
---

# T125 — Прибрати поле «Категорія» і фільтр каталогу з фронту

## Context

Перша половина US-05. Фронт перестає показувати й надсилати `category`, **поки контракт її ще
має**. Тоді [T126](drop-product-category.md) видалить поле з API, і жоден PR не ламає typecheck
`web`: прибрати використання поля можна, доки воно є в типі, а навпаки — ні.

Що зникає:

- `form/product-form.*`: контрол `category`, його валідатор і рядок у тілі збереження;
- `catalog/product-catalog.*`: чипи категорій, підказка за `listCategories()`, вхід `category` з
  адреси;
- `catalog/product-catalog-query.ts`: `toCategoryFilter`;
- `products-api.ts`: `listCategories()`.

`?category=` у збереженій адресі каталогу фронт мовчки ігнорує (AC-16): вхід просто зникає, а
`withComponentInputBinding` невідомий параметр не прив'язує. API у цьому PR ще приймає фільтр,
але фронт його більше не шле.

## Sequence

[sad.md §6](../sad.md#6-runtime-view) не має діаграми для US-05: видалення поля — не відправка.
Найближчий крок — читання картки, після якого форма показує поля:

> `api->>pg: читає збережену картку, перевіряє готовність і межі Prom`

## Data delta

**Немає в цьому PR.** Колонка `products.category` лишається до [T126](drop-product-category.md).
Фронт просто перестає її писати: `PATCH` без `category` значення в колонці не чіпає.

## API contract excerpt

```yaml
  /products:
    get:
      operationId: listProducts
        Маршрут той самий, без параметра `category` (AC-16). `productListQuerySchema` — нестрога
        `z.object`, тож `?category=` зі збереженої адреси після видалення поля відкидається без
        `400`, і каталог відкривається без фільтра. Фронт так само ігнорує цей параметр у своїй
        адресі.
```

## Acceptance criteria

**AC-16** (US-05) — happy path, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** адмінка до фічі мала поле «Категорія» й фільтр каталогу за ним
**When** user відкриває картку, форму нової картки чи каталог
**Then** поля «Категорія» й фільтра за ним ніде немає

**AC-16** (US-05) — збережена адреса
**Given** закладка каталогу з `?category=Периферія`
**When** user відкриває її
**Then** каталог відкривається без фільтра й без помилки, а параметр зникає з адреси при наступній зміні фільтрів

## Checklist

1. `product-form.ts` / `.html`: прибрати контрол `category`, `categoryMaxLength`, рядок у `toSaveBody` і в заповненні форми з картки. Spec форми: без поля.
2. `product-catalog.ts` / `.html`: прибрати вхід `category`, `appliedCategories`, чипи, підказку й `listCategories()`. `?category=` з адреси не читається. Spec каталогу: адреса з `?category=` дає каталог без фільтра.
3. `product-catalog-query.ts`: прибрати `toCategoryFilter` і `categoryText`; spec — відповідні випадки.
4. `products-api.ts`: прибрати `listCategories()` і тип `ProductCategoryList` з імпорту; spec.
5. Перевірити Playwright: форма картки й каталог без «Категорії», закладка з `?category=` відкривається.

## Out of scope

- Колонка, контракт, маршрут `/products/categories` і скрипт імпорту ([T126](drop-product-category.md)).
- `productConstraints.categoryMaxLength` у `products-limits.ts` (T126).

## DoD

- [ ] `grep -ri category apps/web/src` порожній, окрім коментарів, що пояснюють ігнорування `?category=`.
- [ ] Тести й typecheck `web` зелені; Playwright-перевірка пройдена.
- [ ] Коміт: `feat(web): remove the category field and catalogue filter`.

## Links

- [PRD §5](../PRD.md#5-acceptance-criteria) AC-16 · [data-model.md](../data-model.md), `products`
- [sad.md §5](../sad.md#5-building-block-view), файли `apps/web/src/app/products/`
