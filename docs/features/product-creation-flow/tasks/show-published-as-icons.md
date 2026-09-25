---
id: T64
title: "Відмітки публікації як іконки"
status: Done
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1300
blocked_by: []
blocks: [T65]
updated_at: "2026-09-25"
---

# T64 — Відмітки публікації як іконки

## Context

Запит 2026-09-21, пункт 8. Колонки «Prom» і «OLX» у таблиці каталогу показують текст
`Опубліковано` / `Ні` (`product-catalog.html`, `matColumnDef="publishedProm"` і
`"publishedOlx"`). Текст широкий і читається повільно. Власник просить іконки: опубліковано —
зелена `check_circle`, ні — сіра.

**Доступність і тести.** Іконка без тексту нічого не каже скрінрідеру й тестам. Кожна іконка
має `aria-label` («Опубліковано на Prom» / «Не опубліковано на Prom») і `matTooltip` з тим самим
текстом; `aria-hidden` на `mat-icon` не ставимо. Кольори — з токенів (`--mat-sys-*` або
наявна змінна успіху, якщо вона вже є у `styles.css`), сіра іконка — не світліша за
`--mat-sys-outline` (контраст ≥ 3:1 для графіки).

## Sequence

Власного сценарію немає: `publishedProm` і `publishedOlx` уже є в кожному рядку списку. Так
само [sad.md §6](../sad.md#6-runtime-view) описує маркування каталогу:

> «`isReady` уже їде в кожному рядку `ProductList.items` (`contracts/openapi.yaml`) — новий запит бекенду не потрібен»

## Data delta

**Немає.** Правка торкається `product-catalog.html` і `.css`.

## API contract excerpt

```yaml
        publishedProm: { type: boolean }
        publishedOlx: { type: boolean }
```

## Acceptance criteria

Нове AC із запиту 2026-09-21; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 4 чекліста.

**AC-58 (нове) — happy path**
**Given** картка опублікована на Prom і не опублікована на OLX
**When** `user` дивиться на її рядок у каталозі
**Then** у колонці «Prom» — зелена `check_circle`, у колонці «OLX» — сіра, тексту `Опубліковано` / `Ні` в клітинках немає

**AC-58 — accessibility**
**Given** той самий рядок
**When** `user` наводить курсор на іконку або скрінрідер читає клітинку
**Then** підказка й `aria-label` кажуть «Опубліковано на Prom» / «Не опубліковано на OLX», а сіра іконка має контраст з тлом не нижчий за 3:1

## Checklist

1. `product-catalog.spec.ts`: тест — клітинки містять `mat-icon` з очікуваним `aria-label` для обох станів і не містять тексту `Опубліковано`.
2. `product-catalog.html`: дві клітинки → `mat-icon` з `aria-label` і `matTooltip`; `MatIconModule`/`MatTooltipModule` в `imports`, якщо їх там ще немає.
3. `product-catalog.css`: колір зеленої й сірої іконки з токенів, вирівнювання по центру колонки.
4. `PRD.md §5`: AC-58 з посиланням на цю story.
5. `pw`: знімок каталогу з обома станами; `aria-label` іконок.

## Out of scope

- Зміна відміток прямо з каталогу — відмітки редагуються у формі картки.
- Фільтри «Опубл. на Prom/OLX» — їх ширину править [T60](narrow-catalog-flag-filters.md).

## DoD

- [x] AC-58: іконки замість тексту, з підказкою й `aria-label`.
- [x] Тести `web` зелені, `lint` зелений, `pw` пройдено.
- [x] Коміт: `feat(web): show the published flags as icons in the catalog`.

## Links

- [T65](edit-price-and-condition-inline.md) — править сусідні колонки тієї самої таблиці · [T42](unify-readiness-badge-colors.md) — кольори стану в каталозі
- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 10–15 · [openapi.yaml](../contracts/openapi.yaml) — `listProducts`
