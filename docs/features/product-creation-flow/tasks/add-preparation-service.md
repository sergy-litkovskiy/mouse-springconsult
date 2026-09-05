---
id: T28
title: "Сервіс підготовки: тексти, діапазон ціни, запис usage"
status: Blocked
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1700
blocked_by: [T26, T27]
blocks: [T29]
updated_at: "2026-09-05"
---

# T28 — Сервіс підготовки: тексти, діапазон ціни, запис `usage`

## Context

Обробник задачі, який виконується у `worker`. Робить те, заради чого написана вся фіча:
одним запуском готує опис під Prom із ключовими словами, опис під OLX і орієнтовний
діапазон ціни (US-03, US-04).

Ключова властивість — **кожен результат є окремим записом**
([ADR 0006](../adr/0006-store-generated-values-as-separate-suggestions.md)). Саме тому
часткова відмова не втрачає нічого зі здобутого.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 5** — цілком, це і є контракт задачі:

> `worker->>anthropic: просить тексти під обидва майданчики`
> `worker->>pg: пише пропозиції текстів і usage виклику`
> `worker->>anthropic: просить діапазон ринкових цін`
> `anthropic--xworker: сервіс відповів помилкою`
> `worker->>pg: позначає цінову частину невиконаною`

Плюс **сценарій 7** (тексти) і **8** (ціна) як окремі області.

## Data delta

| Таблиця | Зміна |
|---|---|
| `product_preparation_runs` | +1 рядок на запуск; `status` `queued` → `running` → `succeeded`/`failed`; `model`, `input_tokens`, `output_tokens` на кожен виклик |
| `product_field_suggestions` | +1 рядок **на кожне поле**: `description_prom`, `description_olx`, `seo_keywords`, `price` — окремими записами |
| `products` | **не змінюється жодним рядком** — модель ніколи не пише в картку ([ADR 0006](../adr/0006-store-generated-values-as-separate-suggestions.md)) |

## API contract excerpt

```yaml
        field:
          type: string
          enum: [descriptionProm, descriptionOlx, seoKeywords, price]
        value:
          description: >-
            Рядок для description*, масив рядків для seoKeywords,
            {priceFrom, priceTo} для price (десяткові рядки).
```

## Acceptance criteria

**AC-05** (US-03) — happy path
**Given** у картці є принаймні один кадр і внесено результат розпізнавання
**When** `user` запускає підготовку текстів
**Then** система зберігає опис під Prom, ключові слова під Prom і опис під OLX і показує їх для правки

**AC-10b** (US-03, US-04) — часткова відмова
**Given** підготовка повернула тексти, але не повернула діапазон ціни
**When** `user` відкриває картку
**Then** тексти лишаються пропозиціями, ціни немає, і її можна запросити окремо

## Checklist

1. Репозиторій запусків і пропозицій у `modules/products/` — вставка запуску, зміна статусу, вставка пропозицій, сума токенів на картку.
2. Сервіс у `modules/ai/` — бере задачу, тягне до 3 кадрів, кличе адаптер по тексти, пише пропозиції й `usage`, потім кличе по ціну, пише окремо.
3. Обробка часткової відмови — за рішенням №5 з [T24](close-preparation-open-items.md).
4. `src/worker.ts` — реєстрація обробника.
5. `contracts/events.md` — тепер має предмет: producer, consumer, retry, поведінка після вичерпаного `retryLimit`.
6. `*.spec.ts` — двійники адаптера як підкласи з `override`: успіх обох викликів, відмова цінового, відмова обох.

## Out of scope

- HTTP-маршрути — [T29](add-preparation-run-endpoints.md). Сервіс про HTTP не знає.
- Прийняття пропозицій у поля картки — [T30](add-suggestion-resolution-endpoints.md).
- Стеля вартості в грошах — відкрите питання; тут лише токени.

## DoD

- [ ] AC-05: запуск дає опис під Prom, ключові слова й опис під OLX — **трьома окремими записами**, не одним.
- [ ] AC-08: ціна приходить діапазоном «від — до» і зберігається як орієнтир.
- [ ] AC-10b: коли ціновий виклик падає, тексти лишаються пропозиціями — тест на двійнику.
- [ ] AC-14: `model`, `input_tokens`, `output_tokens` записані для **кожного** виклику, не для запуску загалом.
- [ ] Модель не пише в `products` у жодній гілці — перевірено тестом, не оком.
- [ ] `events.md` створено й описує реальну задачу, а не намір.
- [ ] Коміт: `feat(ai): add the card preparation service`.

## Links

- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-05, AC-08, AC-10, AC-10b, AC-14
- [ADR 0006](../adr/0006-store-generated-values-as-separate-suggestions.md) · [sad.md §6](../sad.md#6-runtime-view), сценарії 5, 7, 8
- [CONTEXT.md](../CONTEXT.md) — «пропозиція», «область підготовки», «вартість картки»
