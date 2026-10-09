---
id: T111
title: "Запуск price з назвами й описами чернетки: тіло запиту, ключ, модель запуску"
status: Done
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2500
blocked_by: [T110]
blocks: [T112, T115]
updated_at: "2026-10-09"
---

# T111 — Запуск price з назвами й описами чернетки: тіло запиту, ключ, модель запуску

## Context

Сьогодні `PreparationRunService` будує вхід ціни зі **збереженої** картки (`priceQueryInput`)
і відмовляє лише без назви. За
[ADR 0021](../adr/0021-search-prices-from-the-run-input-not-the-saved-card.md) запуск `price`
несе в тілі чотири рядки чернетки, а `api` обирає пару через
[`priceSearchInput`](add-price-search-input.md). Без назви **або** опису він відмовляє `409`
(AC-02), і ключ ідемпотентності рахується з обраної пари.

За [ADR 0025](../adr/0025-keep-gemini-calls-out-of-the-token-ledger.md) запуск `price`
створюється з моделлю Gemini, а не Claude. `config.ai.pricing` отримує рядок цієї моделі з
нульовим тарифом, інакше `estimateCostUsd` поверне для картки `null`.

**Нероздільно з фронтом, і це названий виняток.** `web` імпортує тип тіла з
`@contracts/ai.contract`. Щойно гілка `price` вимагає чотири рядки, `lookUpPrice()` у формі
перестає компілюватись. Тому сюди входить і мінімальна правка виклику: форма шле поточну
чернетку. Гейт кнопки й пояснення AC-02 лишаються [T115](enable-find-price-button.md). Кнопку
досі вимкнено, тож для user-а нічого не змінюється.

Сервіс `api` змінює payload задачі (продюсер, `PreparationRunJob`), а `worker` читає з нього
пару лише після [T112](search-price-through-gemini.md). До того гілка ціни у `worker` закриває
запуск `price_unavailable` ([T107](remove-anthropic-price-search.md)), тож зайві поля
payload нічого не ламають.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарії 1 і 4:

> `web->>api: старт запуску price з назвами й описами чернетки`
> `api-->>web: відмова preparation_input_incomplete, задача не ставиться`
> `api->>pg: ліміт 20 запусків на картку за годину, пише product_preparation_runs (queued, model Gemini)`
> `api->>pg: ставить задачу product-preparation з парою`
> `api->>pg: частковий UNIQUE на queued/running — знаходить той самий запуск`

## Data delta

| Колонка | Зміна для `scope = 'price'` |
|---|---|
| `product_preparation_runs.idempotency_key` | з пари назва + опис, що піде в пошук, а не зі збереженої картки |
| `product_preparation_runs.model` | `config.ai.priceSearch.model` замість `config.ai.model` |
| `input_tokens`, `output_tokens` | лишаються 0 |

Схема не змінюється ([data-model.md](../data-model.md)). Ключ `both` втрачає складову
`priceQueryInput`, бо `both` шукає за щойно згенерованими текстами (api-sync-report, Follow-up).

## API contract excerpt

```yaml
    PriceRunRequest:
      type: object
      required: [scope, titleProm, titleOlx, descriptionProm, descriptionOlx]
      additionalProperties: false
      properties:
        scope: { type: string, const: price }
        titleProm: { type: string }
        titleOlx: { type: string }
        descriptionProm:
          type: string
        descriptionOlx: { type: string }
                  items:
                    type: string
                    enum: [gallery, title, description, draft]
```

## Acceptance criteria

**AC-02** (US-01) — error, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** у чернетці немає жодної назви або жодного опису
**When** приходить старт `scope: price`
**Then** `409 preparation_input_incomplete` з `details.missing`, у якому `title`, `description` чи обидва; задача не ставиться

**AC-07** (US-05) — domain invariant
**Given** запуск `price` з тим самим входом уже `queued` чи `running`
**When** приходить той самий старт ще раз
**Then** повертається той самий запуск (`200`), а після його завершення той самий вхід ставить новий (`201`)

## Checklist

1. `contracts/ai.contract.ts`: окрема гілка `price` у `preparationRunRequestSchema` з чотирма рядками без `maxLength` ([api-sync-report.md](../contracts/api-sync-report.md), «Розбіжності»). `texts`/`both` лишаються лише зі `scope`. Плюс кейси в `ai.contract.spec.ts`.
2. `ProductErrors.ts`: `PreparationInputIncomplete` приймає масив і значення `'description'` (Section B п.2). Наявні виклики з одним значенням переходять на масив.
3. `PreparationRunService.ts`: для `price` кличе `priceSearchInput` з тіла; без пари `PreparationInputIncomplete(missing)`. Гейт на `titleProm`/`titleOlx` збереженої картки й `priceQueryInput` прибрати ([ADR 0021](../adr/0021-search-prices-from-the-run-input-not-the-saved-card.md), Neutral).
4. Ключ: `price` — `{pair}`, `both` — лише кадри. `model` запуску: Gemini для `price`, Claude для решти.
5. `PreparationQueue.ts`: `PreparationRunJob` для `price` несе `title` і `description`. Тип споживача `PreparationJob` у `ai` змінює [T112](search-price-through-gemini.md).
6. `src/config.ts` `ai.pricing`: рядок моделі пошуку з `0` µ$ на токен в обидва боки ([ADR 0025](../adr/0025-keep-gemini-calls-out-of-the-token-ledger.md) №3).
7. `PreparationRunService.spec.ts` і `PreparationRunController.spec.ts`: змішана пара, `missing: [title, description]`, опис лише з тегів дає 409, повтор під час `queued`, новий запуск після `failed`, модель Gemini в рядку запуску, ключ `both` не залежить від збережених назв.
8. `web/products/form/product-form.ts`: `lookUpPrice()` шле чотири рядки поточної чернетки.
9. Контракт [product-creation-flow](../../product-creation-flow/contracts/openapi.yaml): біля 409 `title` («назва збереженої картки», AC-27) поставити лінк на цей контракт (Follow-up).

## Out of scope

- Гейт кнопки «Знайти ціну» за чернеткою й текст пояснення ([T115](enable-find-price-button.md)).
- Читання пари з payload у `worker` ([T112](search-price-through-gemini.md)).

## DoD

- [x] Повтор того самого входу ліміт частоти не витрачає: наявний запуск повертається до підрахунку.
- [x] Вартість картки із запуском `price` — `"0.0000"`, а не `null`: перевірено тестом.
- [x] `typecheck` · `lint` · `test` · `deps:check` обох застосунків зелені.
- [x] Коміт: `feat(products): start the price run from the draft title and description`.

## Links

- [ADR 0021](../adr/0021-search-prices-from-the-run-input-not-the-saved-card.md) · [ADR 0025](../adr/0025-keep-gemini-calls-out-of-the-token-ledger.md) · [ADR 0017](../../product-creation-flow/adr/0017-keep-one-latest-suggestion-per-field.md) №6
- [events.md](../contracts/events.md), Payload і «Зворотна сумісність»
