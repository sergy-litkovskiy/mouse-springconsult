---
id: T62
title: "Фільтр категорій: кілька значень з автодоповненням"
status: Blocked
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2000
blocked_by: [T59, T60, T61]
blocks: []
updated_at: "2026-09-21"
---

# T62 — Фільтр категорій: кілька значень з автодоповненням

## Context

Запит 2026-09-21, пункт 6, фронтова половина. Поле «Категорія» в панелі фільтрів каталогу —
вільний текст із точним збігом (`product-catalog.html`, `formControlName="category"`). Людина
не пам'ятає точного написання категорій і не може вибрати дві одразу. Власник просить:
вибір кількох категорій, автодоповнення з наявних, пошук підрядком.

**Як це влаштовано.**

- Список категорій — `GET /products/categories` з [T61](add-category-list-and-multi-filter.md),
  новий метод у `products-api.ts`. Завантажується один раз при відкритті каталогу; помилка
  завантаження не ламає сторінку — поле лишається, підказок немає.
- Поле — `mat-chip-grid` з `input`, до якого прив'язано `mat-autocomplete`. Патерн chips і
  його тести вводить [T59](edit-keywords-as-chips.md); тут він повторюється, а не вигадується
  вдруге.
- Підказки фільтруються підрядком без урахування регістру (`toLocaleLowerCase('uk')`), уже
  вибрані категорії з підказок зникають. Вибрати можна лише наявну категорію: вільний текст
  без вибору chip не створює.
- Стан — у URL: `product-catalog-query.ts` читає й пише `category` як масив (кілька
  однойменних параметрів). Збережена адреса з однією `category=` відкривається з одним chip.
- Фільтр застосовується так само, як інші поля панелі («Застосувати»).

Спільні рядки CSS панелі з [T60](narrow-catalog-flag-filters.md) — поле категорії займає місце,
яке звільнили прапорці, тож задача йде після неї.

## Sequence

Власного сценарію немає: вибір категорій — стан панелі фільтрів, а запит лишається
`listProducts`. Так само [sad.md §6](../sad.md#6-runtime-view) описує стан форми:

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Немає.** Контракт змінює [T61](add-category-list-and-multi-filter.md); ця задача його
використовує.

## API contract excerpt

Чинний фрагмент; після T61 `CategoryFilter` стане масивом, а поруч з'явиться
`listProductCategories`:

```yaml
      operationId: listProducts
        - { $ref: "#/components/parameters/CategoryFilter" }
    CategoryFilter:
      name: category
```

## Acceptance criteria

Нове AC із запиту 2026-09-21; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 6 чекліста.

**AC-56 (нове) — happy path**
**Given** у базі категорії «Клавіатури», «Миші», «Навушники»
**When** `user` вводить у фільтр «ш», обирає «Миші» й «Навушники» з підказок і тисне «Застосувати»
**Then** підказки після «ш» — «Миші» й «Навушники» (без урахування регістру), у полі два chips, URL містить `category=Миші&category=Навушники`, а таблиця показує картки обох категорій

**AC-56 — edge case**
**Given** у фільтрі вже обрано «Миші»
**When** `user` знову вводить «ми» або вводить текст, якого немає серед категорій, і тисне Enter
**Then** «Миші» серед підказок немає, повторний chip не з'являється, а вільний текст chip не створює

**AC-56 — edge case (збережена адреса)**
**Given** `user` відкриває збережену адресу `/products?category=Миші` або перелік категорій не завантажився
**When** каталог відмальовано
**Then** у полі один chip «Миші» і таблиця відфільтрована; без переліку поле працює з уже обраними chips, а сторінка не показує помилки

**AC-56 — edge case (скидання фільтра)**
**Given** у фільтрі обрано «Миші» й «Навушники», URL містить обидві категорії
**When** `user` прибирає всі chips (або тисне «Скинути») і застосовує фільтри
**Then** параметра `category` немає ні в URL, ні в запиті до `api` (не `category=` з порожнім значенням: `api` відповідає на нього `400`), а таблиця показує картки всіх категорій

## Checklist

1. `products-api.spec.ts` / `products-api.ts`: метод переліку категорій; параметр `category` списку — масив, кожен елемент окремим query-параметром.
2. `product-catalog-query.ts` і його тест: `category` читається й пишеться масивом; одне значення в URL → масив з одного.
3. `product-catalog.spec.ts`: тести через `MatChipGridHarness` і `MatAutocompleteHarness` — фільтрація підрядком без регістру, без дублів, лише наявні, «Застосувати» передає масив, адреса з однією категорією.
4. `product-catalog.ts` / `.html`: контрол `category: string[]`, `mat-chip-grid` + `mat-autocomplete`, завантаження переліку.
5. `product-catalog.css`: поле категорії росте з chips; на 360 px без горизонтального скролу.
6. `PRD.md §5`: AC-56 з посиланням на цю story.
7. `pw`: вибір двох категорій, URL, перезавантаження сторінки зберігає вибір.

## Out of scope

- Серверна частина — [T61](add-category-list-and-multi-filter.md).
- Автодоповнення категорії у формі картки — не просили.

## DoD

- [ ] AC-56: кілька категорій з автодоповненням, стан у URL.
- [ ] Тести `web` зелені, `lint` зелений, `pw` пройдено.
- [ ] Коміт: `feat(web): pick several catalog categories with autocomplete`.

## Links

- [T61](add-category-list-and-multi-filter.md) — `api` · [T59](edit-keywords-as-chips.md) — патерн chips · [T60](narrow-catalog-flag-filters.md) — ті самі рядки CSS панелі
- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 10–15 · [openapi.yaml](../contracts/openapi.yaml) — `listProducts`
