---
id: T66
title: "Локальний індикатор запиту до AI біля кнопки й поля"
status: Blocked
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1900
blocked_by: [T58, T59]
blocks: []
updated_at: "2026-09-21"
---

# T66 — Локальний індикатор запиту до AI біля кнопки й поля

## Context

Запит 2026-09-21, пункт 10. Поки йде запуск підготовки, форма показує лише загальний напис
(`preparingNotice`: «Модель готує тексти…») і вимикає всі кнопки AI (`busy` у
`app-suggestion-field` береться з одного `preparing()`). З кнопки чи поля, яке людина
натиснула, не видно, що саме воно зараз працює. Власник просить локальний лоадер: спінер у
кнопці «Згенерувати все» під час `scope: texts`, і спінер у тому `app-suggestion-field`, для
якого йде `scope: field`.

**Звідки форма знає поле.** `PreparationRunDto` поля `field` не несе
(`ai.contract.ts`: `scope`, `status`, …). Форма знає його з власного запиту: `startRun()`
отримує `{ scope: 'field', field }`, тож запам'ятовує поле в сигналі поруч із поллером і
скидає його, коли запуск завершився. Якщо форму відкрили, коли запуск уже йшов (поле невідоме),
лишається загальний індикатор, як зараз. Контракт не розширюємо.

**Що не змінюється.** Поки йде будь-який запуск, інші кнопки AI вимкнені, як і зараз: `api`
все одно не прийме паралельного запуску тієї самої картки на тих самих умовах, а ліміт частоти
спільний. Загальний напис лишається — локальний спінер його доповнює.

**Ціна.** Кнопка пошуку ціни прихована до T54 (`priceLookupEnabled = false`). Логіка «спінер
у полі, для якого йде запуск» має покривати й `scope: price` без окремої гілки, але `pw` цього
не перевіряє.

Спільні блоки `product-form.html` з [T58](wrap-product-titles-in-textarea.md) і
[T59](edit-keywords-as-chips.md) — тому задача йде після них.

## Sequence

> `web->>api: запуск з областю field, field і draftText у тілі`
> `web->>api: питає стан запуску`
> `api-->>web: стан, а після завершення — значення полів`

Сценарії 7 і 10 [sad.md §6](../sad.md#6-runtime-view): полінг не змінюється, змінюється лише
місце, де форма показує, що він іде.

## Data delta

**Немає.** Ні схема, ні контракт не змінюються.

## API contract excerpt

```yaml
      operationId: startPreparationRun
          enum: [texts, price, both, field]
          enum: [titleProm, titleOlx, descriptionProm, descriptionOlx, seoKeywords]
      operationId: getPreparationRun
```

## Acceptance criteria

Нове AC із запиту 2026-09-21; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 5 чекліста.

**AC-60 (нове) — happy path**
**Given** картка з кадром, форма відкрита
**When** `user` тисне «Згенерувати все»
**Then** доки запуск `queued`/`running`, у кнопці «Згенерувати все» крутиться спінер, кнопки AI біля полів вимкнені без спінера, а після завершення спінер зникає й кнопки знову доступні

**AC-60 — happy path (одне поле)**
**Given** у полі «Опис для OLX» є чернетка
**When** `user` тисне «? -> AI» біля цього поля
**Then** спінер крутиться лише в `app-suggestion-field` «Опис для OLX», у кнопці «Згенерувати все» і в інших полях його немає; спінер має `aria-label` «Модель готує варіант»

**AC-60 — error**
**Given** запуск для поля завершився `failed` або `POST` відхилено (`409`, `429`)
**When** форма отримала відповідь
**Then** спінер зникає, помилка показується як і раніше (AC-10), а кнопки знову доступні

## Checklist

1. `product-form.spec.ts`: тести — спінер у «Згенерувати все» під час `scope: texts`; спінер лише в полі `scope: field`; спінер зникає на `succeeded`, `failed` і відхиленому `POST`; форма, відкрита під час чужого запуску, спінера в полях не показує.
2. `product-form.ts`: сигнал поля поточного запуску, встановлений у `startRun()` і скинутий після завершення чи відмови.
3. `suggestion-field.ts` / `.html`: вхід `working` (окремо від `busy`) і `mat-progress-spinner` `mode="indeterminate"` розміром з іконку в кнопці «? -> AI».
4. `product-form.html`: спінер у кнопці «Згенерувати все»; `[working]` для кожного `app-suggestion-field`.
5. `PRD.md §5`: AC-60 з посиланням на цю story.
6. `pw` на живому стеку: «? -> AI» для одного поля — спінер лише там. Один платний виклик, ≈ $0,012 за заміром T33; очікувану суму назвати до виклику, виміряну — після.

## Out of scope

- Показ прогресу у відсотках — модель його не віддає.
- Кнопка ціни — прихована до [T54](bound-the-model-call-timeout.md).

## DoD

- [ ] AC-60: локальний спінер у кнопці й у полі, загальний напис лишився.
- [ ] Тести `web` зелені, `lint` зелений, `pw` пройдено.
- [ ] Коміт: `feat(web): show AI progress next to the control that started it`.

## Links

- [T32](add-preparation-ui.md) — фронт підготовки · [T58](wrap-product-titles-in-textarea.md), [T59](edit-keywords-as-chips.md) — ті самі блоки форми
- [sad.md §6](../sad.md#6-runtime-view), сценарії 7 і 10 · [openapi.yaml](../contracts/openapi.yaml) — `startPreparationRun`, `getPreparationRun`
