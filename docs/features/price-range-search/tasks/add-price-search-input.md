---
id: T110
title: "priceSearchInput: пара назва + опис для пошуку ціни"
status: Done
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1600
blocked_by: [T104, T106]
blocks: [T111, T113]
updated_at: "2026-10-09"
---

# T110 — priceSearchInput: пара назва + опис для пошуку ціни

## Context

Одне правило вибору пари для обох запусків
([ADR 0021](../adr/0021-search-prices-from-the-run-input-not-the-saved-card.md) №5). `price`
кличе його в `api` з чернетки форми ([T111](start-price-run-from-draft.md)), `both` кличе у
`worker` зі щойно згенерованих текстів ([T113](search-price-after-texts-in-both.md)).

Функція живе в `products/preparation/` і виходить назовні через `products/index.ts`. `ai` уже
імпортує з `products`, тож нової стрілки між модулями немає
([sad.md §5](../sad.md#5-building-block-view)). `draftPlainText` лежить у сусідній підфічі
`products/description/`, а підпапки одного модуля імпортують одна одну вільно (правило 9
`apps/api/CLAUDE.md`). Імена пари — `title` і `description`, як у
[events.md](../contracts/events.md) (Section C закрито в
[T103](align-documents-with-price-search-architecture.md)).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарії 1 і 2, обидва місця виклику:

> `api->>api: priceSearchInput — пара Prom, інакше OLX, draftPlainText, обрізання`
> `worker->>worker: priceSearchInput зі щойно згенерованих titleProm / descriptionProm`

## Data delta

**Немає.** Чиста функція бази не бачить. Від її результату залежить
`product_preparation_runs.idempotency_key` запуску `price`, бо ключ рахується з обраної пари
([data-model.md](../data-model.md)), але рахує його [T111](start-price-run-from-draft.md).

## API contract excerpt

```yaml
      description: >-
        пошук не читає ніколи (ADR 0021). `api` обирає назву (Prom, інакше OLX) й опис
        (Prom, інакше OLX). Опис проходить `draftPlainText`, бо опис Prom — HTML
        і обидва рядки обрізаються до `config.ai.priceSearch.maxInputChars`. Якщо після цього
        бракує назви чи опису — `409`, задача не ставиться (sad.md сценарій 1, `alt`). Кадрів
```

## Acceptance criteria

**AC-01** (US-01), [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** є хоча б одна назва й хоча б один опис з будь-якого майданчика, наприклад назва лише OLX і опис лише Prom
**When** функція обирає пару
**Then** назва — Prom, інакше OLX, опис — Prom, інакше OLX; HTML опису перетворено на текст, обидва рядки обрізано

**AC-02** (US-01) — error
**Given** немає жодної назви або жодного опису, або опис Prom складається лише з тегів
**When** функція обирає пару
**Then** вона повертає перелік того, чого бракує (`title`, `description` чи обидва), а не пару з порожнім рядком

## Checklist

1. `products/preparation/priceSearchInput.ts`: вхід — чотири рядки (`titleProm`, `titleOlx`, `descriptionProm`, `descriptionOlx`), вихід — пара `{title, description}` або перелік відсутнього.
2. Порожність перевіряється **після** `draftPlainText` і обрізання пробілів: опис `<p></p>` — це відсутній опис.
3. Обрізання до `config.ai.priceSearch.maxInputChars` ([ADR 0021](../adr/0021-search-prices-from-the-run-input-not-the-saved-card.md) №2): payload черги несе ці рядки, тож межа обов'язкова.
4. Spec поруч: змішана пара, Prom має перевагу, опис лише з тегів, порожня назва, порожні обидва, обрізання.
5. `products/index.ts`: експорт `priceSearchInput` (і його типу результату, якщо `ai` його потребує).

## Out of scope

- Виклик у `PreparationRunService` і ключ ідемпотентності ([T111](start-price-run-from-draft.md)).
- Виклик у `worker` для `both` ([T113](search-price-after-texts-in-both.md)).

## DoD

- [x] Функція не читає ні БД, ні картку: на вході лише рядки.
- [x] `deps:check` зелений: `ai` бачить функцію лише через `products/index.ts`.
- [x] Коміт: `feat(products): pick the title and description pair for the price search`.

## Links

- [ADR 0021](../adr/0021-search-prices-from-the-run-input-not-the-saved-card.md) №2, №4, №5 · [CONTEXT.md](../CONTEXT.md), «пара пошуку»
