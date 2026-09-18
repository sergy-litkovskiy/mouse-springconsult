---
id: T29
title: "Запуск підготовки, гейт AC-06, обмеження частоти, полінг"
status: Blocked
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2400
blocked_by: [T28]
blocks: [T30, T32]
updated_at: "2026-09-13"
---

# T29 — Запуск підготовки, гейти AC-06/AC-27, обмеження частоти, полінг

## Context

HTTP-межа поставки 2. Запит не чекає на модель: він перевіряє вхід, ставить задачу й
відповідає — генерація триває десятки секунд, тож фронт питає стан у циклі.

Чотири речі, які цей маршрут тримає й через які його не можна звести до «поставити задачу»:
гейт AC-06 (`texts`/`both` — потрібен хоч один кадр), гейт AC-27 (`price` — потрібен хоч один
заголовок, `titleProm` або `titleOlx`; опис сам по собі входом не є), обмеження частоти
(запуски — це прямі гроші, [PRD §6.1](../PRD.md#61-security--privacy)) і ідемпотентність, яку
**рахує сервер, а не заголовок клієнта**.

**Уточнення 2026-09-13 (AC-27).** Для `scope: price` маршрут лише перевіряє, що заголовок є
(`titleProm` або `titleOlx`) — сам запит до моделі з заголовка і, якщо він є, опису складає
`worker` при виконанні задачі ([T28](add-preparation-service.md)), так само як `worker`, а не
маршрут, читає кадри для `texts`/`both`. Формула — в [sad.md §6](../sad.md#6-runtime-view),
сценарій 8. Без жодного заголовка запит не має з чого будуватись, і той самий код
`preparation_input_incomplete`, яким AC-06 відмовляє за порожню галерею, відмовляє тепер і
тут — лише `details.missing` різний (`["gallery"]` проти `["title"]`).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 7** — гейт AC-06 перед постановкою задачі:

> `api->>pg: перевіряє, що є кадр (AC-06)`
> `api->>pg: ставить задачу підготовки`
> `api-->>web: задачу прийнято`

та **сценарій 8** — окремий запуск самої лише ціни, з дзеркальним гейтом AC-27 (маршрут лише
перевіряє наявність заголовка — сам запит до моделі складає `worker`, [T28](add-preparation-service.md)):

> `api->>pg: перевіряє titleProm/titleOlx картки`
> `api-->>web: preparation_input_incomplete, details.missing: [title] (AC-27)`

## Data delta

| Таблиця | Зміна |
|---|---|
| `product_preparation_runs` | +1 рядок зі `status: queued`; `idempotency_key` рахує **сервер** із (картка, область, версія входу) |
| `product_preparation_runs_idempotency_key_key` | UNIQUE — повторний запуск того самого входу **не створює другого рядка**, а повертає наявний |
| `created_at` | він же вхід обмеження частоти ([data-model.md](../data-model.md)) — окремої таблиці лічильника немає |

## API contract excerpt

```yaml
        "409":
          description: >-
            У галереї немає жодного кадру для scope: texts/both (AC-06), або в
            картці немає ні titleProm, ні titleOlx для scope: price (AC-27) —
            два різні missing під тим самим кодом
```

## Acceptance criteria

**AC-06** (US-03) — cross-context
**Given** у картці немає жодного кадру
**When** `user` намагається запустити підготовку текстів
**Then** система не запускає підготовку і повідомляє, що бракує хоча б одного кадру

**AC-27** (US-04) — cross-context
**Given** у картці немає ні `titleProm`, ні `titleOlx`
**When** `user` (чи клієнт напряму) намагається запустити `scope: price`
**Then** система не запускає пошук і відповідає `preparation_input_incomplete`, `details.missing: ["title"]` — тим самим кодом, що й AC-06, з іншим значенням `missing`

**AC-10b** (US-03, US-04) — часткова відмова
**Given** тексти вже є, а ціни немає
**When** `user` запитує саму лише ціну
**Then** запускається `scope: price`, тексти не перезапускаються

## Checklist

1. `contracts/ai.contract.ts` — схеми запуску й стану; `scope` = `texts` | `price` | `both` | `field`; для `field` — `z.discriminatedUnion` з обов'язковими `field` і `draftText` ([ADR 0015](../adr/0015-add-per-field-text-rewrite-scope.md)).
2. `contracts/error-codes.ts` — `preparation_input_incomplete`, `preparation_rate_limited`.
3. `POST /:productId/preparation-runs` і `GET /:productId/preparation-runs/:runId` під `sessionGuard`.
4. Гейт для `scope: price` (AC-27): дешева перевірка `titleProm ?? titleOlx` — інакше `preparation_input_incomplete` з `details.missing: ["title"]`, без постановки задачі. Сам запит до моделі (title+description) маршрут не складає — це читає й формує `worker` при виконанні ([T28](add-preparation-service.md)), так само як гейт AC-06 лише рахує кадри, а не читає їх байти.
5. `src/config.ts` — вікно обмеження частоти: 20 запусків на картку за годину, спільні для всіх областей (рішення №3 [T24](close-preparation-open-items.md)).
6. Постановка задачі в чергу; HTTP-відповідь не чекає на модель.

## Out of scope

- Сам виклик моделі — [T28](add-preparation-service.md), він у `worker`.
- Прийняття пропозицій — [T30](add-suggestion-resolution-endpoints.md).

## DoD

- [ ] AC-06: картка без жодного кадру дає `preparation_input_incomplete`, `details.missing: ["gallery"]`.
- [ ] AC-27: картка без `titleProm` і без `titleOlx` дає `preparation_input_incomplete`, `details.missing: ["title"]`, для `scope: price` — задача в чергу не ставиться. Опис без заголовка сам по собі гейт не проходить.
- [ ] `scope: field` без `field` або без `draftText` відхиляється валідацією контролера — 400, а не проходить до `worker`.
- [ ] AC-10b: `scope: price` запускається окремо, не перезапускаючи текстів.
- [ ] Повторний запуск того самого входу повертає наявний запуск і `200` — перевірено проти унікального індексу, а не логікою в коді.
- [ ] Вичерпаний ліміт частоти дає `preparation_rate_limited`, а не тишу й не 500.
- [ ] `POST` відповідає, не чекаючи на модель — виміряно тривалістю запиту з pino.
- [ ] Обмеження частоти окреме від наявного на спроби входу — перевірено, що вичерпання одного не блокує другого.
- [ ] Коміт: `feat(products): add preparation run endpoints`.

## Links

- [openapi.yaml](../contracts/openapi.yaml) — `startPreparationRun`, `getPreparationRun`
- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-06, AC-10b, AC-27 · [PRD §6.1](../PRD.md#61-security--privacy)
- [sad.md §6](../sad.md#6-runtime-view), сценарії 7, 8 · [CONTEXT.md](../CONTEXT.md) — «запуск підготовки», «область підготовки», Sentinel errors
