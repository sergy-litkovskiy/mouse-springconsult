---
id: T29
title: "Запуск підготовки, гейт AC-06, обмеження частоти, полінг"
status: Blocked
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1700
blocked_by: [T28]
blocks: [T30, T32]
updated_at: "2026-09-05"
---

# T29 — Запуск підготовки, гейт AC-06, обмеження частоти, полінг

## Context

HTTP-межа поставки 2. Запит не чекає на модель: він перевіряє вхід, ставить задачу й
відповідає — генерація триває десятки секунд, тож фронт питає стан у циклі.

Три речі, які цей маршрут тримає й через які його не можна звести до «поставити задачу»:
гейт AC-06, обмеження частоти (запуски — це прямі гроші,
[PRD §6.1](../PRD.md#61-security--privacy)) і ідемпотентність, яку **рахує сервер, а не
заголовок клієнта**.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 7** — гейт перед постановкою задачі:

> `api->>pg: перевіряє, що є кадр і внесене розпізнавання (AC-06)`
> `api->>pg: ставить задачу підготовки`
> `api-->>web: задачу прийнято`

та **сценарій 8** — окремий запуск самої лише ціни.

## Data delta

| Таблиця | Зміна |
|---|---|
| `product_preparation_runs` | +1 рядок зі `status: queued`; `idempotency_key` рахує **сервер** із (картка, область, версія входу) |
| `product_preparation_runs_idempotency_key_key` | UNIQUE — повторний запуск того самого входу **не створює другого рядка**, а повертає наявний |
| `created_at` | він же вхід обмеження частоти ([data-model.md](../data-model.md)) — окремої таблиці лічильника немає |

## API contract excerpt

```yaml
      operationId: startPreparationRun
      responses:
        "422":
          description: Немає кадру або не внесено розпізнавання (AC-06)
              example:
                error:
                  code: preparation_input_incomplete
        "429":
          description: Перевищено обмеження частоти запусків (PRD §6.1 — окреме від ліміту входу)
```

## Acceptance criteria

**AC-06** (US-03) — cross-context
**Given** у картці немає жодного кадру або не внесено результат розпізнавання
**When** `user` намагається запустити підготовку текстів
**Then** система не запускає підготовку і називає, чого бракує — кадру чи відомостей про річ

**AC-10b** (US-03, US-04) — часткова відмова
**Given** тексти вже є, а ціни немає
**When** `user` запитує саму лише ціну
**Then** запускається `scope: price`, тексти не перезапускаються

## Checklist

1. `contracts/ai.contract.ts` — схеми запуску й стану; `scope` = `texts` | `price` | `both`.
2. `contracts/error-codes.ts` — `preparation_input_incomplete`, `preparation_rate_limited`.
3. `POST /:productId/preparation-runs` і `GET /:productId/preparation-runs/:runId` під `sessionGuard`.
4. `src/config.ts` — вікно обмеження частоти, число з рішення №3 [T24](close-preparation-open-items.md).
5. Постановка задачі в чергу; HTTP-відповідь не чекає на модель.

## Out of scope

- Сам виклик моделі — [T28](add-preparation-service.md), він у `worker`.
- Прийняття пропозицій — [T30](add-suggestion-resolution-endpoints.md).

## DoD

- [ ] AC-06: картка без кадру й картка без розпізнавання дають `preparation_input_incomplete` — **двома різними повідомленнями**, не одним.
- [ ] AC-10b: `scope: price` запускається окремо, не перезапускаючи текстів.
- [ ] Повторний запуск того самого входу повертає наявний запуск і `200` — перевірено проти унікального індексу, а не логікою в коді.
- [ ] Вичерпаний ліміт частоти дає `preparation_rate_limited`, а не тишу й не 500.
- [ ] `POST` відповідає, не чекаючи на модель — виміряно тривалістю запиту з pino.
- [ ] Обмеження частоти окреме від наявного на спроби входу — перевірено, що вичерпання одного не блокує другого.
- [ ] Коміт: `feat(products): add preparation run endpoints`.

## Links

- [openapi.yaml](../contracts/openapi.yaml) — `startPreparationRun`, `getPreparationRun`
- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-06, AC-10b · [PRD §6.1](../PRD.md#61-security--privacy)
- [CONTEXT.md](../CONTEXT.md) — «запуск підготовки», «область підготовки», Sentinel errors
