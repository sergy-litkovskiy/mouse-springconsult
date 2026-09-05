---
id: T16
title: "Видалення кадру: спершу обʼєкт, потім рядок"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1600
blocked_by: [T08, T11, T13]
blocks: [T17, T23]
updated_at: "2026-09-05"
---

# T16 — Видалення кадру: спершу обʼєкт, потім рядок

## Context

Порядок дій **і є рішенням**
([ADR 0012](../adr/0012-delete-permanently-in-the-same-request.md)): спершу обʼєкт у
сховищі, потім рядок у базі. У зворотному порядку збій лишає невидимий обʼєкт-сироту, за
який проєкт платить роками; у цьому — рядок, який показує зображення, якого немає: його
видно оком і можна видалити ще раз.

Ціна вибору названа явно й прийнята: поки сховище недоступне, кадр видалити не можна взагалі.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 4**:

> `api->>pg: читає ключ обʼєкта`
> `api->>r2: видаляє обʼєкт`
> `r2-->>api: видалено (повторне видалення так само успішне)`
> `api->>pg: видаляє рядок кадру`

## Data delta

| Таблиця | Зміна | Джерело |
|---|---|---|
| `product_images` | **−1 рядок**, і тільки після успіху у сховищі | [ADR 0012](../adr/0012-delete-permanently-in-the-same-request.md) |
| `deleted_at` | **не зʼявляється** — умова «не видалено» додавалася б у кожен запит каталогу й у кожен унікальний індекс | [sad.md §4 S4](../sad.md#s4-видалення-остаточне-і-обʼєкт-прибирається-раніше-за-рядок) |
| `product_images_position_key` | після видалення в позиціях зʼявляється дірка — це допустимо, порядок лишається строгим | [data-model.md](../data-model.md) |

## API contract excerpt

```yaml
      description: >-
        Спершу об'єкт у R2, потім рядок (§4 S4, sad.md сценарій 4). Повторне видалення
        того самого ключа так само успішне — операція ідемпотентна на стороні R2.
      operationId: deleteProductImage
      responses:
        "204": { description: Видалено }
        "404": { $ref: "#/components/responses/ImageNotFound" }
        "502": { $ref: "#/components/responses/StorageUnavailable" }
```

## Acceptance criteria

**AC-16 (нове, [T01](align-prd-with-architecture.md)) — happy path**
**Given** у галереї картки є кадр
**When** `user` підтверджує видалення кадру
**Then** система прибирає обʼєкт зі сховища, потім рядок кадру, і галерея повертається без нього

**AC-17 (нове, [T01](align-prd-with-architecture.md)) — відмова зовнішнього сервісу**
**Given** `user` підтверджує видалення кадру
**When** сховище недоступне
**Then** не видаляється нічого — ні обʼєкта, ні рядка — і `user` бачить код `storage_unavailable`

## Checklist

1. `ProductService.deleteImage` — читає ключ, кличе `MediaService.remove`, і **тільки після успіху** видаляє рядок.
2. `ProductController` — `DELETE /:productId/images/:imageId` під `sessionGuard`.
3. `ProductService.spec.ts` — двійник `MediaService`, який кидає: рядок має лишитись на місці.
4. Перевірити, що повторне видалення того самого кадру не падає.

## Out of scope

- Діалог підтвердження — фронт, [T19](add-confirm-dialog.md) і [T21](add-gallery-upload-dialog.md).
- Видалення картки цілком — [T17](add-delete-product-endpoint.md).
- Фонове прибирання обʼєктів задачею — розглянуто й відхилено ([ADR 0010](../adr/0010-delete-cards-and-frames-permanently.md), Superseded by 0012).

## DoD

- [ ] Порядок «обʼєкт → рядок» перевірено тестом на двійнику: коли сховище кидає, рядок цілий.
- [ ] Повторне видалення того самого кадру не падає — обʼєкта вже немає, і це успіх.
- [ ] Відмова сховища доходить кодом `storage_unavailable`, а не 500.
- [ ] Смоук з недосяжним доменом R2: кадр лишається на місці, повтор після відновлення проходить.
- [ ] Коміт: `feat(products): delete a frame, storage object first`.

## Links

- [ADR 0012](../adr/0012-delete-permanently-in-the-same-request.md) · [sad.md §6](../sad.md#6-runtime-view), сценарій 4
- [openapi.yaml](../contracts/openapi.yaml) — `deleteProductImage`
- [CONTEXT.md](../CONTEXT.md) — «кадр», Invariants, Sentinel errors
