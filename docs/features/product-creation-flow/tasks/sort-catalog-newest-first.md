---
id: T101
title: "Каталог за замовчуванням — найсвіжіші картки зверху"
status: Todo
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2100
blocked_by: []
blocks: [T102]
updated_at: "2026-10-07"
---

# T101 — Каталог за замовчуванням — найсвіжіші картки зверху

## Context

Запит 2026-10-07. Таблиця каталогу без `sort` в адресі сортується за `titleProm asc`
(`productSortDefaults` у `apps/api/src/contracts/products-limits.ts`). Щойно створена картка
губиться серед інших за алфавітом, а має стояти першим рядком.

**Що змінюється.**

- `api`: `productSortFields` отримує `'createdAt'`, а `productSortDefaults` стає
  `{ field: 'createdAt', direction: 'desc' }`. У `SORT_COLUMNS` (`ProductRepository.ts`)
  додається `createdAt: 'product.createdAt'`. Додаткове сортування `product.id ASC` лишається:
  дві картки з однаковим `created_at` інакше могли б з'явитись на двох сторінках.
- `web`: `resetFilters()` додатково пише `sort: null, direction: null`, тож «Скинути»
  повертає й порядок за замовчуванням (рішення власника 2026-10-07). Заголовка колонки для
  `createdAt` немає, тож `matSort` без активної стрілки — це очікуваний стан, а не дефект.
  Входи `sort` і `direction` компонента беруть дефолти з `productSortDefaults`, тож окремої
  правки вони не потребують.
- Колонку «Створено» не додаємо (рішення власника 2026-10-07).

**Тести, які зміна зламає.** `products.contract.spec.ts` перевіряє, що `sort: 'createdAt'`
відхиляється, і що дефолт — `titleProm`; `product-catalog.spec.ts` чекає `sort=titleProm` у
запиті без параметрів і з невалідним `sort`. RED переписує їх на нову поведінку, а не видаляє:
відхилятися має `created_at`, дефолт — `createdAt`.

## Sequence

Власного сценарію немає: це той самий `listProducts` з іншим порядком рядків. Так само
[sad.md §6](../sad.md#6-runtime-view) описує стан, що не породжує нового запиту:

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Міграції немає.** `products.created_at timestamptz not null default now()` уже існує
(`@CreateDateColumn` у `Product.ts`). Індексу під сортування не додаємо: за 50–100 карток на
місяць послідовний прохід таблиці дешевший за підтримку індексу.

## API contract excerpt

```yaml
    Sort:
      name: sort
      in: query
      schema: { type: string, enum: [titleProm, titleOlx, price, createdAt], default: createdAt }
    Direction:
      name: direction
      in: query
      schema: { type: string, enum: [asc, desc], default: desc }
```

Крок 6 чекліста переписує обидва рядки `schema`: `Sort` отримує `createdAt` в `enum` і
`default: createdAt`, `Direction` — `default: desc`. Excerpt вище оновлюється тим самим кроком.

## Acceptance criteria

AC-92 нове; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить крок 7 чекліста.

**AC-92 (US-07) — happy path**
**Given** `user` на першій сторінці каталогу без фільтрів і без `sort` в адресі
**When** він створює нову картку й зберігає її
**Then** нова картка стоїть першим рядком таблиці, а запит до `api` іде з `sort=createdAt&direction=desc`

**AC-92 — edge case**
**Given** `user` клікнув заголовок «Ціна», і адреса містить `sort=price`
**When** він тисне «Скинути»
**Then** таблиця знову йде від найсвіжішої картки, в адресі немає ні `sort`, ні `direction`; збережена адреса `/products?sort=titleProm` відкривається з порядком за назвою Prom

**AC-92 — error**
**Given** запит до `api` в обхід форми
**When** `GET /products?sort=created_at`
**Then** відповідь `400` з полем `sort` у `details`

## Checklist

1. `products.contract.spec.ts`: дефолти порожнього запиту — `createdAt` і `desc`; `createdAt` приймається, `created_at` — ні.
2. `ProductRepository.spec.ts`: тест на живій базі — три картки з різним `created_at`, сортування `createdAt desc` дає їх від найновішої.
3. `products-limits.ts`: `createdAt` у `productSortFields`, нові `productSortDefaults`; `ProductRepository.ts`: рядок у `SORT_COLUMNS`.
4. `product-catalog.spec.ts`: запит без параметрів іде з `sort=createdAt&direction=desc`; після кліку «Ціна» «Скинути» прибирає `sort` і `direction` з адреси.
5. `product-catalog.ts`: `resetFilters` пише `sort: null, direction: null`.
6. `contracts/openapi.yaml`: `Sort` і `Direction` з новими `enum` і `default`; excerpt цієї story — під нові рядки, і після цього gate-check теки `tasks/`.
7. `PRD.md §5`: AC-92 з посиланням на цю story.
8. `pw`: створити картку — вона перша; клік «Ціна», тоді «Скинути» — порядок знову від найсвіжішої, в адресі немає `sort`.

## Out of scope

- Колонка «Створено» в таблиці.
- Перехід на першу сторінку після створення картки, коли адмін на сторінці N або фільтри
  ховають нову картку.

## DoD

- [ ] AC-92: дефолтний порядок і «Скинути» покрито тестами, порядок на живій базі доведено.
- [ ] `api` і `web`: тести, `typecheck`, `lint` зелені.
- [ ] `openapi.yaml` і `PRD.md §5` оновлено.
- [ ] Коміт: `feat(products): sort the catalogue newest first by default`.

## Links

- [T102](apply-catalog-filters-live.md) — править ті самі `product-catalog.*`, іде після
- [apps/api/CLAUDE.md](../../../../apps/api/CLAUDE.md) · [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) · [openapi.yaml](../contracts/openapi.yaml) — `listProducts`
