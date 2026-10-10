---
id: T127
title: "Назва для Prom ≤ 130 знаків при збереженні картки"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1400
blocked_by: [T123, T126]
blocks: [T139]
updated_at: "2026-10-10"
---

# T127 — Назва для Prom ≤ 130 знаків при збереженні картки

## Context

AC-05 має дві половини. Ця story — перша: **збереження** назви для Prom понад 130 знаків
відхиляється. Друга половина, «картка, збережена раніше з довшою назвою, не відправляється»,
належить готовності ([T130](add-prom-readiness.md), `overLimit: titleProm`).

Колонка лишається `varchar(200)` ([data-model.md](../data-model.md)): межу тримає zod, а не тип. На
dev довших за 130 — 0 з 559, тож жодна наявна картка не застрягне. Прод рахується до релізу
([T143](verify-prom-draft-sync.md)).

Межа — `productConstraints.promTitleMaxLength` з [T123](add-prom-sync-codes-and-limits.md). Назва
для OLX лишається до 200. У формі валідатор `titleProm` бере ту саму константу, а підказка біля
поля каже, скільки знаків зайві. Блокер T126 — не логічний, а файловий: обидві story правлять
`products.contract.ts`.

## Sequence

[sad.md §6](../sad.md#6-runtime-view) — збережена назва, яку читає старт відправки:

> `api->>pg: читає збережену картку, перевіряє готовність і межі Prom`

## Data delta

**Схема не змінюється.** `products.title_prom` лишається `VARCHAR(200)`; нова межа — правило
zod-схеми збереження ([data-model.md](../data-model.md), `products`).

## API contract excerpt

```yaml
        titleProm: { type: string, minLength: 1, maxLength: 130 }
    TitlePromTooLong:
        Тіло не пройшло zod-валідацію; зокрема назва для Prom понад 130 знаків (AC-05).
              code: validation_failed
              details: { fields: { titleProm: ["Too big: expected string to have <=130 characters"] } }
```

## Acceptance criteria

**AC-05** (US-02) — error, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** user редагує назву для Prom
**When** user вводить назву на 131 знак і зберігає картку
**Then** бекенд відповідає `400 validation_failed` з `details.fields.titleProm`, картку не збережено, а форма показує «до 130 знаків, зайві 1»

**AC-05** (US-02) — межа
**Given** назва для Prom рівно 130 знаків
**When** user зберігає картку
**Then** картку збережено; назва для OLX на 200 знаків так само зберігається

## Checklist

1. `products.contract.ts`: `titleProm` у тілах створення й збереження — `max(productConstraints.promTitleMaxLength)`; `titleOlx` без змін. Spec: 130 проходить, 131 — ні, OLX 200 проходить.
2. `product-form.ts`: валідатор `titleProm` за `promTitleMaxLength`; помилка `maxlength` у шаблоні рахує зайві знаки (`actualLength - requiredLength`).
3. Spec форми: 131 знак — повідомлення з числом зайвих і неактивне збереження; 130 — без повідомлення.
4. Playwright: назва на 131 знак у формі картки показує підказку, на 130 — ні.

## Out of scope

- Неможливість відправити картку зі старою довшою назвою ([T130](add-prom-readiness.md)).
- Підготовка назви AI в межах 130 ([T141](keep-ai-title-within-prom-limit.md)).

## DoD

- [ ] Межа 130 береться з однієї константи в бекенді й у формі.
- [ ] Тести обох застосунків зелені; Playwright-перевірка пройдена.
- [ ] Коміт: `feat(products): limit the Prom title to 130 characters on save`.

## Links

- [openapi.yaml](../contracts/openapi.yaml) `ProductUpdateRequest`, `TitlePromTooLong`
- [data-model.md](../data-model.md), `products.title_prom`
