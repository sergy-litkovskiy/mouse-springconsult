---
id: T57
title: "Пагінатор над таблицею каталогу"
status: Done
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1300
blocked_by: []
blocks: []
updated_at: "2026-09-23"
---

# T57 — Пагінатор над таблицею каталогу

## Context

Запит 2026-09-21, пункт 2. Пагінатор каталогу стоїть лише під таблицею
(`product-catalog.html`, `mat-paginator` після `</table>`). На сторінці з 20–50 рядками до
нього доводиться гортати. Власник просить такий самий пагінатор і над таблицею.

**Один стан, два подання.** Обидва пагінатори читають ті самі сигнали (`total`, `pageIndex`,
`pageSize`) і викликають той самий `changePage`. Другого стану сторінки не заводимо: зміна
сторінки чи розміру в одному пагінаторі одразу видна в іншому, бо обидва показують стан
запиту з URL. `MatPaginatorIntl` (`items-paginator-intl.ts`) спільний, підписи однакові.

## Sequence

Власного сценарію немає: перемикання сторінки — той самий запит `listProducts`, що й зараз.
Так само [sad.md §6](../sad.md#6-runtime-view) описує стан форми:

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Немає.** `api` і контракт не змінюються.

## API contract excerpt

```yaml
        - { $ref: "#/components/parameters/Page" }
        - { $ref: "#/components/parameters/PageSize" }
      schema: { type: integer, minimum: 1, maximum: 50, default: 20 }
```

## Acceptance criteria

Нове AC із запиту 2026-09-21; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 4 чекліста.

**AC-51 (нове) — happy path**
**Given** у каталозі карток більше, ніж на одній сторінці
**When** `user` відкриває `/products`
**Then** пагінатор є і над таблицею, і під нею, і обидва показують ту саму сторінку, розмір і загальну кількість

**AC-51 — edge case**
**Given** `user` перейшов на другу сторінку або змінив розмір сторінки у верхньому пагінаторі
**When** таблиця перезавантажилась
**Then** нижній пагінатор показує той самий стан, URL містить нову сторінку, а перезавантаження сторінки браузера відкриває той самий стан

## Checklist

1. `product-catalog.spec.ts`: тест через `MatPaginatorHarness` — на сторінці два пагінатори; перехід на наступну сторінку у верхньому змінює запит і стан нижнього.
2. `product-catalog.html`: другий `mat-paginator` над таблицею з тими самими прив'язками, що й нижній; `aria-label` у двох розрізняються («верхній» / «нижній»), щоб їх розрізняли і скрінрідер, і тести.
3. `product-catalog.css`: відступ верхнього пагінатора від таблиці; на 360 px без горизонтального скролу.
4. `PRD.md §5`: AC-51 з посиланням на цю story.
5. `pw`: знімок `/products` з двома пагінаторами, перехід сторінкою верхнього.

## Out of scope

- Липкий (`sticky`) пагінатор — не просили.
- Зміна розмірів сторінки (`pageSizeOptions`).

## DoD

- [x] AC-51: два пагінатори, спільний стан.
- [x] Тести `web` зелені, `lint` зелений, `pw` пройдено.
- [x] Коміт: `feat(web): add a paginator above the catalog table`.

## Links

- [T22](integrate-catalog-with-form-and-delete.md) — каталог · [openapi.yaml](../contracts/openapi.yaml) — `listProducts`
- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 10–15
