---
id: T13
title: "Кадри в репозиторії: вставка, позиція, головний, видалення"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1500
blocked_by: [T09]
blocks: [T14, T15, T16]
updated_at: "2026-09-05"
---

# T13 — Кадри в репозиторії: вставка, позиція, головний, видалення

## Context

Рядок `product_images` належить картці, видаляється каскадом разом із нею, і entity вже
живе в модулі `products` — тож писати його має його ж репозиторій
([sad.md §5](../sad.md#5-building-block-view)). Окремого репозиторію під кадри немає.

Два інваріанти тримає **база**, а не уважність коду.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 3** — транзакція й індекс, який її страхує:

> `api->>pg: однією транзакцією знімає ознаку з попереднього й ставить на обраний`
> `pg-->>api: частковий унікальний індекс product_images_main_key підтверджує інваріант`

## Data delta

Схема не змінюється — задача **спирається** на індекси, які вже накотила міграція
`1787756956906-create-products-tables` ([data-model.md](../data-model.md), Indexes):

| Індекс | Що тримає | Наслідок для коду |
|---|---|---|
| `product_images_main_key` — `product_id WHERE is_main` UNIQUE | рівно один головний кадр (AC-03) | зняття + встановлення мають бути **однією** транзакцією |
| `product_images_position_key` — `(product_id, position)` UNIQUE **DEFERRABLE** | порядок у галереї | перестановка місцями проходить лише тому, що обмеження відкладене |
| `product_images_r2_key_key` — `r2_key` UNIQUE | один обʼєкт R2 належить одній картці | вставка з чужим ключем падає, і це правильно |

## API contract excerpt

```yaml
      description: >-
        Однією транзакцією знімає ознаку з попереднього головного й ставить на обраний
        (AC-03, sad.md сценарій 3); інваріант "рівно один головний" тримає частковий
        унікальний індекс `product_images_main_key`, вже наявний у БД. `PUT`, не `POST`:
      operationId: setMainProductImage
```

## Acceptance criteria

**AC-03** (US-01) — domain invariant
**Given** у галереї картки вже є головний кадр
**When** `user` призначає головним інший кадр
**Then** головним стає лише обраний, попередній перестає ним бути — головний кадр у картці завжди рівно один

**AC-02** (US-01) — domain invariant
**Given** у галереї картки вже десять кадрів
**When** система рахує кадри перед вставкою
**Then** лічильник повертає рівно десять, і одинадцятий не вставляється

## Checklist

1. `addImage(productId, r2Key, position)`.
2. `countImages(productId)` — вхід межі AC-02.
3. `setMainImage(productId, imageId)` — **однією транзакцією** знімає й ставить.
4. `reorderImages(productId, order)` — спирається на `deferrable` обмеження.
5. `findImage(productId, imageId)`, `findImageKeys(productId)`, `deleteImage(imageId)`.
6. `ProductRepository.spec.ts` — інваріанти на **реальній** тестовій базі: два головних одночасно неможливі; перестановка місцями проходить.

## Out of scope

- Межа десяти кадрів як правило — це домен, і перевіряє її сервіс ([T14](add-image-upload-endpoint.md)); репозиторій дає лише лічильник.
- Робота зі сховищем — `MediaService`; репозиторій знає самий ключ.

## DoD

- [ ] AC-03: спроба позначити другий кадр головним лишає рівно один головний — перевірено **проти індексу**, а не проти коду.
- [ ] Перестановка двох кадрів місцями не падає на унікальному обмеженні — тест на реальній базі, не на двійнику.
- [ ] `setMainImage` виконується однією транзакцією; проміжного стану без головного кадру не існує.
- [ ] `npm run test` в `api` зелений на тестовій базі.
- [ ] Коміт: `feat(products): add gallery frame operations to the repository`.

## Links

- [data-model.md, Indexes](../data-model.md) · [openapi.yaml](../contracts/openapi.yaml) — `setMainProductImage`
- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-02, AC-03
- [CONTEXT.md](../CONTEXT.md) — «головний кадр», «галерея», Invariants
