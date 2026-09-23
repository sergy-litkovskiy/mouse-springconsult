---
id: T73
title: "Три кнопки AI біля поля: промпт, покращити, взяти варіант"
status: Blocked
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2000
blocked_by: [T72]
blocks: [T66, T74]
updated_at: "2026-09-23"
---

# T73 — Три кнопки AI біля поля: промпт, покращити, взяти варіант

## Context

Запит 2026-09-23, пункти 3, 4 і 10. Між полем і пропозицією моделі зараз дві текстові кнопки:
«? -> AI» (переписати чернетку) і «<- AI» (взяти пропозицію в поле). Власник просить:

- нову кнопку між ними з тултіпом «Покращити через AI»;
- тултіп «? -> AI» змінити на «Застосувати як промпт», бо ця кнопка тепер виконує чернетку як
  інструкцію (п. 5, режим `prompt` з [T72](add-improve-and-prompt-field-modes.md));
- кнопкам фон у стилі Material «Tonal»;
- «більш зрозумілі та оптимальні з точки зору UI/UX іконки».

**Рішення власника 2026-09-23 щодо іконок.** Згори донизу в `app-suggestion-field`:

| Кнопка | Іконка | Тултіп | Дія |
|---|---|---|---|
| промпт | `auto_awesome` | «Застосувати як промпт» | наявний output `rewrite`, `mode: 'prompt'` |
| покращити | `auto_fix_high` | «Покращити через AI» | новий output `improve`, `mode: 'improve'` |
| взяти варіант | `arrow_back` | «Застосувати для поля ліворуч» | наявний output `accept` |

Іконки — зі шрифту `Material Icons` (`index.html`); назви звірити з fonts.google.com/icons, а
не з пам'яті. `aria-label` кожної кнопки — тултіп і назва поля (`label`). Обидві кнопки
запуску мають ту саму умову доступності, що й зараз: порожня чернетка їх вимикає (AC-22).
Поле ціни (приховане до T54) має лише кнопку пошуку: нова кнопка там не з'являється.

**Tonal.** Кнопок `tonal` у застосунку ще немає. Чи має `matIconButton` в Angular Material 22
варіант tonal, звірити з material.angular.dev до старту. Якщо варіанта немає, фон задають
`mat.icon-button-overrides` на токенах `--mat-sys-secondary-container` /
`--mat-sys-on-secondary-container`, без hex.

## Sequence

> `web->>api: запуск з областю field, field і draftText у тілі`
> `api-->>web: нова пропозиція показана праворуч від поля (AC-21)`
> `user->>web: натискає «<- AI»`

[sad.md §6](../sad.md#6-runtime-view), сценарій 10: дві кнопки запуску шлють той самий запит,
різниться лише `mode`.

## Data delta

**Немає.**

## API contract excerpt

```yaml
    PreparationRunCreateRequest:
        field:
          enum: [titleProm, titleOlx, descriptionProm, descriptionOlx, seoKeywords]
```

Контракт не змінюється: `mode` додає T72.

## Acceptance criteria

AC-68 нове. До [PRD §5](../PRD.md#5-acceptance-criteria) його вносить крок 6 чекліста.

**AC-68 (US-10) — happy path**
**Given** у полі «Назва для OLX» є чернетка
**When** `user` тисне кнопку «Покращити через AI» біля цього поля
**Then** форма запускає `scope: field` з `field: titleOlx` і `mode: improve`, а кнопка «Застосувати як промпт» запускає той самий запит з `mode: prompt`

**AC-68 — edge case**
**Given** поле порожнє
**When** `user` дивиться на кнопки біля нього
**Then** обидві кнопки запуску вимкнені й мають тултіп-підказку, як і раніше (AC-22)

**AC-68 — accessibility**
**Given** біля поля три кнопки-іконки
**When** екранний читач доходить до кожної
**Then** кожна має `aria-label` з назвою дії й поля та тултіп з назвою дії, а фон кнопок — tonal із системних токенів

## Checklist

1. `product-form.spec.ts` (і `suggestion-field` через форму): тести на `mode: prompt` з кнопки `auto_awesome`, `mode: improve` з кнопки `auto_fix_high`, `aria-label` трьох кнопок, відсутність кнопки «покращити» в полі ціни. Наявні тести на `aria-label` «Попросити модель: …» і «Прийняти пропозицію: …» переписати на нові тексти, а не видаляти.
2. `suggestion-field.ts`: output `improve`, вхід `improvable` (за замовчуванням `true`).
3. `suggestion-field.html` / `.css`: три `matIconButton` згори донизу з іконками й тултіпами з таблиці; фон tonal.
4. `product-form.ts`: `improveField(field)` шле `mode: 'improve'`, `rewriteField(field)` — `mode: 'prompt'`.
5. `product-form.html`: `(improve)` для кожного текстового `app-suggestion-field`, `[improvable]="false"` для ціни.
6. `PRD.md §5`: AC-68 з посиланням на цю story.
7. `pw` на живому стеку: знімок трьох кнопок біля поля (tonal видно), тултіпи, клік «Покращити через AI» — пропозиція з'явилась праворуч. Один платний виклик `field`, ≈ $0,005. Очікувану суму назвати до виклику, виміряну — після.

## Out of scope

- Спінер замість кнопок під час запуску — [T66](show-local-ai-progress.md).
- Показ розв'язаних пропозицій — [T74](show-latest-suggestions-in-product-form.md).
- Кнопка «Згенерувати все» лишається `matButton="filled"`.

## DoD

- [ ] AC-68: три кнопки-іконки з тултіпами, дві шлють різні `mode`.
- [ ] Тести `web` зелені, `lint` зелений, `pw` пройдено.
- [ ] Коміт: `feat(web): add the improve action and show AI actions as tonal icons`.

## Links

- [T72](add-improve-and-prompt-field-modes.md) — режими `improve` і `prompt` · [T32](add-preparation-ui.md) — `app-suggestion-field`
- [sad.md §6](../sad.md#6-runtime-view), сценарій 10 · [openapi.yaml](../contracts/openapi.yaml) — `PreparationRunCreateRequest`
