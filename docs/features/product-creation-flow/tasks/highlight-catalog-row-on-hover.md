---
id: T56
title: "Підсвітка рядка каталогу під курсором"
status: Done
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1300
blocked_by: []
blocks: []
updated_at: "2026-09-22"
---

# T56 — Підсвітка рядка каталогу під курсором

## Context

Запит 2026-09-21 після приймання поставки 2, пункт 1. Клік по рядку каталогу відкриває форму
картки (`openForm`), але рядок цього ніяк не показує: `.catalog__row` має лише
`cursor: pointer` (`product-catalog.css`). Власник просить підсвічувати рядок під курсором.

**Колір — лише з токенів.** Підсвітка береться з `--mat-sys-*` (наприклад, шар
`--mat-sys-on-surface` з прозорістю стану hover або `--mat-sys-surface-container-high`), а не
з літерала: так вона лишається правильною в темній темі. Назви токенів звірити з документацією
Angular Material 22, а не писати з пам'яті. Текст рядка, бейдж готовності й кнопки дій мають
лишитися читабельними на підсвіченому тлі.

## Sequence

Власного сценарію немає: це верстка таблиці, запит не змінюється. Так само
[sad.md §6](../sad.md#6-runtime-view) описує стан форми:

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Немає.** Правка торкається лише `product-catalog.css`.

## API contract excerpt

Рядки таблиці — сторінка `listProducts`; задача змінює їхній вигляд, а не склад:

```yaml
      operationId: listProducts
        - { $ref: "#/components/parameters/Page" }
        - { $ref: "#/components/parameters/PageSize" }
```

## Acceptance criteria

Нове AC із запиту 2026-09-21; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 4 чекліста.

**AC-50 (нове) — happy path**
**Given** `user` відкриває `/products`, у таблиці є кілька рядків
**When** курсор наводиться на рядок
**Then** тло цього рядка змінюється, решта рядків лишається без підсвітки, а коли курсор іде з рядка, підсвітка зникає

**AC-50 — accessibility**
**Given** рядок підсвічено
**When** `user` читає його вміст
**Then** контраст тексту рядка з підсвіченим тлом не нижчий за 4.5:1, а бейдж готовності й кнопки дій видно так само, як без підсвітки

## Checklist

1. `product-catalog.css`: `.catalog__row:hover` з тлом через токен `--mat-sys-*`; назву токена звірити з документацією Material 22.
2. Перевірити контраст тексту на підсвіченому тлі (DevTools або обчислення з `getComputedStyle`) — не нижче 4.5:1.
3. `pw`: знімок `/products` з курсором над рядком; `getComputedStyle(row).backgroundColor` під курсором відрізняється від сусіднього рядка.
4. `PRD.md §5`: AC-50 з посиланням на цю story.

## Out of scope

- Підсвітка рядка з клавіатури (фокус рядка) — рядок не є елементом фокусу, власник цього не просив.
- Зміна кольору кнопок дій у рядку.

## DoD

- [x] AC-50: рядок під курсором підсвічено, контраст ≥ 4.5:1.
- [x] Наявні тести `web` зелені, `lint` зелений.
- [x] Коміт: `style(web): highlight the catalog row under the pointer`.

## Links

- [T40](compact-catalog-filter-fields.md) — попередня правка стилів каталогу через токени Material
- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 10–15 · [openapi.yaml](../contracts/openapi.yaml) — `listProducts`
