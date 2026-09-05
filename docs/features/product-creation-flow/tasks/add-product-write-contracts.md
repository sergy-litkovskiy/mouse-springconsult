---
id: T05
title: "Схеми створення й оновлення картки, похідна готовність"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1700
blocked_by: [T04]
blocks: [T11, T18]
updated_at: "2026-09-05"
---

# T05 — Схеми створення й оновлення картки, похідна готовність

## Context

`products.contract.ts` описує сьогодні лише читання. Запису немає — `ProductController`
уміє самий `list`. Контракт запису вже спроектований у
[openapi.yaml](../contracts/openapi.yaml), і ця задача переносить його у zod, звідки фронт
бере типи через `@contracts/*`.

Похідне поле готовності — не колонка: воно рахується при читанні
([ADR 0009](../adr/0009-derive-card-readiness-instead-of-storing-it.md)), але у відповіді
воно є, тож місце йому в схемі відповіді.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 6** — обидві межі, які ця схема має
розрізнити, видимі в одній діаграмі:

> `api->>api: zod-схема: ціна — невідʼємне число, ≤ 2 знаки (AC-09)`
> `api->>api: лишає перші 30 ключових слів, решту відкидає (AC-07)`

Перша **відхиляє** й належить схемі; друга **обрізає** й належить сервісу.

## Data delta

Колонки не змінюються — схема лише описує вже наявні
([data-model.md](../data-model.md), `products`):

| Поле схеми | Колонка | Обмеження, звідки береться |
|---|---|---|
| `titleProm`, `titleOlx` | `VARCHAR(200) NOT NULL` | `productConstraints.titleMaxLength` |
| `price` | `NUMERIC(12,2) NOT NULL DEFAULT 0, CHECK >= 0` | `productConstraints.pricePattern` |
| `seoKeywords` | `TEXT[] NOT NULL DEFAULT '{}'` | межа 30 — у коді, не в SQL |
| `condition` | `VARCHAR(8) CHECK IN (new, used)` | `productConditions` |
| `publishedProm`, `publishedOlx` | два `BOOLEAN NOT NULL DEFAULT false` | незалежні (AC-13) |
| `isReady` | **колонки немає** — предикат | [ADR 0009](../adr/0009-derive-card-readiness-instead-of-storing-it.md) |
| `discardedKeywordsCount` | **колонки немає** — рахує сервіс | AC-07 |

## API contract excerpt

```yaml
    patch:
      operationId: updateProduct
      requestBody:
        content:
          application/json:
            schema: { $ref: "#/components/schemas/ProductUpdateRequest" }
      responses:
        "200":
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ProductUpdateResponse" }
        "422":
          description: Ціна не є невідʼємним числом із щонайбільше двома знаками (AC-09)
```

## Acceptance criteria

**AC-09** (US-04, US-06) — error
**Given** `user` вписує ціну картки сам
**When** введене значення не є невідʼємним числом із щонайбільше двома знаками після коми
**Then** система не зберігає значення й показує `user`-у, якою має бути ціна

**AC-13** (US-07) — domain invariant
**Given** картка має відмітку published-prom
**When** `user` відмічає, що товар зʼявився на OLX
**Then** система веде published-prom і published-olx окремо, і зняття однієї відмітки не змінює другу

## Checklist

1. `productCreateSchema` — обовʼязкові поля картки за [data-model.md](../data-model.md); описи, слова й ціна мають дефолти.
2. `productUpdateSchema` — часткове оновлення тих самих полів плюс дві **незалежні** відмітки присутності.
3. Ціна — `pricePattern` з `products-limits.ts`; десятковий рядок, без перетворення.
4. `seoKeywords` — схема **не** забороняє більшого за 30: обрізання належить сервісу.
5. `isReady: boolean` і `discardedKeywordsCount: number` у відповідях, обидва з коментарем «похідне, не колонка».
6. `products.contract.spec.ts` — ціна з трьома знаками, відʼємна ціна, порожній заголовок, 31 слово.

## Out of scope

- Прибирання `url` зі схеми кадру — нероздільне з міграцією й контролером, тому в [T12](drop-product-image-url.md).
- Схеми поставки 2 (`ai.contract.ts`) — не наперед.

## DoD

- [ ] Кожне поле схеми має походження з [data-model.md](../data-model.md) або з AC — жодного вигаданого.
- [ ] Форма на дроті camelCase, як уже повертає `productSchema`; snake_case лишається в SQL.
- [ ] Схема **не** відхиляє 31 слово: перевірено тестом, бо інакше AC-07 стане неможливим.
- [ ] `npm run test` в `api` зелений — включно з чотирма новими випадками меж.
- [ ] Коміт: `feat(products): add write contracts for the card`.

## Links

- [openapi.yaml](../contracts/openapi.yaml) — `createProduct`, `updateProduct`
- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-07, AC-09, AC-13
- [CONTEXT.md](../CONTEXT.md) — «готова картка», «картка товару»
