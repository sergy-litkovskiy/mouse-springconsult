---
id: T95
title: "Форма показує вартість картки в доларах"
status: Blocked
delivery: 4
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1400
blocked_by: [T94]
blocks: [T100]
updated_at: "2026-10-05"
---

# T95 — Форма показує вартість картки в доларах

## Context

Запит 2026-10-05. Рядок під «Згенерувати все» (`data-testid="card-cost"` у
`product-form.html`) зараз каже «Витрачено токенів: N вхідних, M вихідних». Після
[T94](add-card-cost-in-usd.md) відповідь читання несе `estimatedCostUsd`, і рядок дописує суму:

«Витрачено токенів: 1340 вхідних, 255 вихідних · ≈ $0,04»

**Формат — на клієнті** (`CLAUDE.md`, «Гроші»): `Intl.NumberFormat('uk-UA', { style: 'currency',
currency: 'USD' })` з двома знаками. Рядок з `api` у `number` не перетворюється заради
арифметики: форма лише порівнює його з порогом «менше цента» і форматує.

**Чотири стани, і кожен має свій текст:**

| `estimatedCostUsd` | Хвіст рядка |
|---|---|
| `"0.0000"` | `· ≈ $0,00` — витрат не було, рядок про нулі з T31 лишається |
| від `"0.0001"` до `"0.0099"` | `· < $0,01` — округлення до цента дало б хибні $0,00 або завищені $0,01 |
| `"0.0412"` | `· ≈ $0,04` |
| `null` | `· вартість невідома` — запуск моделі без тарифу |

Знак «≈» стоїть тому, що тарифи в `config.ts` — знімок цін на дату ADR, а не рахунок Anthropic.

## Sequence

Власного сценарію не має. [sad.md §6](../sad.md#6-runtime-view), сценарій 9:

> `api-->>web: значення полів без змін, а поруч — остання пропозиція кожного поля`

Та сама відповідь несе й суму, тож нового запиту немає.

## Data delta

**Немає.** Правка лише `product-form.*` у `web`; тип відповіді приходить з `@contracts` після T94.

## API contract excerpt

```yaml
    ProductCardRead:
          required: [latestSuggestions, totalInputTokens, totalOutputTokens]
            totalOutputTokens: { type: integer, minimum: 0 }
```

`estimatedCostUsd` у цій схемі з'являється з [T94](add-card-cost-in-usd.md), і його рядок
стає частиною excerpt-у після мержу T94.

## Acceptance criteria

AC-85 нове, до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить крок 4 чекліста.

**AC-85 (US-08) — happy path**
**Given** відповідь картки несе `estimatedCostUsd: "0.0412"`
**When** `user` відкриває картку
**Then** рядок вартості закінчується на «· ≈ $0,04» після кількості токенів

**AC-85 — edge case**
**Given** `estimatedCostUsd` дорівнює `"0.0030"`
**When** `user` відкриває картку
**Then** рядок закінчується на «· < $0,01», а не на «≈ $0,00»

**AC-85 — error**
**Given** `estimatedCostUsd` дорівнює `null`
**When** `user` відкриває картку
**Then** рядок закінчується на «· вартість невідома», а токени показуються як раніше

## Checklist

1. `product-form.spec.ts`: чотири стани з таблиці Context за текстом `data-testid="card-cost"`; тести рядка токенів лишаються.
2. `product-form.ts`: `totalTokens` несе й суму; форматування через `Intl.NumberFormat` з `uk-UA` і `USD`.
3. `product-form.html`: хвіст рядка вартості.
4. `PRD.md §5`: AC-85.
5. `pw` без платних викликів: картка з запусками й нова картка, знімок рядка на 1280 і 360 px.

## Out of scope

- Вартість у каталозі й місячний рахунок — не вартість картки.
- Розбивка на тексти й пошук ціни: рядок показує одну суму.

## DoD

- [ ] AC-85: чотири стани покрито тестами.
- [ ] Тести `web` і `lint` зелені, `pw` пройдено.
- [ ] Коміт: `feat(web): show the card cost in USD`.

## Links

- [T94](add-card-cost-in-usd.md) — поле в контракті · [T31](add-card-cost-readout.md) — рядок токенів
- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-14
