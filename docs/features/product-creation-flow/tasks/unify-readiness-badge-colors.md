---
id: T42
title: "Однакові кольори бейджа готовності"
status: Done
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1700
blocked_by: [T41]
blocks: [T25]
updated_at: "2026-09-17"
---

# T42 — Однакові кольори бейджа готовності

## Context

Запит 2026-09-17, UI-доопрацювання до поставки 2. Бейдж «Готово» / «Неготово» має
виглядати однаково в каталозі й у відкритій картці. Взірцем слугує бейдж у діалозі картки.
Сьогодні ці два бейджі розходяться:

| Стан | `product-form.css` (взірець) | `product-catalog.css` |
|---|---|---|
| Готово | `primary-container` / `on-primary-container` | те саме |
| Неготово | `surface-container-high` / `on-surface-variant` | `error-container` / `on-error-container` |

Правила `.readiness*` продубльовано у двох компонентах, і через це кольори розійшлися. Тому
кольори переносяться в один глобальний набір у `apps/web/src/styles.css`, а компоненти свої
копії втрачають. Окремого файлу чи каталогу під це не заводимо (правила 11–12
`apps/web/CLAUDE.md`). Класи `readiness`, `readiness--ready`, `readiness--not-ready` і
`data-testid="readiness"` не змінюються, бо на них спираються наявні тести.

Задача йде після [T41](fix-product-form-field-sizing.md), бо обидві правлять `product-form.css`.

## Sequence

Власного сценарію немає. [sad.md §6](../sad.md#6-runtime-view), «Маркування в таблиці каталогу»:

> «Каталог малює бейдж («Готово» / «Неготово», колір за станом) поруч із рядком»

## Data delta

**Немає.** Колір рахується з `isReady`, який уже є у відповіді.

## API contract excerpt

```yaml
        isReady:
          type: boolean
          description: >-
            Похідне поле, не колонка: обидва заголовки й обидва описи непорожні, price > 0,
```

## Acceptance criteria

**AC-39 (нове) — happy path**
**Given** у каталозі є готова й неготова картки
**When** `user` порівнює бейдж у рядку таблиці з бейджем у заголовку відкритої картки
**Then** «Неготово» в обох місцях має фон `surface-container-high` і текст `on-surface-variant`, а «Готово» — фон `primary-container` і текст `on-primary-container`

**AC-39 — edge case**
**Given** застосунок у темній темі або неготова картка з підказкою прогалин
**When** бейдж відмальовано
**Then** кольори однакові в обох місцях і в темній темі, а підказка «Бракує: …» над бейджем працює як раніше

## Checklist

1. `styles.css`: `.readiness--ready` і `.readiness--not-ready` з кольорами взірця. Спільну форму `.readiness` (відступи, радіус) перенести теж, якщо вона збігається.
2. `product-catalog.css` і `product-form.css`: прибрати дублікати кольорів. Відмінності розміру шрифту, якщо лишаються, записати в PR.
3. `product-form.html`: додати `[class.readiness--not-ready]="!ready()"`, щоб обидва місця вживали той самий клас.
4. `pw`: знімки бейджа в каталозі й у формі для обох станів, обчислені `background-color` і `color` збігаються.
5. `PRD.md §5`: AC-39 з посиланням на цю story.

## Out of scope

- Текст і логіка готовності — [T39](name-missing-fields-in-product-form.md), [ADR 0009](../adr/0009-derive-card-readiness-instead-of-storing-it.md).
- Розмір шрифту бейджа: таблиця щільніша за заголовок діалогу, і вирівнювати його не просили.

## DoD

- [x] AC-39: обчислені кольори бейджа однакові в каталозі й у формі для обох станів.
- [x] Наявні тести `web` зелені, `lint` зелений.
- [x] Коміт: `style(web): share the readiness badge colors`.

Результат 2026-09-17 (для опису PR):
- У `styles.css` перенесено лише кольори `.readiness--ready` і `.readiness--not-ready`. Форма бейджа лишилась у компонентах, бо відрізняється: у формі є іконка, `label-large` і радіус 999px, у таблиці — `label-medium`. З базових `.readiness` компонентів кольори прибрано: правило зі скоупом Angular має вищу специфічність і перекрило б глобальний модифікатор.
- `pw`: «Неготово» в обох місцях — `rgb(233, 231, 235)` / `rgb(68, 71, 78)`, «Готово» — `rgb(215, 227, 255)` / `rgb(0, 69, 143)`. Готової картки в даних не було, тож клас «Готово» перевірено підміною класу на живому елементі.
- Темної теми застосунок не має (`color-scheme: light` у `styles.css`), тож цю частину AC-39 перевіряти ні на чому.

## Links

- [T22](integrate-catalog-with-form-and-delete.md) — бейдж у каталозі · [T39](name-missing-fields-in-product-form.md) — бейдж у формі
- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 10–15
