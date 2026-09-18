---
id: T49
title: "Кнопка «Почистити html» біля опису для Prom"
status: Done
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1300
blocked_by: [T47, T48]
blocks: [T25]
updated_at: "2026-09-18"
---

# T49 — Кнопка «Почистити html» біля опису для Prom

## Context

Запит 2026-09-18. Онлайн-редактори й копіювання з браузера додають зайві чи некоректні
теги: `span` зі `style`, `div` замість абзаців, `font`, порожні абзаци, `&nbsp;` підряд,
незакриті теги. Біля редактора опису Prom (T48) потрібна невелика кнопка-іконка
`cleaning_services` з tooltip «Почистити html». Вона аналізує HTML, прибирає зайве й
замінює вміст поля виправленою версією.

Чистка йде в браузері за переліком тегів з `contracts/prom-description-html.ts` (T47) і
способом, обраним у T46 (рішення №4). Результат має збігатися з серверною чисткою T47 на
спільному наборі прикладів. Інакше збережений опис відрізнятиметься від показаного.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), ручний шлях. Кнопка працює до збереження:

> `user->>web: вписує обидва заголовки, описи, ключові слова й ціну`

## Data delta

**Немає.**

## API contract excerpt

```yaml
      operationId: updateProduct
        descriptionProm:
          type: string
          description: HTML з переліку ADR 0016. Сервер чистить його перед записом, порожній абзац стає "".
```

## Acceptance criteria

**AC-48 (нове) — happy path**
**Given** в описі Prom є `<div><span style="color:red">Червоний</span> колір</div><p>&nbsp;</p>`
**When** `user` натискає кнопку «Почистити html»
**Then** поле містить лише дозволені теги й текст без втрат, порожнього абзацу немає, форма позначена зміненою

**AC-48 — edge case**
**Given** опис уже чистий
**When** `user` натискає кнопку
**Then** вміст не змінюється, і форма не стає зміненою

**AC-48 — accessibility**
**Given** відкрита картка
**When** `user` наводить курсор чи фокус на кнопку
**Then** видно tooltip «Почистити html», у кнопки є `aria-label` з тим самим текстом, а у вимкненій формі кнопка вимкнена

## Checklist

1. Установити `dompurify` в образ `web` окремим комітом до `/tdd` (ADR 0016 №4, команда з `mouse-commands`, не на хості).
2. Функція чистки поруч із редактором, `prom-description-cleanup.ts`: перелік тегів з `@contracts/prom-description-html` (рантайм-імпорт константи, не zod-файлу).
3. `prom-description-editor.html`: `mat-icon-button` з іконкою `cleaning_services`, `matTooltip` і `aria-label` «Почистити html». Працює в обох режимах редактора.
4. Тести функції на спільному наборі прикладів з T46, той самий `describe`, що й у T47. Тести кнопки: заміна вмісту, чистий вміст без змін, вимкнений стан.
5. `pw`: вставити розмітку з браузера, натиснути кнопку, перевірити режим HTML і збережений результат.
6. `PRD.md §5`: AC-48.

## Out of scope

- Автоматична чистка під час вставки: запит просить кнопку.
- Серверна чистка — [T47](sanitize-prom-description-on-save.md).

## DoD

- [x] AC-48: тести зелені, `pw` пройдено, результат кнопки збігається з відповіддю сервера після збереження.
- [x] `lint` · `test` у `web` зелені.
- [x] Коміт: `feat(web): clean up the Prom description HTML on demand`.

## Links

- [T46](decide-prom-description-html.md) · [T47](sanitize-prom-description-on-save.md) · [T48](add-prom-description-editor.md)
- [PRD §5](../PRD.md#5-acceptance-criteria)
