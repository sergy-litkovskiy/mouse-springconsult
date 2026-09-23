---
id: T69
title: "«Згенерувати все» між галереєю й полями форми"
status: Todo
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1200
blocked_by: []
blocks: []
updated_at: "2026-09-23"
---

# T69 — «Згенерувати все» між галереєю й полями форми

## Context

Запит 2026-09-23, пункт 2: «розмісти секцію з кнопкою "Згенерувати все" між блоком з фото та
полями форми (відразу після фото та над "Назва для Prom")».

Зараз блок `.card-prepare` (кнопка, напис про запуск і лічильник токенів) стоїть у
`product-form.html` першим у `mat-dialog-content`, над `app-product-gallery`. Кнопка вимкнена,
доки немає кадру, тож людина бачить її раніше, ніж може нею скористатись. Після переносу порядок
збігається з порядком роботи: фото, потім генерація, потім поля.

Блок переноситься цілим після `app-product-gallery` і підказки «Спершу додайте хоча б одне
фото…», перед `<form>`. Поведінка кнопки не змінюється, тож задача — верстка з вимірюваним DoD.

## Sequence

> `user->>web: запускає підготовку текстів (Generate all)`

[sad.md §6](../sad.md#6-runtime-view), сценарій 7: запуск той самий, змінюється лише місце кнопки.

## Data delta

**Немає.** Правка лише шаблону форми.

## API contract excerpt

```yaml
      operationId: startPreparationRun
          enum: [texts, price, both, field]
```

Контракт не змінюється.

## Acceptance criteria

AC-63 нове. До [PRD §5](../PRD.md#5-acceptance-criteria) його вносить крок 3 чекліста.

**AC-63 (US-03) — happy path**
**Given** відкрита картка
**When** `user` дивиться на форму згори донизу
**Then** кнопка «Згенерувати все» стоїть після галереї й підказки про фото та перед полем «Назва для Prom»

**AC-63 — edge case**
**Given** картка з кадром і витраченими токенами, запуск іде
**When** форма показує напис про запуск і лічильник токенів
**Then** обидва стоять поруч із кнопкою на новому місці, а кнопка працює як раніше

## Checklist

1. `product-form.html`: блок `.card-prepare` перенести після `app-product-gallery` і блоку `@if (!hasFrames())`, перед `<form>`.
2. `product-form.css`: відступи `.card-prepare` підігнати під нове сусідство, без hex і без нових кольорів.
3. `PRD.md §5`: AC-63 з посиланням на цю story.
4. `pw`: знімок форми з кадром; у DOM `[data-testid="generate-all"]` стоїть після `app-product-gallery` і перед `[data-field="titleProm"]`.

## Out of scope

- Будь-які зміни поведінки «Згенерувати все» і локального лоадера ([T66](show-local-ai-progress.md)).

## DoD

- [ ] AC-63: кнопка між галереєю й полями.
- [ ] Тести `web` зелені без змін у `*.spec.ts`, `lint` зелений, `pw` пройдено.
- [ ] Коміт: `feat(web): place Generate all between the gallery and the fields`.

## Links

- [T32](add-preparation-ui.md) — фронт підготовки · [T66](show-local-ai-progress.md) — спінер у тій самій кнопці
- [sad.md §6](../sad.md#6-runtime-view), сценарій 7 · [openapi.yaml](../contracts/openapi.yaml) — `startPreparationRun`
