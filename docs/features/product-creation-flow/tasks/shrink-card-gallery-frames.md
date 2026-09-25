---
id: T76
title: "Кадри картки 120×120"
status: Todo
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1200
blocked_by: []
blocks: []
updated_at: "2026-09-25"
---

# T76 — Кадри картки 120×120

## Context

Запит 2026-09-25. Кадри в галереї картки зараз близько 150×150 px, власник просить 120×120.

Сітка `.gallery` у `product-gallery.css` задана як `repeat(auto-fill, minmax(8rem, 1fr))`:
колонка має щонайменше 128 px і розтягується, доки ділить рядок порівну, тож у діалозі виходить
~150 px. Щоб кадр мав рівно 120 px, трек стає фіксованим: `repeat(auto-fill, 120px)`. Квадрат
тримає наявне `aspect-ratio: 1` у `.gallery__item`, а `NgOptimizedImage` у режимі `fill` бере
розмір з контейнера. Плитка «Додати фото» — теж `.gallery__item`, тож стає 120×120 разом з кадрами;
підпис і іконка в ній мають уміститися.

Мініатюри каталогу (48 px) задача не чіпає.

## Sequence

Власного сценарію немає: це верстка галереї, запити не змінюються. Так само
[sad.md §6](../sad.md#6-runtime-view) описує стан форми:

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Немає.** Правка торкається лише `product-gallery.css`.

## API contract excerpt

Кадри галереї — поле `images` картки з `getProduct`; задача змінює їхній розмір на екрані, а не склад:

```yaml
      operationId: getProduct
        images:
          type: array
          maxItems: 10
          items: { $ref: "#/components/schemas/ProductImage" }
```

## Acceptance criteria

Нове AC із запиту 2026-09-25; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 3 чекліста.

**AC-71 (нове) — happy path**
**Given** `user` відкриває на екрані шириною 1280 px картку з кількома кадрами
**When** галерея відмальована
**Then** кожен кадр і плитка «Додати фото» мають 120×120 px

**AC-71 — edge case**
**Given** та сама картка на екрані шириною 360 px
**When** галерея відмальована
**Then** кадри лишаються 120×120 px і переносяться в наступний рядок, а діалог не має горизонтального скролу

## Checklist

1. `product-gallery.css`: у `.gallery` замінити `minmax(8rem, 1fr)` на фіксований трек `120px`; `aspect-ratio` і решту правил не чіпати.
2. `pw`: картка з щонайменше двома кадрами на 1280 і 360 px — знімки галереї; `getBoundingClientRect()` кожного `.gallery__item` дає 120×120; на 360 px у діалогу `scrollWidth <= clientWidth`.
3. `PRD.md §5`: AC-71 з посиланням на цю story.

## Out of scope

- Мініатюри каталогу й переглядач кадрів.
- Розмір значка «Головний» і кнопок дій на кадрі.

## DoD

- [ ] AC-71: кадри 120×120 на обох ширинах, на 360 px скролу немає.
- [ ] Наявні тести `web` зелені, `lint` зелений.
- [ ] Коміт: `style(web): show the card gallery frames at 120 px`.

## Links

- [T75](compact-app-typography.md) — компактніший шрифт, запит того самого дня
- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 10–15 · [openapi.yaml](../contracts/openapi.yaml) — `getProduct`
