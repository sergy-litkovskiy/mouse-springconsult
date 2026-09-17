---
id: T38
title: "Порожня картка: створення без полів і заголовки в предикаті готовності"
status: Done
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2300
blocked_by: []
blocks: [T20]
updated_at: "2026-09-17"
---

# T38 — Порожня картка: створення без полів і заголовки в предикаті готовності

## Context

Знахідка 2026-09-17, під час підготовки [T20](add-product-form-subfeature.md). Нову картку
діалог створити не може. Кадр вантажиться лише в наявну картку, бо ключ R2 —
`products/{id}/…`. Поки кадру немає, AC-20 вимикає всі текстові поля. Проте
`POST /products` у коді вимагає `titleProm`, `titleOlx` і `category`, а в базі
`title_prom`, `title_olx` і `category` мають `NOT NULL` без default. Виходить замкнене коло.

[openapi.yaml](../contracts/openapi.yaml) описує створення інакше: «порожня картка (без
текстів, кадрів і ціни)», де обовʼязкова лише `category`. Реалізація T10/T11 розійшлася з
цим описом. **Рішення 2026-09-17 (Serhii):** картка створюється порожньою. Діалог T20
викликає `POST /products`, щойно обрано перший кадр, і вантажить кадр у створену картку.
Тіло запиту може бути порожнім: `category` так само недоступна до першого кадру.

**Наслідок для готовності.** Досі непорожні заголовки гарантувала схема, тож предикат
[ADR 0009](../adr/0009-derive-card-readiness-instead-of-storing-it.md) їх не перевіряв.
Відтепер картка з описами, ціною й кадром, але без назв, стала б «готовою». Тому предикат
отримує обидва заголовки. Так він узгоджується з підказкою прогалин у
[sad.md §6](../sad.md#6-runtime-view), яка вже називає заголовки серед того, чого бракує, і з
AC-15 («бракує … одного з текстів»).

**Свідомий наслідок.** «Скасувати» після першого кадру лишає в каталозі неготову картку без
назви. Прибирати її автоматично ця задача не береться: видалення з каталогу вже є ([T17](add-delete-product-endpoint.md)).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 1**: кадр іде в картку, яка вже існує,
тож картка мусить зʼявитись раніше, ніж людина щось впише:

> `web->>api: надсилає кадр картки`
> `api->>r2: кладе оригінал під ключем products/<картка>/<кадр>`

## Data delta

Нова міграція `1789651109349-default-empty-product-card-fields.ts`:

| Колонка | Було | Стало |
|---|---|---|
| `products.title_prom` | `VARCHAR(200) NOT NULL` | `VARCHAR(200) NOT NULL DEFAULT ''` |
| `products.title_olx` | `VARCHAR(200) NOT NULL` | `VARCHAR(200) NOT NULL DEFAULT ''` |
| `products.category` | `VARCHAR(120) NOT NULL` | `VARCHAR(120) NOT NULL DEFAULT ''` |

`NOT NULL` лишається, тож предикат і далі не має тризначної логіки. `down` знімає default.
Наявні рядки не змінюються: у них заголовки вже непорожні.

## API contract excerpt

```yaml
      summary: Створити нову картку
        Порожня картка (без текстів, кадрів і ціни) — потрібна до вставки, бо ключ
      operationId: createProduct
    ProductCreateRequest:
      type: object
        category: { type: string, maxLength: 120 }
```

Після задачі `required` зникає, а приклад запиту стає `{}`.

## Acceptance criteria

**AC-35 (нове) — happy path**
**Given** `user` відкрив діалог нової картки й обрав перший кадр
**When** `web` надсилає `POST /products` з порожнім тілом `{}`
**Then** система створює картку з порожніми заголовками, описами й категорією, ціною `"0.00"` і повертає 201 з `id`, у який можна вантажити кадр

**AC-36 (нове) — domain invariant**
**Given** картка має обидва описи, ціну й кадр, але порожній `titleProm` або `titleOlx`
**When** система рахує її готовність — у `isReady` і у фільтрі `ready`
**Then** картка не є готовою, і обидва джерела предиката відповідають однаково

**AC-12** ([PRD §5](../PRD.md#5-acceptance-criteria)) лишається чинним: заголовки
заповнюються тим самим `PATCH`, яким зберігається решта картки. Порожній заголовок `PATCH`
і далі відхиляє (`min(1)`), тож стерти назву вже заповненої картки не можна.

## Checklist

1. Міграція: `DEFAULT ''` для `title_prom`, `title_olx` і `category`; `down` знімає default. Entity `Product.ts` не змінюється: default описів теж живе лише в міграції. Зроблено окремим комітом до `/tdd`, бо implementer нових файлів не створює.
2. `contracts/products.contract.ts`: `titleProm`, `titleOlx`, `category` у `productCreateSchema` необовʼязкові з default `''`. Порожній рядок, переданий явно, і далі відхиляється.
3. `ProductRepository.ts`: `ProductDraft` — усі поля необовʼязкові; коментар над ним більше не називає три колонки без default.
4. `ProductService.isReady` і `READINESS_EXPRESSION`: обидва заголовки непорожні. Таблиця узгодженості AC-30 у `ProductRepository.spec.ts` отримує дві картки, де бракує лише заголовка.
5. Тести: `POST /products` з `{}` → 201 і порожні поля (AC-35); `isReady` для картки без заголовка (AC-36).
6. `openapi.yaml`: `ProductCreateRequest` без `required`, приклад `{}`; опис `isReady` називає заголовки.
7. `PRD.md §5`: AC-35 і AC-36; `ADR 0009`: примітка 2026-09-17 до опції 1 про заголовки в предикаті.

## Out of scope

- Автоматичне видалення порожньої картки після «Скасувати» — окреме рішення, якщо знадобиться.
- Діалог і його послідовність «створити → вантажити» — [T20](add-product-form-subfeature.md), [T21](add-gallery-upload-dialog.md).
- Категорія в предикаті готовності — AC-15 її не називає.

## DoD

- [x] AC-35: `POST /products` з `{}` створює порожню картку — перевірено тестом контролера і смоуком.
- [x] AC-36: без заголовка картка неготова і в `isReady`, і у фільтрі `ready` — перевірено на реальній базі.
- [x] Міграція проходить `down` і `up`; наявні картки не змінюються.
- [x] `openapi.yaml` і `products.contract.ts` описують одне й те саме тіло створення.
- [x] Коміт: `feat(products): create an empty card before its first frame`.

Результат 2026-09-17:
- Пункт 4 виконано окремим тестом `leaves a card without a title out of the ready ones, as isReady does (AC-36)`, а не новими рядками таблиці AC-30: правка наявного `it` не є роботою RED.
- На паузі перегляду тестів з RED прибрано перевірку «без `titleProm` створення відхиляється», яку story скасовує.
- Смоук: без сесії — 401, `titleProm: "  "` — 400, `{}` — 201 з `isReady: false`.

## Links

- [ADR 0009](../adr/0009-derive-card-readiness-instead-of-storing-it.md) · [T34](add-readiness-list-filter.md) — `READINESS_EXPRESSION`
- [data-model.md](../data-model.md) — `products` · [openapi.yaml](../contracts/openapi.yaml) — `createProduct`
- [CONTEXT.md](../CONTEXT.md) — «готова картка»
