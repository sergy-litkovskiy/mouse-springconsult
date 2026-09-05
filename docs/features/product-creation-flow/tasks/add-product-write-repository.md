---
id: T09
title: "Створення, оновлення й видалення картки в репозиторії"
status: Todo
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1500
blocked_by: []
blocks: [T10, T13, T17]
updated_at: "2026-09-05"
---

# T09 — Створення, оновлення й видалення картки в репозиторії

## Context

`ProductRepository` уміє сьогодні лише читати список. Ця задача додає три операції над
карткою й лишається єдиним місцем модуля, де згадуються `typeorm` і `pg`
([CLAUDE.md](../../../../CLAUDE.md), правило 6).

`id` картки потрібен **до** вставки рядка кадру: ключ R2 має форму `products/{id}/{кадр}`.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 6** — єдиний запис, яким пишуться і
ручний, і AI-шлях:

> `api->>pg: одним оновленням пише розпізнавання, тексти, слова й ціну (AC-04)`
> `pg-->>api: оновлений рядок`
> `Note over api,pg: позначки «заповнено вручну» не існує — ручний і AI-шлях пишуть одним маршрутом`

## Data delta

| Таблиця | Зміна | Джерело |
|---|---|---|
| `products` | **схема не змінюється** — міграція `1787756956906-create-products-tables` уже накочена | [data-model.md](../data-model.md), «`products` — без змін» |
| `products.id` | читається `UUID default uuidv7()`, **генерує база**, не застосунок | те саме, рядок `id` |
| `products.price` | `NUMERIC(12,2)` проходить наскрізь десятковим рядком: ні `transformer`, ні конвертера | [CLAUDE.md](../../../../CLAUDE.md), «Гроші» |
| `product_images` | зникають каскадом `ON DELETE CASCADE` при видаленні картки | [data-model.md](../data-model.md), FK |

## API contract excerpt

```yaml
      description: >-
        Порожня картка (без текстів, кадрів і ціни) — потрібна до вставки, бо ключ
        R2 кадру складається з `products/{id}/{кадр}` (data-model.md, `products.id`).
      operationId: createProduct
```

## Acceptance criteria

**AC-04** (US-02) — happy path
**Given** `user` має картку з галереєю
**When** `user` вписує, що це за річ, виробника й базові характеристики
**Then** система зберігає ці відомості в картці й показує їх як вхід для підготовки

**AC-18 (нове, [T01](align-prd-with-architecture.md)) — domain invariant**
**Given** картка має кадри
**When** `user` видаляє картку
**Then** рядки кадрів зникають разом із нею; окремого прибирання рядків не потрібно

## Checklist

1. `create(data)` → повертає збережену картку з `id`.
2. `update(id, data)` → часткове оновлення; поля, яких не було в наборі, не перезаписуються.
3. `delete(id)` → видаляє рядок; кадри йдуть каскадом.
4. `findById(id)` → одна картка з кадрами — потрібна і предикату готовності, і DTO.
5. `ProductRepository.spec.ts` — доповнити наявні випадки, включно з частковим оновленням.

## Out of scope

- Операції над кадрами — [T13](add-image-repository.md).
- Обрізання ключових слів і предикат готовності — домен, живе в сервісі ([T10](add-product-card-service.md)).
- Прибирання обʼєктів R2 перед видаленням рядка — [T17](add-delete-product-endpoint.md).

## DoD

- [ ] Жодного QueryBuilder поза цим файлом — `deps:check` зелений.
- [ ] `update` не перезаписує полів, яких не було в частковому наборі — перевірено тестом на кожному полі, не на одному.
- [ ] Ціна повертається тим самим десятковим рядком, який віддав драйвер: ні `transformer` на колонці, ні конвертера тут.
- [ ] Каскадне видалення кадрів підтверджено запитом до бази після `delete`.
- [ ] `npm run test` в `api` зелений на тестовій базі.
- [ ] Коміт: `feat(products): add card write operations to the repository`.

## Links

- [data-model.md](../data-model.md), `products` · [openapi.yaml](../contracts/openapi.yaml) — `createProduct`, `updateProduct`, `deleteProduct`
- [ADR 0012](../adr/0012-delete-permanently-in-the-same-request.md) — `deleted_at` не зʼявляється
- [CONTEXT.md](../CONTEXT.md) — «картка товару», Invariants
