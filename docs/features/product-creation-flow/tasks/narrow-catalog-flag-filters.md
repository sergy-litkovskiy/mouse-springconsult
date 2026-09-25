---
id: T60
title: "Вужчі фільтри-прапорці в панелі каталогу"
status: Done
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1400
blocked_by: []
blocks: [T62]
updated_at: "2026-09-25"
---

# T60 — Вужчі фільтри-прапорці в панелі каталогу

## Context

Запит 2026-09-21, пункт 5. Три фільтри з варіантами «Всі / Так / Ні» — «Опубл. на Prom»,
«Опубл. на OLX» і «Картка готова» — мають модифікатор `.filters__field--narrow`
(`flex: 0 1 10.5rem`, `product-catalog.css`). Значення в них коротке, а поле займає місце, якого
бракує текстовим фільтрам. Власник просить зробити їх вужчими.

**Межа — мітка.** Коментар у CSS пояснює, чому 10.5rem: на 6.5rem плаваюча мітка обрізалась.
Мітки T36 з того часу скоротились («Опубл. на Prom»), тож ширину виводимо з найдовшої мітки
цих трьох полів, а не зі старого числа. Для них — окремий модифікатор (наприклад,
`.filters__field--flag`), бо `--narrow` можуть використовувати інші поля; коментар над правилом
оновити. `min-width: max-content` не допомагає: інфікс Material має фіксовану ширину (див.
коментар у файлі).

## Sequence

Власного сценарію немає: це верстка панелі, запит не змінюється. Так само
[sad.md §6](../sad.md#6-runtime-view) описує стан форми:

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Немає.** Правка торкається лише `product-catalog.css`, класів у `product-catalog.html` і правила
вирізу рамки для цих полів у `styles.css`.

## API contract excerpt

Три поля — прапорці `listProducts`; задача змінює їхню ширину, а не склад:

```yaml
    PublishedProm:
      name: publishedProm
      name: publishedOlx
    ReadyFilter:
      name: ready
      schema: { type: boolean }
```

## Acceptance criteria

Нове AC із запиту 2026-09-21; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 4 чекліста.

**AC-54 (нове) — happy path**
**Given** `user` відкриває `/products` на екрані шириною 1280 px
**When** панель фільтрів відмальована
**Then** три поля-прапорці вужчі, ніж 10.5rem (168 px)

**AC-54 — edge case**
**Given** у полі-прапорці обрано «Так» і мітка плаває над рамкою, або поле без вибору
**When** `user` дивиться на поле на 1280 і 360 px
**Then** мітка не обрізана й не накладається на рамку, стрілка `mat-select` видна, а на 360 px горизонтального скролу немає

## Checklist

1. `product-catalog.css`: модифікатор для трьох полів-прапорців з шириною під найдовшу мітку; коментар над правилом оновити під нове число й причину.
2. `product-catalog.html`: три поля отримують новий модифікатор замість `--narrow`, якщо `--narrow` лишається потрібним іншим полям; якщо ні — правити сам `--narrow`.
3. `pw`: знімки `/products` на 1280 і 360 px, ширина полів (`getBoundingClientRect().width`) і `scrollWidth <= clientWidth` на 360 px — у PR.
4. `PRD.md §5`: AC-54 з посиланням на цю story.

## Out of scope

- Ширина текстових фільтрів і категорії — категорію перебудовує [T62](pick-catalog-categories-with-autocomplete.md).
- Підписи варіантів — закриті в [T36](relabel-published-filter-options.md).

## DoD

- [x] AC-54: поля-прапорці вужчі за 168 px, мітки цілі на 1280 і 360 px.
- [x] Наявні тести `web` зелені, `lint` зелений.
- [x] Коміт: `style(web): narrow the catalog flag filters`.

## Links

- [T37](resize-catalog-filter-fields.md) — ширина фільтрів · [T40](compact-catalog-filter-fields.md) — висота фільтрів
- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 10–15 · [openapi.yaml](../contracts/openapi.yaml) — `listProducts`
