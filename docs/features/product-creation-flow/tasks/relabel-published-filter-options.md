---
id: T36
title: "Варіанти «Всі / Так / Ні» у фільтрах публікації"
status: Done
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1300
blocked_by: []
blocks: [T35]
updated_at: "2026-09-17"
---

# T36 — Варіанти «Всі / Так / Ні» у фільтрах публікації

## Context

Запит 2026-09-16: у фільтрах «Публікація Prom» і «Публікація OLX» замість «Будь-яка»,
«Опубліковані», «Не опубліковані» мають стояти «Всі», «Так», «Ні». Сама мітка поля вже
питає «чи опубліковано», тож варіанти відповідають коротко. Новий фільтр «Картка готова»
([T35](add-catalog-readiness-filter.md)) бере ту саму трійку, тому T35 іде після цієї задачі.

Змінюється лише **текст** `mat-option`. Значення `''`, `'true'`, `'false'` лишаються
тими самими, тож адреси з уже збереженими фільтрами працюють і далі.

## Sequence

Власного сценарію немає: запит до `api` не змінюється ні на символ. Той самий принцип
[sad.md §6](../sad.md#6-runtime-view) записав для стану форми картки:

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Немає.** Ні схема, ні контракт, ні значення контролів не змінюються — лише три підписи
у двох `mat-select`.

## API contract excerpt

Значення, які несуть варіанти, — ті самі булеві параметри:

```yaml
    PublishedProm:
      name: publishedProm
      in: query
      schema: { type: boolean }
    PublishedOlx:
      name: publishedOlx
```

## Acceptance criteria

Новий AC із запиту 2026-09-16; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 3 чекліста. AC-13 лишається чинним без змін.

**AC-32 (нове) — happy path**
**Given** `user` відкриває список варіантів «Публікація Prom» або «Публікація OLX»
**When** список розгорнуто
**Then** він бачить рівно три варіанти в порядку «Всі», «Так», «Ні», і «Всі» обрано, поки фільтр не задано

**AC-13** (US-07, [PRD §5](../PRD.md#5-acceptance-criteria)) — domain invariant
**Given** в адресі вже є `publishedProm=false&publishedOlx=true`
**When** каталог відкривається після цієї правки
**Then** Prom показує «Ні», OLX — «Так», і кожен фільтр і далі впливає лише на свій майданчик

## Checklist

1. `product-catalog.html`: у двох `mat-select` підписи `''` → «Всі», `true` → «Так», `false` → «Ні»; значення `value` не чіпати.
2. `product-catalog.spec.ts`: тест на текст і порядок варіантів обох select (через `MatSelectHarness`) і на відображення наявної адреси `publishedProm=false&publishedOlx=true`.
3. `PRD.md §5`: AC-32 у формі Given/When/Then з лінком на цю story.

## Out of scope

- Колонки таблиці «Prom» і «OLX» (`'Опубліковано'` / `'Ні'`) — запит стосувався лише фільтрів; якщо таблиця має говорити тією ж мовою, це окрема story.
- Ширина цих полів — [T37](resize-catalog-filter-fields.md).

## DoD

- [x] AC-32: обидва select мають варіанти «Всі», «Так», «Ні» саме в цьому порядку.
- [x] AC-13: збережена адреса з `publishedProm` / `publishedOlx` відкривається з правильними підписами; значення в запиті не змінились.
- [x] Наявні тести `product-catalog.spec.ts` лишаються зеленими.
- [x] Коміт: `fix(web): answer the published filters with all, yes and no`.

## Links

- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-13 · [openapi.yaml](../contracts/openapi.yaml) — `PublishedProm`, `PublishedOlx`
- [CONTEXT.md](../CONTEXT.md) — «published-prom», «published-olx»
