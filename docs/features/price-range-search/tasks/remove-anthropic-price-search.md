---
id: T107
title: "Прибрати пошук ціни через Anthropic"
status: Done
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1800
blocked_by: [T106]
blocks: [T109, T112]
updated_at: "2026-10-09"
---

# T107 — Прибрати пошук ціни через Anthropic

## Context

[ADR 0020](../adr/0020-search-price-ranges-through-gemini-in-the-ai-module.md) №4 дозволяє
видаляти старий шлях лише **після** go на гейті ([T106](measure-price-search-on-ten-cards.md)),
і ця задача відкриває поставку 2.

Порядок свідомий. Поки живий `findPriceRange`, пропозицію `price` пише код, який не має
оголошень, тож розширити `PriceRange` до `listings` ([T109](add-price-listings-to-suggestion.md))
не вдалося б без зламаного typecheck. Після видалення гілки `price` і `both` у
`PreparationService` закривають запуск `failed` з `price_unavailable` без жодного запиту. Це
та сама гілка, яку [sad.md §7](../sad.md#7-deployment-view) описує для `worker` без ключа
Gemini, і [T112](search-price-through-gemini.md) лише підключає до неї адаптер.

Для user-а нічого не змінюється: кнопку ціни вимкнено (`priceLookupEnabled = false`), а
«Згенерувати все» сьогодні стартує `scope: texts`.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 3, гілка, яку задача робить єдиною до
підключення Gemini:

> `worker->>pg: finishRun failed price_unavailable + пропозиції текстів`
> `Note over worker,pg: задача не кидає виняток — pg-boss не повторює, пропозиція price не пишеться, попередня вилка лишається`

## Data delta

**Немає.** Схема й рядки не змінюються. Рядків `price` без `listings` на проді немає, у dev їх
0 (власник, 2026-10-08, [data-model.md](../data-model.md), Migrations), тож видалення
писаря старої форми нічого не осиротить.

## API contract excerpt

Код, яким тепер закриваються `price` і ціна в `both`, доки адаптера немає:

```yaml
            - `price_unavailable` — решта відмов пошуку: мережа, 5xx, таймаут, недійсний чи
              відсутній ключ, відмова моделі (AC-08).
```

## Acceptance criteria

**AC-04** (US-02), [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** запуск `both` підготував тексти
**When** пошук ціни не пройшов, а тут він ще й не підключений
**Then** тексти зберігаються пропозиціями, запуск закривається `price_unavailable`, а пропозиція `price` не пишеться

**AC-08** (US-06) — відмова зовнішнього сервісу
**Given** запущено `scope: price`
**When** пошук недоступний
**Then** усе внесене в картку й попередня пропозиція `price` лишаються, а запуск закривається `price_unavailable` без throw

## Checklist

1. `AnthropicAdapter.ts`: прибрати `findPriceRange`, `requestPrice`, `PriceSchema`, `PriceResult` і server tool `web_search_20260209`, а заразом тести ціни в `AnthropicAdapter.spec.ts`.
2. `src/config.ts`: прибрати `ai.webSearch` і `ai.effort.price`.
3. `PreparationService.ts`: прибрати `priceQuery(card)` ([ADR 0021](../adr/0021-search-prices-from-the-run-input-not-the-saved-card.md), Neutral). Гілка ціни закриває запуск `finishRun(failed, price_unavailable)` з уже готовими текстами й `errorDetail` «price search is not configured», без throw.
4. `PreparationService.spec.ts`: `price` закривається `price_unavailable` без пропозицій, `both` — з п'ятьма пропозиціями текстів. Задача не кидає виняток, а `recordUsage` кличеться лише для текстів.
5. `modules/ai/index.ts`: прибрати `PriceResult`, якщо його експортовано.
6. [ai/CLAUDE.md](../../../../apps/api/src/modules/ai/CLAUDE.md): прибрати рядок про `web_search_20260209`, який [T103](align-documents-with-price-search-architecture.md) позначив «живе до T107», а заразом і `effort`/`max_uses` ціни.

## Out of scope

- Підключення Gemini ([T112](search-price-through-gemini.md)).
- Ключ ідемпотентності `both`, який досі читає `priceQueryInput` збереженої картки ([T111](start-price-run-from-draft.md)).

## DoD

- [ ] `grep -rn 'web_search\|findPriceRange\|webSearch' apps/api/src` порожній —
      дослівно не виконується: T105 додала `GeminiAdapter.findPriceRange` і `webSearchQueries`.
      Поза `GeminiAdapter*` і `webSearchQueries` Gemini той самий grep порожній: від Anthropic
      не лишилось нічого.
- [x] `typecheck` · `lint` · `test` · `deps:check` зелені.
- [ ] Запуск `texts` поводиться як раніше: його spec не змінено — поведінка та сама, але
      тест «does not ask for a price…» втратив перевірку `adapter.priceQueries`, бо зник
      override `findPriceRange`; перевірка «немає пропозиції `price`» лишилась.
- [x] Коміт: `refactor(ai): remove the Anthropic price search`.

## Links

- [ADR 0020](../adr/0020-search-price-ranges-through-gemini-in-the-ai-module.md) №4 · [ADR 0019](../../product-creation-flow/adr/0019-keep-price-search-out-of-generate-all.md), чому старий шлях неробочий
- [sad.md §4 S1](../sad.md#4-solution-strategy) · [sad.md §7](../sad.md#7-deployment-view), `worker` без ключа
