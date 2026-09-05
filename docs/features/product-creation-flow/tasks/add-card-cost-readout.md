---
id: T31
title: "Вартість картки у відповіді"
status: Blocked
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1200
blocked_by: [T11, T26]
blocks: [T32]
updated_at: "2026-09-05"
---

# T31 — Вартість картки у відповіді

## Context

AC-14 виконується сумою по таблиці запусків, а не ще одним збереженим числом
([ADR 0006](../adr/0006-store-generated-values-as-separate-suggestions.md)).

**Валюта не вводиться.** [PRD §8](../PRD.md#8-open-questions) лишає стелю вартості відкритим
питанням зі строком «після першого місяця роботи поставки 2», а колонка `model` існує саме
для того, щоб токени можна було перевести в гроші пізніше. Задача дає лічильник, не поріг.

## Sequence

Власного сценарію не має — вартість читається разом із карткою, і саме це названо в
[sad.md §6](../sad.md#6-runtime-view), сценарій 5:

> `web->>api: перечитує картку`
> `api-->>web: тексти є пропозиціями, ціни немає`

Той самий крок віддає й суму токенів.

## Data delta

| Що | Зміна |
|---|---|
| схема | **не змінюється** — колонки `input_tokens`, `output_tokens` створив [T26](add-preparation-tables-migration.md) |
| читання | `sum(input_tokens)`, `sum(output_tokens)` по `product_preparation_runs` картки, **одним запитом** |
| індекс | `product_preparation_runs_product_id_idx` обслуговує цю суму ([data-model.md](../data-model.md)) |

## API contract excerpt

```yaml
        totalInputTokens:
          type: integer
          minimum: 0
        totalOutputTokens: { type: integer, minimum: 0 }
```

Валюти в схемі немає — і не буде, поки [PRD §8](../PRD.md#8-open-questions) не закрито.

## Acceptance criteria

**AC-14** (US-08) — happy path
**Given** `user` завершив підготовку картки
**When** `user` відкриває картку
**Then** система показує вартість картки — суму витрат на всі виконані для неї підготовки

**AC ([sad.md §12](../sad.md#12-glossary), «вартість картки»)**
**Given** картка не мала жодного запуску
**When** `user` її відкриває
**Then** показані нулі, а не порожнє поле: «витрат не було» і «невідомо» — різні речі

## Checklist

1. `products.contract.ts` — `totalInputTokens`, `totalOutputTokens` у відповіді картки.
2. Репозиторій — сума по `product_preparation_runs` картки одним запитом.
3. Контролер — поля у DTO.

## Out of scope

- Переведення токенів у гроші й будь-який поріг — відкрите питання, не задача.
- Місячний рахунок за AI — це не вартість картки.

## DoD

- [ ] AC-14: картка після двох запусків показує суму по **обох**, не по останньому.
- [ ] Картка без жодного запуску показує нулі, а не `null`.
- [ ] Сума рахується одним запитом, а не циклом у сервісі.
- [ ] Жодної валюти й жодного порогу в коді.
- [ ] Коміт: `feat(products): expose the card preparation cost in tokens`.

## Links

- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-14 · [PRD §8](../PRD.md#8-open-questions)
- [data-model.md](../data-model.md) · [sad.md §12](../sad.md#12-glossary)
- [CONTEXT.md](../CONTEXT.md) — «вартість картки»
