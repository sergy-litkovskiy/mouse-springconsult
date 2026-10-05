---
id: T97
title: "Запуск пам'ятає кількість пошуків, а вартість картки їх враховує"
status: Blocked
delivery: 4
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1700
blocked_by: [T94, T96]
blocks: [T98]
updated_at: "2026-10-05"
---

# T97 — Запуск пам'ятає кількість пошуків, а вартість картки їх враховує

## Context

Web search коштує $10 за 1000 запитів ([ADR 0018](../../../adr/0018-use-sonnet-5-for-card-preparation.md)),
тобто 10 000 µ$ за пошук. При `max_uses: 2` це $0,02 на запуск, порівнянно з усіма текстами
картки. Проте `product_preparation_runs` пам'ятає лише токени, а адаптер не читає
`usage.server_tool_use.web_search_requests`. Тож [T94](add-card-cost-in-usd.md) рахує вартість
без пошуків, і саме для ціни сума буде занижена.

**Нероздільна за деплоєм зміна.** Міграція, entity, тип `Usage` адаптера, `recordUsage` і сума
T94 — одна story. Колонка без запису лишилась би нулем, а запис без колонки впав би на
`insert`.

**Старі рядки.** `default 0` дає нуль і запускам `scope: price` з вересня, які справді шукали.
Відновити їх нічим: кількість пошуків тоді не записувалась. Це кілька рядків розробки, тож
вартість цих карток лишається заниженою, а не `null`. Різницю видно з дати запуску.

**Залежність від T96.** Якщо замір T96 дасть no-go, пошук ціни не повернеться, і колонка
стане зайвою. Тому задача стоїть за рішенням, а не поруч із T94.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 8. Запис пошуків — частина цього кроку:

> `worker->>pg: пише пропозицію ціни з діапазоном і usage виклику`

Читання суми — сценарій 9:

> `api->>pg: читає поля картки й одну пропозицію на поле`

## Data delta

| Що | Зміна |
|---|---|
| `product_preparation_runs.web_search_requests` | **нова** `integer NOT NULL DEFAULT 0`, `CHECK (web_search_requests >= 0)` |
| міграція | одна, з робочим `down` (`drop column`) |
| entity `PreparationRun` | поле `webSearchRequests` |
| читання вартості | `group by model` з T94 сумує ще й `web_search_requests` |
| [data-model.md](../data-model.md) | рядок колонки в таблиці `product_preparation_runs` |

## API contract excerpt

```yaml
    PreparationRun:
      required: [id, productId, scope, status, model, inputTokens, outputTokens, createdAt]
        inputTokens: { type: integer, minimum: 0 }
        outputTokens: { type: integer, minimum: 0 }
```

Контракт не змінюється: кількість пошуків потрапляє назовні лише всередині
`estimatedCostUsd` (T94). Окреме поле в `PreparationRun` нікому не потрібне.

## Acceptance criteria

AC-88 нове, до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить крок 7 чекліста.

**AC-88 (US-08) — happy path**
**Given** запуск зробив два пошуки й витратив 3000/400 токенів `claude-sonnet-5`
**When** `user` відкриває картку
**Then** `estimatedCostUsd` дорівнює `"0.0300"`: (3000 × 2 + 400 × 10 + 2 × 10 000) µ$

**AC-88 — edge case**
**Given** запуск без `web_search` (`texts` чи `field`)
**When** `worker` записує `usage`
**Then** `web_search_requests` дорівнює 0, а вартість картки така сама, як до цієї задачі

## Checklist

1. `apps/api/db/migrations/<timestamp>-add-web-search-requests.ts`: колонка з `CHECK` і `down`.
2. `PreparationRun.ts`: `webSearchRequests`.
3. `AnthropicAdapter.spec.ts`: `usage` результату несе `webSearchRequests` з `server_tool_use.web_search_requests`, 0, коли поля немає.
4. `AnthropicAdapter.ts`: тип `Usage` і мапінг відповіді.
5. `PreparationRepository.spec.ts` проти реальної бази: `recordUsage` додає пошуки; сума по моделях повертає їх.
6. `PreparationRepository.ts` і функція вартості T94: тариф пошуку в `config.ai.pricing`, пошуки входять у суму.
7. `data-model.md` (рядок колонки) і `PRD.md §5` (AC-88).

## Out of scope

- Відновлення пошуків старих запусків: даних немає.
- Будь-яка правка пошуку ціни — [T98](make-price-lookup-fail-loudly.md), [T99](find-price-from-generated-texts.md).

## DoD

- [ ] AC-88: обидва випадки покрито тестами.
- [ ] Міграція вниз і вгору в локальному контейнері, на копії бази з даними, лише з `--no-deps`.
- [ ] Тести `api` зелені, `typecheck`, `lint`, `deps:check` зелені.
- [ ] Коміт: `feat(ai): record web searches per preparation run`.

## Links

- [T94](add-card-cost-in-usd.md) — вартість у доларах · [T96](decide-price-range-in-generate-all.md) — go/no-go
- [ADR 0018](../../../adr/0018-use-sonnet-5-for-card-preparation.md) — тариф пошуку · [data-model.md](../data-model.md)
