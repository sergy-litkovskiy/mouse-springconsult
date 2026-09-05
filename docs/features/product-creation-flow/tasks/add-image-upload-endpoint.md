---
id: T14
title: "Приймання кадру: multipart, межа десяти, запис у R2"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1800
blocked_by: [T08, T12, T13]
blocks: [T23]
updated_at: "2026-09-05"
---

# T14 — Приймання кадру: multipart, межа десяти, запис у R2

## Context

Головний маршрут поставки 1. Кадр приймається **одним синхронним запитом**: перевірка,
запис обʼєкта, рядок у базі, відповідь. Фонової роботи немає — черга й другий процес
переїхали в поставку 2 разом із похідними розмірами
([ADR 0011](../adr/0011-store-only-the-original-frame.md)), тож кадр має рівно два стани:
записаний або запит не вдався.

`@fastify/multipart` у `package.json` ще немає — це нова залежність.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 1** — і він же порядок відмови
(**сценарій 2**):

> `api->>api: перевіряє, що це зображення і що воно в межах розміру`
> `api->>pg: рахує кадри картки — одинадцятий відхиляється (AC-02)`
> `api->>r2: кладе оригінал під ключем products/<картка>/<кадр>`
> `r2-->>api: обʼєкт записано`
> `api->>pg: пише рядок кадру з ключем і позицією`

Якщо сховище не відповіло — рядок **не створюється**, неузгодженого стану не виникає.

## Data delta

| Таблиця | Зміна | Джерело |
|---|---|---|
| `product_images` | **+1 рядок на кадр**: `r2_key`, `product_id`, `position`, `is_main` | [data-model.md](../data-model.md) |
| `product_images.id` | `UUID default uuidv7()` — генерує база; ключ R2 складається до вставки | те саме |
| схема | **не змінюється** — колонки вже накочені; `url` знесено в [T12](drop-product-image-url.md) | те саме |

Порядок обовʼязковий: обʼєкт → рядок. Зворотний лишав би рядок без файлу при збої сховища.

## API contract excerpt

```yaml
      operationId: uploadProductImage
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [file]
              properties:
                file:
      responses:
        "201":
          description: Кадр додано
        "409":
          description: Галерея вже має десять кадрів (AC-02)
        "413":
          description: Файл більший за 10 МБ (PRD §6)
        "502": { $ref: "#/components/responses/StorageUnavailable" }
```

## Acceptance criteria

**AC-01** (US-01) — happy path
**Given** `user` створює нову картку товару
**When** `user` завантажує кадр
**Then** система додає кадр у галерею картки, показує його превʼю і не змушує чекати на завершення обробки

**AC-02** (US-01) — domain invariant
**Given** у галереї картки вже десять кадрів
**When** `user` намагається додати ще один
**Then** система відхиляє додавання і повідомляє, що галерея вміщає щонайбільше десять кадрів

## Checklist

1. `apps/api/package.json` — `@fastify/multipart`; реєстрація плагіна в `src/api.ts` з межею з `products-limits.ts`.
2. `ProductService.addImage` — рахує кадри картки й відхиляє одинадцятий (`gallery_full`).
3. `MediaService` приходить конструктором: `new ImageStorage(...)` → `new MediaService(...)` → `ProductService` — місце реєстрації №1.
4. `ProductController` — `POST /:productId/images` під `sessionGuard`.
5. `ProductService.spec.ts` — межа десяти кадрів і відмова сховища на двійнику.

## Out of scope

- Локальне превʼю в браузері — [T21](add-gallery-upload-dialog.md). QG-2 забезпечує саме воно, а не швидкість сервера.
- Полінг стану — предмета не має: фонової роботи немає.

## DoD

- [ ] AC-01: кадр зʼявляється в галереї, відповідь містить складену адресу.
- [ ] AC-02: одинадцятий кадр відхиляється кодом `gallery_full`, десять наявних цілі — звірено запитом до бази.
- [ ] Відмова сховища не лишає рядка в `product_images` — перевірено з недосяжним доменом R2 (QG-1).
- [ ] `MediaService` створюється лише в `src/api.ts`; `deps:check` зелений.
- [ ] Файл на 10 МБ проходить, на 11 МБ — відхиляється `file_too_large`, а не обривом зʼєднання: перевірено через `caddy`, не лише напряму в `api`.
- [ ] Коміт: `feat(products): accept a gallery frame in a single request`.

## Links

- [sad.md §6](../sad.md#6-runtime-view), сценарії 1 і 2 · [sad.md §5](../sad.md#5-building-block-view), місце реєстрації 1
- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-01, AC-02 · [PRD §6](../PRD.md#6-non-functional-requirements)
- [ADR 0004](../adr/0004-validate-uploads-in-api-before-r2.md) · [ADR 0011](../adr/0011-store-only-the-original-frame.md)
- [CONTEXT.md](../CONTEXT.md) — «кадр», «галерея», Sentinel errors
