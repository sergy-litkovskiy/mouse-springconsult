---
id: T94
title: "Вартість картки в доларах у відповіді читання"
status: Done
delivery: 4
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2400
blocked_by: []
blocks: [T95, T97]
updated_at: "2026-10-06"
---

# T94 — Вартість картки в доларах у відповіді читання

## Context

Запит 2026-10-05. Рядок «Витрачено токенів» показує лише токени. Власник хоче бачити й гроші,
тож рішення 2026-08-31 відкласти облік вартості цим запитом скасовано.
[T31](add-card-cost-readout.md) свідомо не вводив валюти, бо тарифу моделі тоді не було в
жодному документі. Тепер тариф є: [ADR 0018](../../../adr/0018-use-sonnet-5-for-card-preparation.md)
фіксує для `claude-sonnet-5` $2 за 1M вхідних і $10 за 1M вихідних токенів.

**Тариф — константа, не env.** Він однаковий на всіх машинах і змінюється разом з моделлю,
тобто комітом (`CLAUDE.md`, «Конфігурація»). У `config.ts` поруч з `config.ai.model` з'являється
таблиця тарифів за ідентифікатором моделі. Кожен запуск пам'ятає свою модель
(`product_preparation_runs.model`), тож картка з запусками різних моделей рахується правильно,
доки тариф кожної є в таблиці.

**Гроші без float.** Ціна токена в мікродоларах ціла ($2/1M = 2 µ$, $10/1M = 10 µ$), тож сума
рахується цілими числами, і лише в кінці стає десятковим рядком з чотирма знаками
(`"0.0412"`), як того вимагає `CLAUDE.md` («Гроші»). Округлення до четвертого знака — половина
вгору. Курсу гривні немає: витрати Anthropic виставляє в доларах.

**`null` означає «невідомо», а не нуль.** Якщо хоч один запуск картки має модель без тарифу в
таблиці, сума була б заниженою, а не приблизною. Тому поле стає `null`. Картка без запусків
отримує `"0.0000"`: «витрат не було» і «невідомо» — різні речі ([T31](add-card-cost-readout.md)).

**Пошуків поки не враховано.** Web search коштує $10 за 1000 запитів, але кількість пошуків
запуску ніде не записана. Її додає [T97](record-web-searches-per-run.md), і він же вмикає
пошуки в цю суму. До того старі запуски `scope: price` з вересня рахуються лише за токенами.

## Sequence

Власного сценарію не має: вартість читається разом із карткою.
[sad.md §6](../sad.md#6-runtime-view), сценарій 9:

> `web->>api: перечитує картку`
> `api->>pg: читає поля картки й одну пропозицію на поле`

Той самий крок читання віддає й суму токенів, а тепер — і суму в доларах.

## Data delta

| Що | Зміна |
|---|---|
| схема | **не змінюється**: `model`, `input_tokens`, `output_tokens` уже є |
| читання | `sumTokens` замінюється сумою з `group by model` одним запитом: рядок на модель, а не на запуск |
| індекс | `product_preparation_runs_product_id_idx` обслуговує й групування ([data-model.md](../data-model.md)) |

## API contract excerpt

```yaml
    ProductCardRead:
          required:
            [latestSuggestions, totalInputTokens, totalOutputTokens, estimatedCostUsd]
            totalInputTokens:
              type: integer
              minimum: 0
                Сума `product_preparation_runs.input_tokens` по картці (AC-14). Поруч
                з'явилось `estimatedCostUsd` — переклад тих самих токенів у долари за
                тарифом з ADR 0018 (AC-84).
            totalOutputTokens: { type: integer, minimum: 0 }
            estimatedCostUsd:
              type: [string, "null"]
              pattern: '^\d+\.\d{4}$'
              example: "0.0052"
```

## Acceptance criteria

AC-84 нове, до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить крок 7 чекліста.

**AC-84 (US-08) — happy path**
**Given** картка мала два запуски `claude-sonnet-5`: 1000/200 і 340/55 токенів
**When** `user` відкриває картку
**Then** відповідь несе `estimatedCostUsd: "0.0052"`: (1340 × 2 + 255 × 10) µ$, округлено до четвертого знака

**AC-84 — edge case**
**Given** картка не мала жодного запуску
**When** `user` її відкриває
**Then** `estimatedCostUsd` дорівнює `"0.0000"`, а не `null`

**AC-84 — error**
**Given** один із запусків картки має модель, якої немає в таблиці тарифів
**When** `user` відкриває картку
**Then** `estimatedCostUsd` дорівнює `null`, а токени показуються як раніше

## Checklist

1. `config.ts`: `config.ai.pricing` — тариф за ідентифікатором моделі в мікродоларах за токен, з посиланням на ADR 0018 і датою цін.
2. `PreparationRepository.spec.ts` проти реальної бази: суми вхідних і вихідних токенів по моделях однієї картки, без рядків чужої картки.
3. `PreparationRepository.ts`: `sumTokensByModel` одним запитом з `group by model` замість `sumTokens`.
4. Чиста функція вартості з тестами: цілочисельна сума в µ$, рядок з чотирма знаками, `null` на модель без тарифу, `"0.0000"` на порожній перелік, округлення половини вгору на межі.
5. `products.contract.ts`: `estimatedCostUsd` у схемі читання картки (десятковий рядок з чотирма знаками або `null`); `ProductService` його заповнює.
6. `openapi.yaml`: `estimatedCostUsd` у `ProductCardRead` і в прикладі; переписати опис `totalInputTokens`.
7. `PRD.md §5`: AC-84; у §8 у питанні про стелю вартості дописати, що лічильник у доларах є з T94, а порога досі немає.

## Out of scope

- Показ у формі — [T95](show-card-cost-in-usd.md).
- Вартість пошуків — [T97](record-web-searches-per-run.md).
- Стеля вартості картки в доларах ([PRD §8](../PRD.md#8-open-questions)): лічильник з'являється, поріг ні.
- Вартість у рядку каталогу: сторінка з 50 рядків рахувала б 50 сум ([T31](add-card-cost-readout.md)).

## DoD

- [x] AC-84: три випадки покрито тестами, сума рахується одним запитом.
- [x] У коді вартості немає `number` з дробовою частиною: лише цілі µ$ і рядок на виході.
- [x] Тести `api` зелені, `typecheck`, `lint`, `deps:check` зелені.
- [x] Коміт: `feat(products): expose the card cost in USD`.

## Links

- [ADR 0018](../../../adr/0018-use-sonnet-5-for-card-preparation.md) — модель і тарифи · [T31](add-card-cost-readout.md) — лічильник токенів
- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-14 · [PRD §8](../PRD.md#8-open-questions) · [data-model.md](../data-model.md)
- [openapi.yaml](../contracts/openapi.yaml) — `ProductCardRead`
