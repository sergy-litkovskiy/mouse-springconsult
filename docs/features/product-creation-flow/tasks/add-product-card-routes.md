---
id: T11
title: "Маршрути GET /{id}, POST, PATCH і реєстрація в api.ts"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1500
blocked_by: [T05, T10]
blocks: [T12, T15, T16, T31]
updated_at: "2026-09-05"
---

# T11 — Маршрути `GET /{id}`, `POST`, `PATCH` і реєстрація в `api.ts`

## Context

`ProductController.register` реєструє сьогодні один маршрут — `GET /`. Три нових ідуть під
тим самим `authController.sessionGuard`, що й каталог: нових привілеїв фіча не вводить,
перевірка одна — активна сесія ([sad.md §8](../sad.md#8-crosscutting-concepts)). Це місце
реєстрації №2 з [sad.md §5](../sad.md#5-building-block-view).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 6** — межа, яку тримає саме контролер:

> `api->>api: zod-схема: ціна — невідʼємне число, ≤ 2 знаки (AC-09)`
> `alt формат ціни не проходить`
> `  api-->>web: доменний код формату ціни`
> `  web-->>user: показує, якою має бути ціна, а введене лишається у формі`

## Data delta

**Немає власної.** Контролер не торкається бази — він мапить доменні обʼєкти в DTO. Єдина
колонка, яку він читає й перетворює, — `product_images.r2_key`, і це перетворення додає
[T12](drop-product-image-url.md), не ця задача.

## API contract excerpt

```yaml
  /products/{productId}:
    get:
      operationId: getProduct
    patch:
      operationId: updateProduct
      responses:
        "422":
              example:
                error:
                  code: invalid_price
                  message: "Ціна має бути невідʼємним числом із не більш ніж двома знаками після коми"
```

## Acceptance criteria

**AC-09** (US-04, US-06) — error
**Given** `user` вписує ціну картки сам
**When** введене значення має три знаки після коми
**Then** система відповідає кодом `invalid_price`, картка не змінюється

**AC-12** (US-06) — happy path
**Given** `user` не запускав жодної підготовки
**When** `user` вписує обидва описи, ключові слова й ціну сам і зберігає картку
**Then** система приймає картку так само, як і підготовлену з допомогою AI — ручний шлях не є винятковим

## Checklist

1. `GET /:productId` — картка з галереєю й похідною готовністю.
2. `POST /` — створення за `productCreateSchema`.
3. `PATCH /:productId` — оновлення за `productUpdateSchema`; у відповіді `discardedKeywordsCount`.
4. Усі три під `sessionGuard`; мапінг доменних обʼєктів у DTO з `@contracts`.
5. `src/api.ts` — оновити composition root, якщо конструктор `ProductService` змінився.

## Out of scope

- Маршрути галереї — [T14](add-image-upload-endpoint.md), [T15](add-set-main-image-endpoint.md), [T16](add-delete-image-endpoint.md).
- `DELETE /:productId` — [T17](add-delete-product-endpoint.md): він потребує `MediaService`, якого тут ще немає в конструкторі.
- Прибирання `url` з DTO кадру — [T12](drop-product-image-url.md).

## DoD

- [ ] Усі три маршрути під `sessionGuard`; запит без куки дає `not_authenticated` — перевірено на кожному.
- [ ] AC-09: ціна з трьома знаками відхиляється кодом `invalid_price`, і картка справді не змінилась — звірено запитом до бази.
- [ ] Відповіді збігаються з [openapi.yaml](../contracts/openapi.yaml) поле в поле, включно з `isReady`.
- [ ] У контролері немає бізнес-логіки й немає QueryBuilder; репозиторій він не бачить взагалі.
- [ ] Смоук проти живого стека: створити картку, оновити, прочитати.
- [ ] Коміт: `feat(products): add card read and write routes`.

## Links

- [openapi.yaml](../contracts/openapi.yaml) — `getProduct`, `createProduct`, `updateProduct`
- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-04, AC-09, AC-12, AC-13
- [CONTEXT.md](../CONTEXT.md) — Org-filter invariant (сесія як єдина межа доступу)
