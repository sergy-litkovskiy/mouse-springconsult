---
id: T47
title: "Серверна чистка HTML опису для Prom під час збереження"
status: Done
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1500
blocked_by: [T46]
blocks: [T49]
updated_at: "2026-09-18"
---

# T47 — Серверна чистка HTML опису для Prom під час збереження

## Context

За ADR 0016 з [T46](decide-prom-description-html.md) опис для Prom зберігається як HTML. Кнопка
«Почистити html» (T49) працює в браузері, але прямий `PATCH` чи `POST` в обхід форми
записав би будь-який HTML, зокрема `<script>` чи `onerror`. Тому `api` чистить
`descriptionProm` тим самим переліком тегів перед записом.

Чистка вже існує: `cleanDescription` у `apps/api/db/prom-xlsx.ts` (sanitize-html, xlsx-імпорт).
Задача переносить її в модуль `products`, щоб нею користувались і сервіс картки, і імпорт.
Перелік тегів переїжджає в контрактну константу без залежностей, яку в T49 імпортує фронт.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), ручний шлях:

> `web->>api: зберігає картку`
> `api->>pg: одним оновленням пише заголовки, тексти, слова й ціну`

Між цими кроками `api` чистить `descriptionProm`.

## Data delta

Схема не змінюється. Наявні рядки не переписуються: чистка діє лише на запис, міграції немає
(ADR 0016, рішення №5).

## API contract excerpt

```yaml
      operationId: createProduct
      operationId: updateProduct
        descriptionProm:
          type: string
          description: HTML з переліку ADR 0016. Сервер чистить його перед записом, порожній абзац стає "".
        descriptionOlx: { type: string }
```

## Acceptance criteria

**AC-46 (нове) — happy path**
**Given** відкрита картка
**When** `PATCH` надсилає `descriptionProm: "<div><span style=\"color:red\">Червоний</span> колір</div>"`
**Then** у відповіді й у базі лишається текст без `div`, `span` і `style`, а дозволені теги (`p`, `ul`, `strong`, …) збережені

**AC-46 — security**
**Given** будь-яка картка
**When** `POST` чи `PATCH` надсилає опис з `<script>`, `<img onerror=…>` або `<a href="javascript:…">`
**Then** у базу не потрапляють ні ці теги, ні атрибути, ні їхній вміст

**AC-46 — edge case**
**Given** опис складається лише з `<p></p>` чи `<p>&nbsp;</p>`
**When** картку зберігають
**Then** `descriptionProm` стає `""`, а готовність картки рахує опис порожнім

## Checklist

1. **Окремим комітом до `/tdd`** — `refactor(products)`: перенести `cleanDescription` і його тести з `db/prom-xlsx.ts` у модуль `products`, експортувати через `products/index.ts`; `db/prom-xlsx.ts` імпортує звідти. Перелік тегів винести в `apps/api/src/contracts/prom-description-html.ts`.
2. `ProductService`: чистити `descriptionProm` під час створення й оновлення картки. `descriptionOlx` не чіпати.
3. Тести сервісу на AC-46: розмітка з браузера, три вектори XSS, порожній абзац. Спільний набір прикладів з T46 (рішення №4) — окремий `describe`, який T49 повторить на фронті.
4. **Ліміт прибрати** (ADR 0016, рішення №6): `descriptionProm` і `descriptionOlx` у схемах запису `products.contract.ts` втрачають `.max()`, `descriptionMaxLength` зникає з `products-limits.ts`, а валідатори й `mat-error` довжини — з форми картки. Тести контракту на ліміт переписуються: це зміна вимоги.
4a. Серверна постобробка зводить вихід `sanitize-html` до канонічної форми браузера (`<br>`, а не `<br />`), як вимагає спільний набір прикладів ADR 0016 №4. `b`/`i` перейменовуються на `strong`/`em`, `href` — лише `http`, `https`, `mailto`.
5. `openapi.yaml`: в обох описах прибрати `maxLength`, у `descriptionProm` схем запису дописати, що сервер чистить HTML за переліком ADR 0016. Оновити excerpt цієї story.
6. `PRD.md §5`: AC-46.

## Out of scope

- Чистка в браузері й кнопка — [T49](add-prom-description-cleanup-button.md).
- `descriptionOlx`: лишається plain text, HTML не приймає й не чиститься.

## DoD

- [x] AC-46: тести сервісу зелені, тести `prom-xlsx` зелені без зміни очікувань.
- [x] `typecheck` · `lint` · `test` · `deps:check` в `api` зелені.
- [x] Коміт: `feat(products): sanitize the Prom description on save`.

## Links

- [T46](decide-prom-description-html.md) · [T49](add-prom-description-cleanup-button.md)
- [ADR 0004](../adr/0004-validate-uploads-in-api-before-r2.md) — той самий принцип: вхід перевіряє `api`, а не браузер
- [PRD §5](../PRD.md#5-acceptance-criteria)
