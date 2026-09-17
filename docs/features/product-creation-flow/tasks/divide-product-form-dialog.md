---
id: T44
title: "Розділювачі заголовка й дій у діалозі картки"
status: Todo
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1300
blocked_by: []
blocks: [T45]
updated_at: "2026-09-17"
---

# T44 — Розділювачі заголовка й дій у діалозі картки

## Context

Запит 2026-09-17 (друга хвиля UI-доопрацювання). Уміст діалогу картки прокручується між
заголовком і кнопками, але межу між ними не видно. Тому під заголовком
(`mat-dialog-title`) і над кнопками (`mat-dialog-actions`) має з'явитися тонка світлосіра
лінія.

**Скоуп — лише діалог картки.** Запит стосується цього діалогу, і тільки в ньому вміст
прокручується за будь-якої висоти екрана. Діалог підтвердження короткий, і лінії в ньому
зайві. Для переглядача фото ([T43](add-catalog-image-viewer.md)) лінію можна додати
окремо, якщо попросять.

**Колір — `--mat-sys-outline-variant`.** Це декоративна лінія, а не текст, тож вимога до
контрасту тексту на неї не поширюється. Саме цей токен Material 3 призначає розділювачам.

## Sequence

Власного сценарію немає: це верстка діалогу. [sad.md §6](../sad.md#6-runtime-view):

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Немає.** Правка торкається лише `product-form.css`.

## API contract excerpt

Діалог зберігає картку одним маршрутом, і задача його не змінює:

```yaml
      operationId: updateProduct
            schema: { $ref: "#/components/schemas/ProductUpdateRequest" }
```

## Acceptance criteria

**AC-42 (нове) — happy path**
**Given** `user` відкрив діалог картки
**When** діалог відмальовано
**Then** під заголовком і над кнопками «Скасувати» / «Зберегти» є лінія завтовшки 1 px кольору `outline-variant` на всю ширину діалогу

**AC-42 — edge case**
**Given** відкрито діалог підтвердження видалення або переглядач фото
**When** діалог відмальовано
**Then** ліній у ньому немає: правка не виходить за межі діалогу картки

## Checklist

1. `product-form.css`: `border-bottom` на `.card-title` і `border-top` на `mat-dialog-actions` (клас на елементі в `product-form.html`, якщо селектор за тегом не підходить), обидва `1px solid var(--mat-sys-outline-variant)`.
2. Перевірити, що заголовок із бейджем і кнопки не змістились, а лінія йде від краю до краю діалогу.
3. `pw`: знімок діалогу картки на 1280 і 360 px; обчислені `border-*-color` дорівнюють `--mat-sys-outline-variant`; діалог підтвердження ліній не має.
4. `PRD.md §5`: AC-42 з посиланням на цю story.

## Out of scope

- Лінії в інших діалогах — див. Context.
- Поведінка збереження — [T45](close-product-form-on-save.md).

## DoD

- [ ] AC-42: лінії видно на знімках, кольори збігаються з токеном.
- [ ] Наявні тести `web` зелені, `lint` зелений.
- [ ] Коміт: `style(web): divide the card dialog header and actions`.

## Links

- [T20](add-product-form-subfeature.md) — форма · [T41](fix-product-form-field-sizing.md) — попередня правка `product-form.css`
- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 10–15
