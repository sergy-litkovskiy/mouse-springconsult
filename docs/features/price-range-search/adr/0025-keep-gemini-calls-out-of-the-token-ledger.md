---
status: Accepted
owner: "Serhii"
reviewers: ["Serhii"]
updated_at: "2026-10-08"
feature_size: M
stage: "04-05"
ticket: "TBD"
---

# 0025 — Не записувати виклики Gemini в облік токенів запуску

- **Status:** Accepted
- **Date:** 2026-10-08
- **Deciders:** Serhii (Architect / Tech Lead)

## Context

Вартість картки рахується з `product_preparation_runs`: `recordUsage` пише в запуск `model`
**останнього** виклику й додає його токени, `sumTokensByModel` групує запуски за `model`, а
`estimateCostUsd` повертає `null`, щойно моделі немає в `config.ai.pricing`. Запуск `both` тепер
робить два виклики двох постачальників: тексти Claude і пошук Gemini (ADR 0020, 0021). Наївний запис
обох перетворив би `model` запуску на Gemini й порахував би токени Claude за чужим тарифом — або
зробив би вартість картки «невідомою». Пошук Gemini безкоштовний (§2 SAD).

## Decision drivers

- [CONTEXT](../../../../CONTEXT.md) «вартість картки» включає пошук ціни; на free tier він коштує $0.
- Облік вартості повернуто 2026-10-05 (T94/T95), і він має лишитися правдивим.
- `ARCHITECTURE.md`: окремої таблиці `ai_generations` немає — вартість картки є сумою по запусках.
- Обсяг: 50–100 карток на місяць; переробка обліку заради нуля доларів не окупається.

## Considered options

1. **Gemini токенів не пише.** `recordUsage` — лише для Claude; запуск `price` має `model` Gemini й
   нульові токени; `config.ai.pricing` отримує рядок Gemini з нульовим тарифом.
2. **Облік на кожен виклик.** Нова таблиця рядків `(run_id, model, input_tokens, output_tokens)`;
   вартість рахується з неї.

## Decision outcome

**Chosen: опція 1.** Вона тримає вартість картки правдивою без міграції, а опція 2 коштує
одну-дві story заради суми, яка дорівнює нулю.

1. Запуск `price` створюється з `model` = `config.ai.priceSearch.model` (id Gemini), а не з
   `config.ai.model`; токени лишаються 0.
2. Запуск `both` лишається з моделлю й токенами Claude; виклик Gemini у ньому `recordUsage` не кличе.
3. `config.ai.pricing` отримує рядок моделі Gemini з `0` µ$ на токен — `estimateCostUsd` не
   повертає `null` для картки з пошуком ціни.
4. Токени й `webSearchQueries` виклику Gemini пишуться в pino-лог воркера (`runId`, модель,
   кількість пошуків) — для діагностики квоти й заміру.

## Consequences

**Positive**

- Вартість картки лишається правдивою; `estimateCostUsd` і `sumTokensByModel` не змінюються.
- Без міграції.

**Negative**

- Токени Gemini не видно в картці — лише в логах.
- Тримається, поки пошук безкоштовний: платний рівень Gemini вимагатиме обліку на рівні виклику
  (опція 2) — тригер перегляду в §11 SAD.

**Neutral**

- `model` запуску `both` означає «модель текстів», а не «всі моделі запуску» — це варто назвати в
  коментарі сутності.

## Links

- PRD: [PRD.md](../PRD.md) §3 (без платного рівня), §6
- SAD: [sad.md](../sad.md) §4 S6, §8
- Пов'язане: [ADR 0018](../../../adr/0018-use-sonnet-5-for-card-preparation.md) — тарифи Claude в `config.ai.pricing`
