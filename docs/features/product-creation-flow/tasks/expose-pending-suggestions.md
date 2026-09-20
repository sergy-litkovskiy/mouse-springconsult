---
id: T53
title: "Непідтверджені пропозиції у відповіді картки"
status: Todo
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2400
blocked_by: [T26, T30]
blocks: [T32]
updated_at: "2026-09-20"
---

# T53 — Непідтверджені пропозиції у відповіді картки

## Context

Знайдено 2026-09-20 у `critical-path-review` [T30](add-suggestion-resolution-endpoints.md).
`openapi.yaml` має `pendingSuggestions` обов'язковим полем картки, `api` його не віддає, а
Checklist T30 про нього мовчить. Споживач — [T32](add-preparation-ui.md), п. 6: без цього поля
фронту нема звідки взяти пропозицію, щоб показати її поруч із полем і дати кнопку «<- AI».

Задача ширша за «додати поле», бо те саме рев'ю відкрило друге розходження. `pendingSuggestions`,
`totalInputTokens` і `totalOutputTokens` оголошені на спільній схемі `Product`, якою відповідають
і каталог, і створення, і редагування. [T31](add-card-cost-readout.md) свідомо поклала суми лише
на читання картки: сторінка каталогу з 50 рядків інакше рахувала б 50 сум на запит. Отже
розходяться не поле й код, а контракт і вже ухвалене рішення — і виправляти треба контракт.

**Рішення.** Три поля переїжджають зі схеми `Product` у схему відповіді **читання картки**
(`GET /products/{productId}` і обидва маршрути пропозицій). Каталог, створення й редагування
лишаються на `Product` без них. Це ретро-фіксація вибору T31, а не нова домовленість.

**Що таке «непідтверджена».** `resolution IS NULL` — і рівно після того, як звірка T30 відпрацює.
Пропозиція, яку звірка застосувала сама, вже `accepted` і в масив не потрапляє; лишається те, що
справді чекає на людину (AC-11). Тому поле рахується в тому самому читанні, а не до нього.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 9** — останній крок циклу звірки й відповідь,
до якої [T30](add-suggestion-resolution-endpoints.md) дійшла лише наполовину:

> `api->>pg: звіряє поточне значення з останньою прийнятою пропозицією`
> `api-->>web: значення полів, а поруч — непідтверджені пропозиції`

Половина «значення полів» уже віддається; половина «а поруч — непідтверджені пропозиції» — ні.

## Data delta

| Що | Зміна |
|---|---|
| схема БД | **не змінюється**: таблиця й `resolution` створені [T26](add-preparation-tables-migration.md), семантика трьох станів закрита [T30](add-suggestion-resolution-endpoints.md) |
| читання | пропозиції картки з `resolution IS NULL` — **з тієї самої вибірки**, яку звірка вже робить, без другого запиту |
| контракт | `pendingSuggestions`, `totalInputTokens`, `totalOutputTokens` — зі схеми `Product` у схему відповіді читання картки |
| словник | `field` у БД — `title_prom`, у контракті — `titleProm`; мапінг робить `products` у своєму контролері, як і решту DTO |

Зворотний мапінг **не** беремо з `modules/ai`: шість рядків дешевші за залежність `products` від
нутрощів сусіднього модуля, і `deps:check` таку залежність усе одно не пропустить.

## API contract excerpt

```yaml
        pendingSuggestions:
          type: array
          items: { $ref: "#/components/schemas/FieldSuggestion" }
```

```yaml
      required: [id, runId, field, value, createdAt]
          enum: [titleProm, titleOlx, descriptionProm, descriptionOlx, seoKeywords, price]
        resolution: { type: [string, null], enum: [accepted, rejected, null] }
```

`resolution` і `resolvedAt` у масиві завжди `null` — інших там не буває. Прибирати їх зі схеми
`FieldSuggestion` не треба: її ж формою оголошено пропозицію взагалі.

## Acceptance criteria

**AC-41** (US-05, US-06) — happy path
**Given** картка має пропозицію, яку звірка не застосувала через ручну правку поля
**When** `user` відкриває картку
**Then** відповідь несе цю пропозицію в `pendingSuggestions` — з `id`, `field` у словнику
контракту і `value` — щоб фронт показав її поруч із полем і дав прийняти чи відхилити

**AC-42** (US-05) — domain invariant
**Given** порожнє поле й пропозиція до нього
**When** `user` відкриває картку
**Then** звірка застосовує пропозицію й позначає її `accepted`, і в `pendingSuggestions` її
**немає**: масив несе лише те, що чекає на рішення людини, а не все, що модель колись віддала.
Відхилена пропозиція не повертається в масив ніколи

## Checklist

1. `contracts/products.contract.ts` — схема пропозиції і `pendingSuggestions` у схемі
   відповіді читання картки (`productCardReadSchema` з [T31](add-card-cost-readout.md)), **не** в
   `productCardSchema`: остання типізує ще й рядок каталогу.
2. `ProductService` — читання картки віддає непідтверджені пропозиції з тієї самої вибірки, яку
   робить звірка; другого запиту в базу не з'являється.
3. `ProductController` — мапінг `field` зі словника БД у словник контракту і поле в DTO;
   `accept` і `reject` відповідають тією самою формою, що й читання.
4. `openapi.yaml` — три поля зі схеми `Product` у схему відповіді читання картки; каталог,
   створення й редагування лишаються без них.
5. `PRD.md §5` — примітка, що `pendingSuggestions` віддається читанням картки, а не списком.

## Out of scope

- Показ пропозицій, кнопки «<- AI» і парні поля — [T32](add-preparation-ui.md).
- Пагінація чи ліміт масиву: пропозицій на картку одиниці, бо `(run_id, field)` UNIQUE.
- Зміна семантики `resolution` — вона закрита [T30](add-suggestion-resolution-endpoints.md).

## DoD

- [ ] AC-41: картка з ручною правкою віддає пропозицію в `pendingSuggestions`.
- [ ] AC-42: автозастосована пропозиція в масиві не з'являється, відхилена — теж.
- [ ] Картка без жодного запуску віддає `[]`, а не відсутнє поле.
- [ ] Кількість запитів у базу на читання картки не зросла.
- [ ] `openapi.yaml` більше не обіцяє трьох полів картки у відповіді каталогу.
- [ ] Коміт: `feat(products): answer the card read with its pending suggestions`.

## Links

- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-11, AC-12 · [sad.md §6](../sad.md#6-runtime-view), сценарій 9
- [ADR 0006](../adr/0006-store-generated-values-as-separate-suggestions.md) · [openapi.yaml](../contracts/openapi.yaml)
- [T30](add-suggestion-resolution-endpoints.md) · [T31](add-card-cost-readout.md) · [T32](add-preparation-ui.md)
