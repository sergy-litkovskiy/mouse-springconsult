---
id: T15
title: "Призначення головного кадру"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1300
blocked_by: [T11, T13]
blocks: [T23]
updated_at: "2026-09-05"
---

# T15 — Призначення головного кадру

## Context

Найменша задача поставки 1: інваріант уже тримає частковий унікальний індекс
`product_images_main_key`, транзакцію вже написав [T13](add-image-repository.md). Лишається
маршрут і мапінг.

Головний кадр — той, що показує каталог, тож AC-03 має видимий наслідок на кожній сторінці.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 3** — повністю, від дії до відповіді:

> `user->>web: обирає головним інший кадр`
> `web->>api: просить призначити головний`
> `api->>pg: однією транзакцією знімає ознаку з попереднього й ставить на обраний`
> `api-->>web: оновлена галерея`

## Data delta

| Таблиця | Зміна | Джерело |
|---|---|---|
| `product_images.is_main` | `false` на попередньому, `true` на обраному — одна транзакція | [data-model.md](../data-model.md) |
| схема | **не змінюється**; індекс `product_images_main_key` уже наявний | те саме, Indexes |

## API contract excerpt

```yaml
      description: >-
        унікальний індекс `product_images_main_key`, вже наявний у БД. `PUT`, не `POST`:
        повторний виклик з тим самим кадром — той самий результат.
      operationId: setMainProductImage
      responses:
        "200":
          description: Оновлена галерея
        "404": { $ref: "#/components/responses/ImageNotFound" }
```

## Acceptance criteria

**AC-03** (US-01) — domain invariant
**Given** у галереї картки вже є головний кадр
**When** `user` призначає головним інший кадр
**Then** головним стає лише обраний, попередній перестає ним бути

**AC ([openapi.yaml](../contracts/openapi.yaml), `setMainProductImage`) — ідемпотентність**
**Given** кадр уже є головним
**When** `user` призначає головним його ж
**Then** результат той самий, помилки немає — метод `PUT` саме тому й обраний

## Checklist

1. `ProductService.setMainImage` — кидає `ImageNotFound`, якщо кадр не належить цій картці.
2. `ProductController` — `PUT /:productId/images/:imageId/main` під `sessionGuard`.
3. Відповідь — уся галерея, а не один кадр: інакше фронту довелося б перечитувати її окремим запитом.

## Out of scope

- Перестановка кадрів у галереї — окрема дія, у контракті поставки 1 її немає.
- Автоматичне призначення головним першого завантаженого кадру — поведінка [T14](add-image-upload-endpoint.md), якщо вона потрібна.

## DoD

- [ ] AC-03: після виклику головним лишається рівно один кадр — перевірено запитом до бази, не лише відповіддю.
- [ ] Кадр чужої картки дає `image_not_found`, а не мовчазний успіх.
- [ ] Повторний виклик з тим самим кадром не падає — ідемпотентність `PUT` підтверджена тестом.
- [ ] Маршрут під `sessionGuard`.
- [ ] Коміт: `feat(products): add the main-frame endpoint`.

## Links

- [openapi.yaml](../contracts/openapi.yaml) — `setMainProductImage` · [sad.md §6](../sad.md#6-runtime-view), сценарій 3
- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-03
- [CONTEXT.md](../CONTEXT.md) — «головний кадр»
