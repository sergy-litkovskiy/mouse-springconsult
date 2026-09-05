---
id: T18
title: "Методи запису в products-api.ts"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1400
blocked_by: [T05]
blocks: [T20, T21, T22, T23]
updated_at: "2026-09-05"
---

# T18 — Методи запису в `products-api.ts`

## Context

`products-api.ts` уміє сьогодні самий `list`. Файл лежить на рівні фічі, а не підфічі, бо
належить `products` цілком, а не окремому екрану
([apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md), правило 15) — і там лишається.

Типи беруться з `@contracts` через `import type`; дублювати інтерфейси DTO у web заборонено
(правило 13). Рантаймові константи — з `products-limits.ts`, бо рантаймовий імпорт зі
zod-файлу затягнув би всю бібліотеку валідації в бандл.

Задача відкриває всю фронтову гілку і може йти паралельно з бекендом: контракт уже є.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 1** — рядок `web`, який ця задача й реалізує:

> `web->>api: надсилає кадр картки`
> `api-->>web: кадр із адресою, складеною з ключа`

## Data delta

**Немає.** Фронт не має доступу до бази взагалі — він бачить лише DTO. Єдине, що з бази до
нього доходить незміненим, — ціна: `NUMERIC(12,2)` іде десятковим рядком без жодного
перетворення на всьому шляху ([CLAUDE.md](../../../../CLAUDE.md), «Гроші»).

## API contract excerpt

Сім операцій поставки 1, які цей файл має покрити:

```yaml
      operationId: listProducts
      operationId: getProduct
      operationId: createProduct
      operationId: updateProduct
      operationId: deleteProduct
      operationId: uploadProductImage
      operationId: setMainProductImage
      operationId: deleteProductImage
```

## Acceptance criteria

**AC-12** (US-06) — happy path
**Given** `user` вписує обидва описи, ключові слова й ціну сам
**When** клієнт зберігає картку
**Then** він шле той самий `PATCH`, що й прийняття пропозиції — окремого «ручного» маршруту немає

**AC ([apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md), правило 13)**
**Given** фронту потрібен тип відповіді
**When** він його оголошує
**Then** тип приходить з `@contracts` через `import type` — локального інтерфейсу DTO у `web` не існує

## Checklist

1. `getById`, `create`, `update`, `delete`.
2. `uploadImage` через `FormData` (multipart), `setMainImage`, `deleteImage`.
3. `apiBaseUrl` з `@environments/environment` — `/api` в обох оточеннях.
4. Перевірити, що жоден рантаймовий імпорт не йде з `*.contract.ts`.

## Out of scope

- Екрани — [T20](add-product-form-subfeature.md), [T21](add-gallery-upload-dialog.md), [T22](integrate-catalog-with-form-and-delete.md).
- Методи підготовки — поставка 2, [T32](add-preparation-ui.md).
- Генерація TS-типів з `openapi.yaml`: репозиторій цього не робить — фронт бере типи з `@contracts/*` напряму.

## DoD

- [ ] Жодного локального інтерфейсу DTO: усе через `import type` з `@contracts`.
- [ ] Жодного рантаймового імпорту з `*.contract.ts` — перевірено `grep`, бо ціна помилки ~55 КБ gzip.
- [ ] Усі вісім операцій контракту покриті; жодного методу, якого в контракті немає.
- [ ] `npm run lint` в `web` зелений — межі між фічами не порушені.
- [ ] Коміт: `feat(web): add product write methods to the api client`.

## Links

- [openapi.yaml](../contracts/openapi.yaml) — усі операції поставки 1
- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 13, 14, 15
- [CONTEXT.md](../CONTEXT.md) — Out of scope (чому немає окремого «ручного» маршруту)
