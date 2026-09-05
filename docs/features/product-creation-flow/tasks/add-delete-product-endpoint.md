---
id: T17
title: "Видалення картки: пакетне прибирання обʼєктів і каскад"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1500
blocked_by: [T08, T09, T16]
blocks: [T23]
updated_at: "2026-09-05"
---

# T17 — Видалення картки: пакетне прибирання обʼєктів і каскад

## Context

Видалення картки йде тим самим шляхом, що й кадру, з двома відмінностями
([sad.md §6](../sad.md#6-runtime-view), сценарій 4): обʼєкти прибираються **одним пакетним
викликом**, а рядки кадрів — каскадом `on delete cascade`.

**Обʼєкти R2 не покриті бекапом** ([sad.md §11](../sad.md#11-risks-and-technical-debt)):
нічний `pg_dump` поверне рядок, але не фото. Єдиний практичний запобіжник — діалог
підтвердження на фронті.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 4**, останній абзац:

> «Видалення картки йде тим самим шляхом, лише обʼєкти прибираються одним пакетним
> викликом, а рядки кадрів — каскадом `on delete cascade`.»

## Data delta

| Таблиця | Зміна | Джерело |
|---|---|---|
| `products` | **−1 рядок**, і тільки після успіху пакетного прибирання у сховищі | [ADR 0012](../adr/0012-delete-permanently-in-the-same-request.md) |
| `product_images` | −N рядків **каскадом**, не окремим запитом | [data-model.md](../data-model.md), FK `ON DELETE CASCADE` |
| `deleted_at` | не зʼявляється ні в одній таблиці | [sad.md §4 S4](../sad.md#s4-видалення-остаточне-і-обʼєкт-прибирається-раніше-за-рядок) |

## API contract excerpt

```yaml
      description: >-
        Спершу об'єкти кадрів прибираються з R2 пакетним викликом, потім рядок картки —
        і лише тоді кадри каскадом ([ADR 0012](../adr/0012-delete-permanently-in-the-same-request.md)).
        Якщо сховище недоступне — не видаляється нічого (§4 S4, sad.md сценарій 4).
      operationId: deleteProduct
      responses:
        "204": { description: Видалено }
        "404": { $ref: "#/components/responses/ProductNotFound" }
        "502": { $ref: "#/components/responses/StorageUnavailable" }
```

## Acceptance criteria

**AC-18 (нове, [T01](align-prd-with-architecture.md)) — domain invariant**
**Given** картка має кадри
**When** `user` видаляє картку
**Then** система прибирає всі обʼєкти кадрів і саму картку остаточно; відновлення не передбачене

**AC-17 (нове, [T01](align-prd-with-architecture.md)) — відмова зовнішнього сервісу**
**Given** `user` видаляє картку з десятьма кадрами
**When** сховище недоступне
**Then** не видаляється нічого — ні обʼєктів, ні рядка картки, ні рядків кадрів

## Checklist

1. `ProductService.deleteProduct` — читає всі ключі картки, кличе `MediaService.removeMany`, і **тільки після успіху** видаляє рядок картки.
2. `ProductController` — `DELETE /:productId` під `sessionGuard`.
3. `src/api.ts` — оновити composition root, якщо конструктор `ProductService` розширився.
4. `ProductService.spec.ts` — картка без кадрів, картка з десятьма, відмова сховища на пакеті.

## Out of scope

- Копіювання бакета під бекап — поза межами обох поставок.
- Діалог підтвердження — [T19](add-confirm-dialog.md).

## DoD

- [ ] Видалення картки з десятьма кадрами прибирає десять обʼєктів **одним** викликом, не десятьма — перевірено лічильником на двійнику.
- [ ] Каскад підтверджено запитом до бази: рядків `product_images` не лишилось.
- [ ] Відмова сховища не видаляє нічого; код `storage_unavailable`.
- [ ] Жодного `deleted_at` у схемі й жодної умови «не видалено» в запитах каталогу.
- [ ] Коміт: `feat(products): delete a card with its storage objects`.

## Links

- [ADR 0012](../adr/0012-delete-permanently-in-the-same-request.md) · [openapi.yaml](../contracts/openapi.yaml) — `deleteProduct`
- [data-model.md](../data-model.md) — FK `ON DELETE CASCADE`
- [CONTEXT.md](../CONTEXT.md) — «картка товару», Invariants
