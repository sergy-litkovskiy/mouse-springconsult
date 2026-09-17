---
id: T34
title: "Фільтр списку за готовністю і `isReady` у рядках списку"
status: Done
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2900
blocked_by: []
blocks: [T22, T35]
updated_at: "2026-09-17"
---

# T34 — Фільтр списку за готовністю і `isReady` у рядках списку

## Context

Запит 2026-09-16: каталог має фільтрувати картки за ознакою «Картка готова» — «Так», «Ні»,
«Всі». Ця задача дає бекенд: параметр `ready` у `GET /products` і похідну готовність у
кожному рядку відповіді. Фронт — [T35](add-catalog-readiness-filter.md).

**Розглянуто й відхилено: колонка `products.is_ready`.** Запит пропонував зберігати
готовність булевим полем і фільтрувати за ним. Рішення вже ухвалене
[ADR 0009](../adr/0009-derive-card-readiness-instead-of-storing-it.md) (Accepted), і воно
прямо передбачає саме цей фільтр: «фільтр каталогу за готовністю стає складеним виразом у
SQL замість порівняння з колонкою». Колонка тут нічого не спрощує, а додає три проблеми:

| Аргумент | Чому колонка гірша |
|---|---|
| Третій вхід предиката — кадри в **іншій** таблиці | `GENERATED ALWAYS AS` у Postgres не бачить інших таблиць. Лишаються тригери на `products` і `product_images` або перерахунок у сервісі на кожному шляху запису: T11, T14, T16, T30 |
| Дисципліна інвалідації | Саме той клас помилок, який відкинув ADR 0009: «картка позначена готовою, а ціну потім стерли» |
| Обсяг | 50–100 карток на місяць, сторінка по 20. `EXISTS` іде наявним `product_images_product_id_idx` і нічого не коштує |

Якщо колонка все ж знадобиться (наприклад, сортування за готовністю на тисячах рядків),
потрібен новий ADR, що замінить 0009. Скрипт заповнення тривіальний — про це сказано в
розділі Neutral того самого ADR.

**Знахідка звірки.** [openapi.yaml](../contracts/openapi.yaml) вимагає `isReady` у кожному
`Product`, і [sad.md §6](../sad.md#6-runtime-view) спирається на це («`isReady` уже їде в
кожному рядку `ProductList.items`»). Проте `ProductController.toListResponse` віддає
`productSchema` без цього поля. Жодна story цього не закриває, а [T22](integrate-catalog-with-form-and-delete.md)
малює бейдж саме з нього. Поле додається тут: той самий предикат, та сама відповідь, і
тест фільтра без нього не перевірити.

**Два джерела одного правила — свідомо.** Предикат живе у `ProductService.isReady` (для
однієї картки в памʼяті) і у виразі SQL у репозиторії (для фільтра). ADR 0009 вимагає
тримати вираз «поруч із самим предикатом, щоб вони не розійшлися». Розходження ловить
тест узгодженості (AC-30), а не коментар.

## Sequence

Власного сценарію фільтр не має — готовність є предикатом, а не подією.
[sad.md §6](../sad.md#6-runtime-view), абзац «**Готовність картки без власного сценарію**»:

> «"Готова" — не збережений стан і не дія, а правило, яке рахується при читанні: обидва
> описи непорожні, `price > 0`, у галереї є щонайменше один кадр.»

Запит іде тим самим шляхом, що й решта фільтрів `listProducts`: контролер → сервіс →
репозиторій, одним `SELECT` з `EXISTS`.

## Data delta

**Схема не змінюється.** Міграції немає.

| Вхід предиката | Колонка | Вираз у фільтрі |
|---|---|---|
| опис Prom | `products.description_prom` — `TEXT NOT NULL DEFAULT ''` | `<> ''` |
| опис OLX | `products.description_olx` — `TEXT NOT NULL DEFAULT ''` | `<> ''` |
| ціна | `products.price` — `NUMERIC(12,2) NOT NULL DEFAULT 0` | `> 0` (нуль = «не задано», [data-model.md](../data-model.md)) |
| галерея | `product_images.product_id` | `EXISTS (…)` |

Усі чотири входи `NOT NULL`, тож `ready=false` — це просте `NOT (…)` без тризначної логіки.
Пробіли не обрізаються ні тут, ні в `isReady`: обидва джерела мають відповідати однаково.

## API contract excerpt

Параметра готовності в `openapi.yaml` ще немає. Його форма повторює наявний сусідній
параметр — такий самий булевий необовʼязковий фільтр:

```yaml
      operationId: listProducts
      parameters:
        - { $ref: "#/components/parameters/PublishedProm" }
    PublishedProm:
      name: publishedProm
      in: query
      schema: { type: boolean }
        isReady:
          type: boolean
          description: >-
            Похідне поле, не колонка: обидва заголовки й обидва описи непорожні, price > 0,
```

## Acceptance criteria

Нові AC із запиту 2026-09-16. У [PRD §5](../PRD.md#5-acceptance-criteria) їх ще немає —
до PRD їх вносить крок 7 чекліста.

**AC-29 (нове) — happy path**
**Given** у каталозі є готові й неготові картки
**When** `user` запитує список з `ready=true` (або `ready=false`)
**Then** система повертає лише готові (або лише неготові) картки, а `total` рахує рядки за цим самим фільтром

**AC-30 (нове) — domain invariant**
**Given** картки, кожній з яких бракує рівно одного входу предиката (опису Prom, опису OLX, ціни або кадру), і одна повна
**When** список читається з `ready=true` і з `ready=false`
**Then** належність кожної картки до результату збігається з `ProductService.isReady` для неї ж, а `isReady` у рядку відповіді має те саме значення

**AC-13 / AC-15** ([PRD §5](../PRD.md#5-acceptance-criteria)) лишаються чинними: `ready`
комбінується з `publishedProm`/`publishedOlx` через AND і не впливає на жоден із них; дії
«позначити готовою» не зʼявляється.

## Checklist

1. `contracts/products.contract.ts`: `ready: booleanFlag.optional()` у `productListQuerySchema`; `productSchema` для рядка списку отримує `isReady` (той самий коментар «похідне, не колонка»).
2. `ProductRepository.ts`: `ready?: boolean` у `ProductFilters`; в `applyFilters` — складений вираз з `EXISTS (select 1 from product_images …)` та його заперечення. Вираз — іменована константа поруч із коментарем-посиланням на `ProductService.isReady` і ADR 0009.
3. `ProductService.list` передає `ready` у фільтри так само, як `publishedProm`.
4. `ProductController.toListResponse` додає `isReady: this.products.isReady(product)` у кожен рядок; галерея вже підвантажена репозиторієм.
5. `ProductRepository.spec.ts`: випадки для AC-29 (разом із `total`) і таблиця AC-30 — п'ять карток, два значення фільтра.
6. `openapi.yaml`: параметр `ReadyFilter` (`name: ready`, `in: query`, `schema: { type: boolean }`) і посилання на нього в `listProducts`.
7. `PRD.md §5`: AC-29 і AC-30 у формі Given/When/Then з лінком на цю story.

## Out of scope

- Колонка `is_ready`, тригери, перерахунок при записі — відхилено вище (ADR 0009).
- Сортування за готовністю — не запитано; при потребі це окрема story.
- Фільтр і його підписи на фронті — [T35](add-catalog-readiness-filter.md).

## DoD

- [x] AC-29: `ready=true` і `ready=false` повертають відповідно готові й неготові картки; `total` рахує саме їх.
- [x] AC-30: на кожній з п'яти карток фільтр SQL і `isReady` відповідають однаково — перевірено тестом на реальній базі.
- [x] Кожен рядок `GET /products` несе `isReady` — відповідь збігається з `openapi.yaml` поле в поле.
  Уточнення 2026-09-17: RED-коміт доповнено фікстурою `isReady` у `apps/web/.../product-catalog.spec.ts`.
  Обов'язкове поле в рядку `ProductList` інакше ламало збірку web-тестів, а GREEN не має права правити spec.
  Смоук: 4 картки = 1 готова (`ready=true`) + 3 неготові (`ready=false`); з `publishedProm=true` — AND.
- [x] `ready=yes` відхиляється як `validation_failed`, так само як `publishedProm=yes`.
- [x] Міграцій у PR немає; QueryBuilder лише в `ProductRepository.ts` — `deps:check` зелений.
- [x] Коміт: `feat(products): filter the list by derived readiness`.

## Links

- [ADR 0009](../adr/0009-derive-card-readiness-instead-of-storing-it.md) — Negative, третій пункт; Neutral, перший пункт
- [sad.md §4](../sad.md#4-solution-strategy) — S5 · [sad.md §6](../sad.md#6-runtime-view) — «Маркування в таблиці каталогу»
- [data-model.md](../data-model.md) — `products`, `product_images` · [openapi.yaml](../contracts/openapi.yaml) — `listProducts`, `Product.isReady`
- [CONTEXT.md](../CONTEXT.md) — «Готовність ніде не зберігається»
