---
id: T113
title: "Запуск both: вилка після текстів за щойно згенерованими назвою й описом"
status: Done
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1800
blocked_by: [T110, T112]
blocks: [T116, T117]
updated_at: "2026-10-09"
---

# T113 — Запуск both: вилка після текстів за щойно згенерованими назвою й описом

## Context

«Згенерувати все» має знайти й вилку, але **після** текстів і за тими назвою й описом, які щойно
повернув Claude, ще до їх збереження в картку
([ADR 0021](../adr/0021-search-prices-from-the-run-input-not-the-saved-card.md) №4). Payload
`both` не змінюється: пара береться з результату текстів того самого запуску через
[`priceSearchInput`](add-price-search-input.md).

Тексти вже оплачено, тож за будь-якої відмови пошуку вони лишаються пропозиціями (AC-04), а
запуск закривається кодом ціни. Запуск `both` лишається з моделлю й токенами Claude: поле
`model` означає «модель текстів»
([ADR 0025](../adr/0025-keep-gemini-calls-out-of-the-token-ledger.md) №2, Neutral).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарії 2 і 3:

> `worker->>pg: recordUsage — токени Claude у запуск`
> `worker->>worker: priceSearchInput зі щойно згенерованих titleProm / descriptionProm`
> `worker->>pg: finishRun succeeded: тексти й price однією транзакцією`
> `worker->>pg: finishRun failed price_quota_exhausted + пропозиції текстів`
> `worker->>pg: finishRun failed price_unavailable + пропозиції текстів`

## Data delta

| Колонка | Що пише запуск `both` |
|---|---|
| `product_field_suggestions` | п'ять пропозицій текстів завжди; `price` з `listings` лише на успіху; одна транзакція `finishRun` |
| `product_preparation_runs.model` | модель Claude, як і раніше |
| `input_tokens`, `output_tokens` | лише токени Claude |

Схема без змін ([data-model.md](../data-model.md)).

## API contract excerpt

```yaml
        scope:
          type: string
          enum: [texts, both]
          description: >-
            `both` після текстів шукає вилку за щойно згенерованими назвою й описом, ще до
            їх збереження (AC-03).
            Лише при `status: failed` (ADR 0023). Для `both` перші три означають, що тексти
            записано пропозиціями, а ціни немає — пошук окремо запускає `scope: price`
```

## Acceptance criteria

**AC-03** (US-02) — cross-context, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** user запустив «Згенерувати все», а збережена картка порожня
**When** тексти підготовлено
**Then** пошук вилки йде лише після текстів і за щойно згенерованими назвою й описом (Prom пріоритетно)

**AC-04** (US-02) — відмова зовнішнього сервісу, часткова
**Given** «Згенерувати все» підготувало тексти
**When** пошук вилки не пройшов: недоступний, квота чи вилку не знайдено
**Then** тексти збережено пропозиціями, запуск закрито кодом ціни, пропозиція `price` не пишеться

**AC-09** (US-06)
**Given** денну квоту пошуку вичерпано
**When** user запускає «Згенерувати все»
**Then** тексти на місці, а запуск закрито `price_quota_exhausted`, а не `price_unavailable`

## Checklist

1. `PreparationService`, гілка `both`: після `generateTexts` і `recordUsage` скласти пару через `priceSearchInput` з `titleProm`/`titleOlx`/`descriptionProm`/`descriptionOlx` результату (після `singleLineTitle`, як пишуться пропозиції).
2. Порожня пара, коли модель не дала ні назви, ні опису: джерела про цей випадок мовчать. Найближчий код — `price_not_found` з текстами без виклику Gemini; якщо власник вирішить інакше, це правка цього пункту, а не здогад у коді.
3. Пошук і класифікація відмов — той самий приватний шлях, що й у [T112](search-price-through-gemini.md), без дублювання.
4. Одна транзакція `finishRun` для текстів і `price` на успіху. На відмові ті самі тексти йдуть з кодом ціни.
5. `PreparationService.spec.ts`: збережена картка порожня, а пара взята з текстів; три відмови зберігають п'ять пропозицій текстів; `recordUsage` кличеться рівно раз і лише з токенами Claude; виклик Gemini після виклику Claude.

## Out of scope

- Перемикання «Згенерувати все» у формі з `texts` на `both` ([T116](generate-all-with-price.md)).

## DoD

- [x] Тексти `both` не губляться за жодного з трьох кодів: перевірено тестом.
- [x] Тести без мережі: обидва адаптери підмінені підкласами.
- [x] `typecheck` · `lint` · `test` · `deps:check` зелені.
- [x] Коміт: `feat(ai): search the price range after the texts in generate all`.

## Links

- [ADR 0021](../adr/0021-search-prices-from-the-run-input-not-the-saved-card.md) №4 · [ADR 0023](../adr/0023-classify-price-search-failures-and-never-retry-them.md) №5 · [ADR 0025](../adr/0025-keep-gemini-calls-out-of-the-token-ledger.md) №2
