---
id: T61
title: "api: перелік категорій і фільтр за кількома категоріями"
status: Todo
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2200
blocked_by: []
blocks: [T62]
updated_at: "2026-09-21"
---

# T61 — api: перелік категорій і фільтр за кількома категоріями

## Context

Запит 2026-09-21, пункт 6, серверна половина. Фільтр «Категорія» в каталозі зараз — вільний
текст і точний збіг: `product.category = :category` (`ProductRepository.ts`), а
`productListQuerySchema.category` — один рядок 1–120 символів (`products.contract.ts`). Власник
хоче вибирати кілька категорій зі списку наявних з автодоповненням
([T62](pick-catalog-categories-with-autocomplete.md)). Для цього `api` має:

1. **Віддати перелік категорій.** `GET /products/categories` — `DISTINCT` непорожніх
   `products.category`, відсортованих за алфавітом (`COLLATE` бази), масив рядків. Без
   пагінації: категорій десятки, не тисячі. Маршрут під `sessionGuard`, як і решта `/products`.
   Статичний сегмент `categories` не має потрапити в `/:productId` — find-my-way у Fastify віддає
   перевагу статичному маршруту, але перевірити це смоуком, а реєструвати маршрут поруч із `/`.
2. **Фільтрувати за кількома.** `category` у запиті списку стає масивом: повторюваний
   query-параметр `?category=A&category=B`. Один параметр Fastify віддає рядком, кілька —
   масивом, тож схема приймає обидва й нормалізує до масиву (1–20 елементів, кожен 1–120
   символів після `trim`). Умова в репозиторії — `product.category IN (:...categories)`, разом
   з іншими фільтрами через AND. Порожній масив чи відсутній параметр — без фільтра.

Зворотна сумісність: збережена адреса з одним `category=A` працює як раніше.

## Sequence

Власного сценарію немає: перелік категорій і фільтр — читання без побічних ефектів, так само
як маркування каталогу в [sad.md §6](../sad.md#6-runtime-view):

> «`isReady` уже їде в кожному рядку `ProductList.items` (`contracts/openapi.yaml`) — новий запит бекенду не потрібен»

На відміну від маркування, тут новий запит **потрібен**: переліку наявних категорій у відповіді
списку немає, а зібрати його з однієї сторінки неможливо.

## Data delta

**Схема бази не змінюється.** Індекс на `products.category` не додаємо: 50–100 карток на місяць,
`DISTINCT` по сотнях рядків дешевий.

**Контракт змінюється:**

| Що | Було | Стає |
|---|---|---|
| `productListQuerySchema.category` | рядок 1–120 | масив 1–20 рядків 1–120, приймає й один рядок |
| `CategoryFilter` в `openapi.yaml` | `type: string` | `type: array`, `style: form`, `explode: true` |
| Новий шлях | — | `GET /products/categories` → `200 string[]`, `401` |

## API contract excerpt

Чинний параметр, який задача перетворює на масив:

```yaml
        - { $ref: "#/components/parameters/CategoryFilter" }
    CategoryFilter:
      name: category
      in: query
      schema: { type: string, maxLength: 120 }
        category: { type: string, maxLength: 120 }
```

## Acceptance criteria

Нове AC із запиту 2026-09-21; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 7 чекліста.

**AC-55 (нове) — happy path**
**Given** у базі картки з категоріями «Миші», «Клавіатури», «Миші» і одна без категорії
**When** `user` запитує `GET /products/categories`
**Then** відповідь `200` — `["Клавіатури", "Миші"]`: без дублів, без порожнього рядка, за алфавітом

**AC-55 — happy path (фільтр)**
**Given** ті самі картки
**When** `user` запитує `GET /products?category=Миші&category=Клавіатури`
**Then** у відповіді всі три картки з цими категоріями, `total` = 3; `?category=Миші` дає дві, як і раніше

**AC-55 — error**
**Given** запит без сесії або `category` довша за 120 символів
**When** `api` приймає `GET /products/categories` чи `GET /products?category=…`
**Then** без сесії — `401 not_authenticated`, задовга категорія — `400` з полем `category` у `details`

## Checklist

1. `products.contract.ts`: `category` у `productListQuerySchema` — рядок або масив, нормалізований до масиву, межі 1–20 × 1–120; схема відповіді переліку категорій. Тест схеми на обидві форми входу.
2. `ProductRepository.ts`: `IN (:...categories)` замість `=`; метод переліку `DISTINCT` непорожніх категорій з сортуванням. Тест на живій базі: кілька категорій, картка без категорії, дублікати.
3. `ProductService.ts`: метод переліку категорій, фільтр передається масивом.
4. `ProductController.ts`: маршрут `GET /categories` під `sessionGuard` поруч із `GET /` — **обв'язка**, `/tdd` її не зробить.
5. Смоук на живому стеку: `GET /products/categories` без cookie → `401`, із сесією → масив; `GET /products/categories` не повертає `400`/`404` від `/:productId`.
6. `contracts/openapi.yaml`: `CategoryFilter` — масив, новий шлях `/products/categories` з `operationId: listProductCategories`.
7. `PRD.md §5`: AC-55 з посиланням на цю story.

## Out of scope

- Довідник категорій як окрема таблиця — категорія лишається вільним рядком картки.
- Фронт — [T62](pick-catalog-categories-with-autocomplete.md).
- Пошук за назвою від трьох символів — [T63](search-titles-live-from-three-chars.md); вона править ту саму схему, тому йде після цієї задачі.

## DoD

- [ ] AC-55: перелік категорій і фільтр за кількома, збережені адреси з однією категорією працюють.
- [ ] `api`: `typecheck` · `lint` · `test` · `deps:check` зелені; смоук `401` пройдено.
- [ ] `openapi.yaml` і `PRD.md §5` оновлено.
- [ ] Коміт: `feat(products): list categories and filter by several of them`.

## Links

- [T62](pick-catalog-categories-with-autocomplete.md) — фронт фільтра · [T34](add-readiness-list-filter.md) — попередній фільтр списку в `api`
- [apps/api/CLAUDE.md](../../../../apps/api/CLAUDE.md) — правила 1–9 · [openapi.yaml](../contracts/openapi.yaml) — `listProducts`
