---
id: T40
title: "Компактні поля фільтрів і світлосірі мітки"
status: Done
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 2000
blocked_by: []
blocks: [T41]
updated_at: "2026-09-17"
---

# T40 — Компактні поля фільтрів і світлосірі мітки

## Context

Запит 2026-09-17, UI-доопрацювання до поставки 2. Три правки панелі фільтрів каталогу:

1. Висота полів має стати на 15–20 % меншою. `outline`-поле Material за замовчуванням має
   висоту 56 px, отже ціль — 45–48 px.
2. Шрифт мітки (`mat-label`) і плейсхолдера має стати меншим.
3. Порожня мітка без фокусу й плейсхолдер мають бути світлосірими.

**Стиль міток задається для всього застосунку, а висота — лише для панелі.** Той самий
стиль міток запитано й для форми картки ([T41](fix-product-form-field-sizing.md)). Тому
розмір і колір мітки та плейсхолдера задаються один раз у `apps/web/src/styles.css`, а не
окремо в кожному компоненті. Під правку потрапляє й форма входу, і це свідомий наслідок.
Висоту поля змінюємо лише в `.filters`: зменшувати висоту у формі ніхто не просив.

**Способи правки.** Спершу стилі переписуються через CSS-токени Material (`--mat-form-field-*`)
або через `mat.form-field-overrides`. Селектори по внутрішніх класах MDC — останній варіант.
Назви токенів звірити з офіційним API Angular Material для поточної версії, а не писати з
пам'яті.

**Ризик контрасту.** «Світлосірий» не може бути світлішим за `--mat-sys-outline`.
`--mat-sys-outline-variant` на світлому тлі має контраст близько 1.6:1, і такий текст
неможливо прочитати. Токен `outline` дає контраст близько 4.5:1.

## Sequence

Власного сценарію немає: це верстка панелі, запит не змінюється. Так само
[sad.md §6](../sad.md#6-runtime-view) описує стан форми:

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Немає.** Правка торкається лише `apps/web/src/styles.css` і `product-catalog.css`.

## API contract excerpt

Набір полів панелі — параметри `listProducts`; задача змінює їхній вигляд, а не склад:

```yaml
      operationId: listProducts
        - { $ref: "#/components/parameters/TitleFilter" }
        - { $ref: "#/components/parameters/DescriptionFilter" }
        - { $ref: "#/components/parameters/PriceMin" }
        - { $ref: "#/components/parameters/PriceMax" }
```

## Acceptance criteria

Нове AC із запиту 2026-09-17; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 5 чекліста.

**AC-37 (нове) — happy path**
**Given** `user` відкриває `/products` на екрані шириною 1280 px
**When** панель фільтрів відмальована
**Then** кожне поле панелі на 15–20 % нижче за 56 px, мітки й плейсхолдери дрібніші за текст введеного значення, а мітка порожнього поля без фокусу світлосіра

**AC-37 — edge case**
**Given** поле панелі у фокусі, заповнене або з помилкою ціни
**When** `user` дивиться на мітку
**Then** мітка має колір стану (primary у фокусі, error при помилці), не обрізана й не накладається на рамку, а на 360 px горизонтального скролу немає

## Checklist

1. `styles.css`: розмір шрифту мітки й плейсхолдера та світлосірий колір (`--mat-sys-outline`) порожньої мітки без фокусу й плейсхолдера. Спершу пробувати токени Material, їхні назви звірити з документацією.
2. `product-catalog.css`: висота полів `.filters` 45–48 px через токени висоти й вертикального відступу поля. Кнопки «Застосувати» / «Скинути» вирівняти з новою висотою (`padding-bottom` у `.filters__actions`).
3. Перевірити, що мітка у фокусі й мітка з помилкою не стали сірими, а плаваюча мітка не перетинає рамку.
4. `pw`: знімки `/products` на 1280 і 360 px, виміряти висоту поля (`getBoundingClientRect().height` на `.mat-mdc-text-field-wrapper`) і додати до PR.
5. `PRD.md §5`: AC-37 з посиланням на цю story.

## Out of scope

- Висота полів форми картки — [T41](fix-product-form-field-sizing.md).
- Ширина полів — закрита в [T37](resize-catalog-filter-fields.md).

## DoD

- [x] AC-37: висота поля 45–48 px на знімку, мітки дрібніші й світлосірі, поки поле порожнє й без фокусу.
- [x] Наявні тести `web` зелені, `lint` зелений.
- [x] Коміт: `style(web): compact the catalog filters and mute empty labels`.

Результат 2026-09-17 (для опису PR):
- Токени звірено з установленим `@angular/material` 22.1. Висота поля — 46 px (−18 %): `--mat-form-field-container-height` і `--mat-form-field-container-vertical-padding: 11px` на `.filters`.
- Мітка в спокої — 14 px (`body-medium`), плейсхолдер теж 14 px. Плаваюча мітка лишилась 12 px: зменшувати її далі означало б нечитабельні 10.5 px.
- Токен `--mat-form-field-outlined-label-text-color` фарбує й заповнену мітку, тож сірий колір (`--mat-sys-outline`, `#74777f`) задає точкове правило лише для мітки без `float-above`. У фокусі мітка primary, з помилкою — error; виміряно на живому стеку.
- `pw`: висота всіх восьми полів — 46 px; на 360 px `scrollWidth` = `clientWidth` = 360; помилка ціни видна повністю.

## Links

- [T37](resize-catalog-filter-fields.md) — попередня правка панелі · [T41](fix-product-form-field-sizing.md) — форма картки
- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 10–15 · [openapi.yaml](../contracts/openapi.yaml) — `listProducts`
