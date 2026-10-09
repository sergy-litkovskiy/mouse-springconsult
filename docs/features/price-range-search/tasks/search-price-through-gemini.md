---
id: T112
title: "Запуск price через Gemini: три невдачі без повтору, інваріант вилки, worker"
status: Done
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2400
blocked_by: [T107, T108, T109, T111, T120]
blocks: [T113, T115]
updated_at: "2026-10-09"
---

# T112 — Запуск price через Gemini: три невдачі без повтору, інваріант вилки, worker

## Context

Серце фічі в `worker`. `PreparationService` отримує `GeminiAdapter` конструктором поруч з
Anthropic ([ADR 0020](../adr/0020-search-price-ranges-through-gemini-in-the-ai-module.md) №2)
і в гілці `price` шукає вилку за парою з payload ([T111](start-price-run-from-draft.md)).
Збережених назви й опису він не читає ніколи. Картку читає лише заради ключів кадрів, коли
`config.ai.priceSearch.maxFrames` > 0 ([events.md](../contracts/events.md), Payload).

Кожну відмову сервіс класифікує сам і закриває запуск `failed` **без throw**: pg-boss не
повторює задачу, тож на запуск іде рівно один запит до Google
([ADR 0023](../adr/0023-classify-price-search-failures-and-never-retry-them.md)). Виняток
кидають лише помилки поза викликом Gemini, тобто R2 і БД, як і раніше.

`worker` стартує й без ключа Gemini. Тоді адаптер не створюється, а гілка ціни лишається тією,
що зробила [T107](remove-anthropic-price-search.md): `price_unavailable` без запиту
([sad.md §7](../sad.md#7-deployment-view)).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарії 1, 3 і 4:

> `worker->>gemini: generateContent + googleSearch за назвою й описом (до 3 кадрів — за підсумком заміру)`
> `worker->>worker: zod-розбір, 1–5 оголошень http/https, priceFrom ≤ priceTo, обидві > 0`
> `worker->>pg: finishRun succeeded: upsert product_field_suggestions (price: від, до, listings)`
> `worker->>pg: finishRun failed price_not_found, без пропозицій`
> `Note over worker,pg: задача не кидає виняток — pg-boss не повторює, пропозиція price не пишеться, попередня вилка лишається`

## Data delta

| Колонка | Що пише запуск `price` |
|---|---|
| `product_field_suggestions.value` (`price`) | `{priceFrom, priceTo, listings}` **лише** на успіху; upsert переписує `created_at` |
| `product_preparation_runs.error_code` | `price_not_found` · `price_quota_exhausted` · `price_unavailable` |
| `input_tokens`, `output_tokens` | не змінюються: Gemini `recordUsage` не кличе ([ADR 0025](../adr/0025-keep-gemini-calls-out-of-the-token-ledger.md)) |

## API contract excerpt

```yaml
            - `price_not_found` — відповідь не розібралась як вилка: немає 1–5 оголошень з
              адресою `http(s)` до 2048 символів, межі не додатні, або `priceFrom > priceTo`
              (AC-10).
            - `price_quota_exhausted` — Gemini відповів 429 з ознакою добової квоти (AC-09).
          description: Для `price` завжди 0; токени Gemini лише в лозі `worker` (ADR 0025)
```

## Acceptance criteria

**AC-08** (US-06) — відмова зовнішнього сервісу, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** user запустив пошук ціни
**When** Gemini недоступний, відповів помилкою чи не відповів до `timeoutMs`
**Then** запуск закрито `price_unavailable` без throw, попередня пропозиція `price` і поля картки лишаються

**AC-10** (US-06) — domain invariant
**Given** відповідь розібралась, але `priceFrom > priceTo` або межа дорівнює нулю
**When** сервіс перевіряє інваріант вилки
**Then** запуск закрито `price_not_found`, пропозиція `price` не пишеться

**AC-01** (US-01) — happy path
**Given** у payload є пара, а Gemini повернув вилку з 1–5 оголошеннями
**When** сервіс завершує запуск
**Then** пропозиція `price` з оголошеннями записана, запуск `succeeded`, а токени запуску лишились 0

## Checklist

1. `PreparationJob` в `ai/PreparationService.ts`: гілка `price` несе `title` і `description`, як `PreparationRunJob` з T111.
2. Конструктор `PreparationService` отримує `GeminiAdapter | null`. `null` означає ту саму гілку `price_unavailable`, що й зараз.
3. Гілка `price`: виклик адаптера з парою й до `maxFrames` кадрів (головний першим, як для текстів). Результат адаптера переводиться в код за [ADR 0023](../adr/0023-classify-price-search-failures-and-never-retry-them.md) №2–4.
4. Інваріант вилки в сервісі: обидві межі > 0 і `priceFrom ≤ priceTo`. Ціни оголошень у межах вилки бути не мусять ([api-sync-report.md](../contracts/api-sync-report.md), рішення 2).
5. Жодного `recordUsage` для Gemini. Рядок у pino-лог: `runId`, модель, код результату, `webSearchQueries`, токени. Пари `title`/`description` і ключа в лозі немає ([events.md](../contracts/events.md), «Спостережуваність»).
6. `src/worker.ts`: `GeminiAdapter` створюється лише з `env.GEMINI_API_KEY`. Без ключа — `warn` «GEMINI_API_KEY is not set» на старті, і `worker` працює далі.
7. `PreparationService.spec.ts` з тестовим підкласом `GeminiAdapter` (правило 8 `apps/api/CLAUDE.md`): мережа, 500, 429 з `PerDay` і без, «не розібралось», `priceFrom > priceTo`, нуль, успіх, адаптер `null`. У кожному випадку перевіряється код запуску, незмінна попередня пропозиція `price`, те, що `prepare` не кидає виняток, і рівно один виклик адаптера ([sad.md §10](../sad.md#10-quality-requirements), QG-1 «How verify»).

## Out of scope

- Ціна всередині `both` ([T113](search-price-after-texts-in-both.md)). До неї `both` лишається з гілкою `price_unavailable`.
- Тексти повідомлень у формі ([T115](enable-find-price-button.md)).

## DoD

- [x] Жодна відмова Gemini не дає `retry` у pg-boss: перевірено тестом на кожен код.
- [x] `worker` стартує без `GEMINI_API_KEY`, а з ним створює адаптер: перевірено локальним стеком.
- [x] Ключ Gemini й пара з чернетки не потрапляють у лог.
- [x] `typecheck` · `lint` · `test` · `deps:check` зелені.
- [x] Коміт: `feat(ai): search the price range through Gemini`.

## Links

- [ADR 0023](../adr/0023-classify-price-search-failures-and-never-retry-them.md) · [ADR 0025](../adr/0025-keep-gemini-calls-out-of-the-token-ledger.md) · [events.md](../contracts/events.md), «Результат спроби»
- [sad.md §8](../sad.md#8-crosscutting-concepts), «Повтори зовнішнього пошуку» · [CONTEXT.md](../CONTEXT.md), Invariants
