---
id: T126
title: "Видалити products.category з БД, контракту й API"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1800
blocked_by: [T125]
blocks: [T127, T134, T142]
updated_at: "2026-10-10"
---

# T126 — Видалити products.category з БД, контракту й API

## Context

Друга половина US-05. Фронт уже не читає й не шле `category` ([T125](remove-category-from-web.md)),
тож поле зникає з бекенду однією зміною. **Названий виняток атомарності:** міграція, entity,
контракт, репозиторій, контролер і скрипт імпорту нероздільні за деплоєм. Entity без колонки
ламає читання до міграції, а контракт з `category` у `required` ламає мапінг після неї.

- Міграція `<timestamp>-drop-product-category.ts`: `up` — `drop column category`; `down` повертає
  `varchar(120) not null default ''` **без значень**. Копії немає, бо джерело значень — експорт
  Prom (PRD §8, закрито).
- `Product.ts`, `ProductRepository.ts` (фільтр і `listCategories`), `ProductController.ts`
  (маршрут `GET /products/categories` і мапінг), `products.contract.ts` (`category` у картці,
  тілах і фільтрі списку; `ProductCategoryList`), `products-limits.ts` (`categoryMaxLength`,
  `categoryFilterMaxItems`).
- `db/prom-xlsx.ts` і `db/import-prom.ts`: колонка «Назва_групи» більше не читається.
- Специ, що згадують `category`: products, preparation, `ai/PreparationService.spec.ts`,
  `db/schema.spec.ts`, `db/prom-xlsx.spec.ts`.

`productListQuerySchema` лишається нестрогою, тож `?category=` відкидається без `400` (AC-16).
Надіслана в `PATCH` `category` так само відкидається: стара вкладка збереже картку без помилки.

## Sequence

[sad.md §6](../sad.md#6-runtime-view) — та сама картка, яку читає старт відправки, тепер без
`category`:

> `api->>pg: читає збережену картку, перевіряє готовність і межі Prom`

## Data delta

`products`: **− `category` VARCHAR(120) NOT NULL DEFAULT ''**, разом зі значеннями
([data-model.md](../data-model.md), `products`). Індексу під неї не було. DoD міграції: вниз і
вгору в локальному контейнері на копії бази **з даними** (557 імпортованих карток мають
категорію).

## API contract excerpt

```yaml
    Product:
      type: object
        Картка з контракту product-creation-flow без `category` (US-05) і з двома полями стану на
    ProductUpdateRequest:
        Усі поля опційні. Без `category`; `titleProm` — до 130 знаків (AC-05). Надіслана
        `category` відкидається нестрогою схемою, а не дає `400`: стара вкладка, відкрита до
        релізу, збереже картку без помилки.
```

## Acceptance criteria

**AC-16** (US-05) — happy path, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** закладка каталогу з `?category=Периферія`
**When** фронт чи будь-який клієнт викликає `GET /products?category=Периферія`
**Then** відповідь `200` без фільтра, а не `400`

**AC-16** (US-05) — збереження зі старої вкладки
**Given** вкладка, відкрита до релізу, шле `PATCH` з `category`
**When** бекенд розбирає тіло
**Then** картку збережено, `category` відкинуто без помилки, а `GET /products/categories` — `404`

## Checklist

1. Міграція `drop-product-category` з робочим `down`; `db/schema.spec.ts` — колонки немає.
2. `Product.ts`, `ProductRepository.ts` (фільтр, `listCategories`), `ProductController.ts` (маршрут `/categories`, мапінг) — без `category`; їхні специ.
3. `products.contract.ts` і `products-limits.ts` — без `category`, `ProductCategoryList`, `categoryMaxLength`, `categoryFilterMaxItems`; spec контракту — `?category=` і `category` в `PATCH` відкидаються без помилки.
4. `db/prom-xlsx.ts`, `db/import-prom.ts` і `db/prom-xlsx.spec.ts` — без «Назва_групи».
5. Решта спеців з `category` (preparation, `ai/PreparationService.spec.ts`) — прибрати поле з фікстур.
6. Міграція вниз і вгору на копії бази з даними; `docker compose run` без `--no-deps` не запускати.

## Out of scope

- Фронт ([T125](remove-category-from-web.md)).
- Контракти product-creation-flow і price-range-search: їх замінює контракт цієї фічі ([api-sync-report.md](../contracts/api-sync-report.md), Follow-up).

## DoD

- [ ] `grep -rn category apps/api/src apps/api/db` знаходить лише наявні міграції й нову `drop-product-category`.
- [ ] Міграція вниз і вгору в локальному контейнері на копії бази з даними.
- [ ] Тести обох застосунків, typecheck і `deps:check` зелені.
- [ ] Коміт: `feat(products): drop the product category`.

## Links

- [data-model.md](../data-model.md), `products` · [PRD §8](../PRD.md#8-open-questions), копії значень немає
- [openapi.yaml](../contracts/openapi.yaml) `Product`, `ProductUpdateRequest`, `listProducts`
