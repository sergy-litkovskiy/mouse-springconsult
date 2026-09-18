---
id: T48
title: "Міні-редактор HTML для опису Prom з режимом сирого HTML"
status: Todo
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1300
blocked_by: [T46]
blocks: [T49]
updated_at: "2026-09-18"
---

# T48 — Міні-редактор HTML для опису Prom з режимом сирого HTML

## Context

Запит 2026-09-18. Поле «Опис для Prom» у формі картки зараз `textarea`. Його замінює
міні-редактор з мінімальним набором кнопок і двома режимами:

1. **Перегляд** — відформатований текст, кнопки панелі: жирний, курсив, маркований і
   нумерований список, заголовок, посилання, скасувати/повторити.
2. **HTML** — сирий HTML у моноширинному полі, його можна правити руками.

Перемикання режимів не втрачає зміни. Бібліотеку обрано в
[T46](decide-prom-description-html.md) (рішення №3). Опис для OLX лишається `textarea`.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), ручний шлях:

> `user->>web: вписує обидва заголовки, описи, ключові слова й ціну`
> `web->>api: зберігає картку`

## Data delta

**Немає.** Редактор пише HTML у той самий `formControlName="descriptionProm"`.

## API contract excerpt

```yaml
      operationId: updateProduct
        descriptionProm: { type: string, maxLength: 8000 }
```

## Acceptance criteria

**AC-47 (нове) — happy path**
**Given** відкрита картка
**When** `user` виділяє слово й натискає «Жирний», потім перемикається в режим HTML
**Then** у режимі HTML видно `<strong>` навколо слова, а після збереження той самий HTML повертається з сервера

**AC-47 — HTML-режим**
**Given** редактор у режимі HTML
**When** `user` дописує `<ul><li>Пункт</li></ul>` і повертається в режим перегляду
**Then** видно маркований список, форма позначена зміненою, кнопка «Зберегти» активна

**AC-47 — edge case**
**Given** картка без кадрів, тож поля форми вимкнені (AC-20)
**When** відкривається діалог
**Then** редактор теж вимкнений у обох режимах

## Checklist

1. **Окремим комітом до кроку А** — установити в образ `web` `@tiptap/core`, `@tiptap/pm` і розширення з ADR 0016 №3 (команда з `mouse-commands`, не на хості). Редактор вантажиться через `import()` окремим чанком.
2. Новий компонент `apps/web/src/app/products/form/prom-description-editor.ts` (`.html`, `.css`): `ControlValueAccessor`, панель кнопок, перемикач режимів, стан через сигнали (zoneless).
3. `product-form.html`: замінити `textarea` опису Prom на редактор з тією самою міткою. Валідатор `maxLength` і `mat-error` довжини для Prom прибрати (ADR 0016 №6), для OLX лишити. Порожній редактор дає `""`, а не `<p></p>` (№8). Значення, завантажене з сервера, не позначає форму зміненою, навіть якщо Tiptap його нормалізував.
4. Наявні plain-text описи не конвертуються (ADR 0016 №5).
5. Тести компонента: запис/читання значення, перемикання режимів без втрати змін, вимкнений стан.
6. `pw` на 1280 і 360 px: обидва режими, збереження, повторне відкриття; на 360 px без горизонтального скролу.
7. `PRD.md §5`: AC-47.

## Out of scope

- Кнопка «Почистити html» — [T49](add-prom-description-cleanup-button.md).
- Вставка зображень і таблиць, кольори, шрифти.

## DoD

- [ ] AC-47: тести компонента й форми зелені, `pw` пройдено.
- [ ] `lint` · `test` у `web` зелені, бандл сторінки картки виміряно до і після.
- [ ] Коміт: `feat(web): edit the Prom description in a mini HTML editor`.

## Links

- [T46](decide-prom-description-html.md) · [T49](add-prom-description-cleanup-button.md) · [T20](add-product-form-subfeature.md) — форма картки
- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-20
