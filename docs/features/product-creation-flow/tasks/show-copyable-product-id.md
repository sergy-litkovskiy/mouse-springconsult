---
id: T70
title: "ID товару під заголовком картки з кнопкою копіювання"
status: Todo
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1400
blocked_by: []
blocks: []
updated_at: "2026-09-23"
---

# T70 — ID товару під заголовком картки з кнопкою копіювання

## Context

Запит 2026-09-23, пункт 7: «виводь ID товару відразу під заголовком "Картка товару" маленьким та
сіреньким шрифтом з кнопкою-іконкою "скопіювати" поруч, щоб юзер міг одним кліком скопіювати це
значення».

**Звідки форма бере ID.** Сигнал `productId` у `product-form.ts` уже є: він приходить з даних
діалогу для наявної картки й заповнюється в `ensureProduct()`, коли нова картка з'являється
після першого кадру. Сигнал стає `protected`, щоб шаблон міг його читати. Поки `productId()`
дорівнює `null`, рядка з ID немає.

**Засоби.** Копіює `Clipboard` з `@angular/cdk/clipboard`: `@angular/cdk` уже в залежностях,
пакет не додається. Підтвердження показує `MatSnackBar` «ID скопійовано». Колір тексту береться з
токена `--mat-sys-on-surface-variant`, а не з hex. Кнопка — `matIconButton` з іконкою
`content_copy` із шрифту `Material Icons` (`index.html`). Назву іконки звірити з
fonts.google.com/icons, а не з пам'яті.

## Sequence

> `api-->>web: картка, похідна готовність і скільки слів відкинуто`

[sad.md §6](../sad.md#6-runtime-view), сценарій 6: відповідь картки несе `id`, форма його лише
показує.

## Data delta

**Немає.**

## API contract excerpt

```yaml
    Product:
        - id
        id: { type: string, format: uuid }
```

Контракт не змінюється.

## Acceptance criteria

AC-64 нове. До [PRD §5](../PRD.md#5-acceptance-criteria) його вносить крок 4 чекліста.

**AC-64 (US-06) — happy path**
**Given** відкрита наявна картка
**When** `user` тисне кнопку копіювання поруч з ID під заголовком
**Then** ID картки потрапляє в буфер обміну, а форма показує «ID скопійовано»

**AC-64 — edge case**
**Given** нова картка, у якої ще немає жодного кадру
**When** `user` дивиться на заголовок
**Then** рядка з ID немає; він з'являється, щойно перший кадр створив картку

**AC-64 — accessibility**
**Given** рядок з ID показано
**When** екранний читач доходить до кнопки копіювання
**Then** кнопка має `aria-label` «Скопіювати ID товару» і такий самий тултіп

## Checklist

1. `product-form.spec.ts`: тести на рядок з ID для наявної картки; на відсутність рядка для нової картки та появу після `ensureProduct()`; на виклик `Clipboard.copy` з ID і показ «ID скопійовано».
2. `product-form.ts`: `productId` стає `protected`; метод копіювання через `Clipboard` і `MatSnackBar`.
3. `product-form.html` / `.css`: рядок під `h2` — дрібний текст у кольорі `--mat-sys-on-surface-variant` і `matIconButton` `content_copy`.
4. `PRD.md §5`: AC-64 з посиланням на цю story.
5. `pw`: знімок заголовка, клік на кнопку, `navigator.clipboard.readText()` повертає ID.

## Out of scope

- Показ ID у каталозі.
- Копіювання інших полів картки.

## DoD

- [ ] AC-64: ID під заголовком копіюється одним кліком.
- [ ] Тести `web` зелені, `lint` зелений, `pw` пройдено.
- [ ] Коміт: `feat(web): show the product id with a copy button in the card`.

## Links

- [T20](add-product-form-subfeature.md) — форма картки · [T38](allow-empty-product-card.md) — картка з'являється з першим кадром
- [sad.md §6](../sad.md#6-runtime-view), сценарій 6 · [openapi.yaml](../contracts/openapi.yaml) — `Product.id`
