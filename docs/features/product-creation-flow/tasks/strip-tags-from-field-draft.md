---
id: T71
title: "Чернетка поля йде до моделі без тегів"
status: Todo
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 2000
blocked_by: []
blocks: [T72]
updated_at: "2026-09-23"
---

# T71 — Чернетка поля йде до моделі без тегів

## Context

Запит 2026-09-23, пункт 9: «прибирай теги, що можуть прилетіти з UI, перед відправкою draftText
до моделі на генерування пропозиції».

**Звідки теги.** Для `descriptionProm` форма шле в `draftText` HTML з редактора Tiptap
([ADR 0016](../adr/0016-store-the-prom-description-as-html.md)), а `PreparationRunService.start`
кладе його в задачу як є. Модель отримує розмітку замість тексту, платить за неї токенами й
інколи повертає її назад. Для решти полів тегів зазвичай немає, але вставка з буфера їх теж може
принести.

**Де чистити.** Нова функція `products/draftPlainText.ts` на `sanitize-html` (`allowedTags: []`)
перетворює блокові теги (`</p>`, `<br>`, `</li>`) на переноси, а сутності (`&amp;`, `&nbsp;`)
декодує в символи. Прецедент — `toPlainText` в `apps/api/db/prom-xlsx.ts`. Імпортувати його в
модуль не можна, бо `db/` є composition root, і стрілка пішла б угору. Файл названо в нижньому
регістрі, як `cleanDescription.ts`: він експортує функцію, а не клас.

Чистка стоїть у `start` **до** хешу ключа ідемпотентності: ключ називає вхід, який модель справді
отримує (`data-model.md`, «версія входу»). Отже, той самий текст з іншою розміткою повертає вже
наявний запуск, а не купує новий. У задачу черги теж іде очищений текст.

**Порожня чернетка після чистки.** Фронт вимикає кнопку для порожньої чернетки (AC-22), але
редактор може надіслати розмітку без тексту. Таку чернетку `start` відхиляє
`PreparationInputIncomplete('draft')`: той самий `409 preparation_input_incomplete`, у
`details.missing` з'являється третє значення `draft`. Нового коду помилки задача не додає.

## Sequence

> `web->>api: запуск з областю field, field і draftText у тілі`
> `worker->>anthropic: text-only виклик — без фото, вхід лише draftText`

[sad.md §6](../sad.md#6-runtime-view), сценарій 10: між цими кроками `api` чистить чернетку.

## Data delta

**Немає.** Змінюється лише вхід хешу в `product_preparation_runs.idempotency_key`: для чернетки з
тегами ключ тепер рахується від тексту. Запуски, створені до деплою, лишаються як були. Перший
повтор тієї самої HTML-чернетки після деплою створить новий запуск один раз.

## API contract excerpt

```yaml
    PreparationRunCreateRequest:
        draftText:
            Лише при `scope: field` — поточна незбережена чернетка поля, з якої
            модель готує новий варіант.
```

Схема запиту не змінюється. Опис відповіді `409` і приклад `missing: ["draft"]` дописує крок 5.

## Acceptance criteria

AC-65 нове. До [PRD §5](../PRD.md#5-acceptance-criteria) його вносить крок 6 чекліста.

**AC-65 (US-10) — domain invariant**
**Given** чернетка опису для Prom — HTML з абзацами, списком і `&amp;`
**When** `user` запускає AI для цього поля
**Then** модель отримує текст без тегів, абзаци й пункти списку стоять окремими рядками, а `&amp;` стає `&`

**AC-65 — edge case**
**Given** дві чернетки з тим самим текстом, але різною розміткою
**When** `user` запускає AI для другої одразу після першої
**Then** `api` повертає вже наявний запуск, а не ставить новий

**AC-65 — error**
**Given** чернетка складається лише з розмітки без тексту
**When** `api` приймає запуск `scope: field`
**Then** відповідь `409 preparation_input_incomplete` з `details.missing: ["draft"]`, і задача в чергу не йде

## Checklist

1. `draftPlainText.spec.ts`: абзаци, `<br>`, пункти списку, вкладені теги, `&amp;`/`&nbsp;`/`&lt;`; звичайний текст без тегів проходить незмінним, крім обрізаних пробілів по краях.
2. `PreparationRunService.spec.ts`: у задачу черги йде очищена чернетка; дві чернетки з різною розміткою й тим самим текстом дають один ключ; чернетка з самої розмітки відхиляється `PreparationInputIncomplete` з `draft`.
3. `draftPlainText.ts` за прецедентом `toPlainText`.
4. `PreparationRunService.ts`: чистка перед хешем і перед `enqueue`; `ProductErrors.ts`: `missing` приймає `draft`.
5. `openapi.yaml`: опис відповіді `409` у `startPreparationRun` називає третій випадок, приклад `draft`.
6. `PRD.md §5`: AC-65 з посиланням на цю story.

## Out of scope

- Текст помилки на фронті для `missing: draft`: кнопку для порожньої чернетки фронт і так вимикає (AC-22).
- Режими `improve` і `prompt` — [T72](add-improve-and-prompt-field-modes.md).

## DoD

- [ ] AC-65: модель отримує чернетку без тегів, ключ рахується від тексту.
- [ ] Тести `api` зелені, `typecheck`, `lint`, `deps:check` зелені.
- [ ] Коміт: `feat(products): strip markup from a field draft before the model`.

## Links

- [T47](sanitize-prom-description-on-save.md) — чистка HTML опису при збереженні · [T51](allow-retry-after-failed-run.md) — ключ ідемпотентності
- [ADR 0015](../adr/0015-add-per-field-text-rewrite-scope.md) · [ADR 0016](../adr/0016-store-the-prom-description-as-html.md)
- [sad.md §6](../sad.md#6-runtime-view), сценарій 10 · [openapi.yaml](../contracts/openapi.yaml) — `PreparationRunCreateRequest`, `startPreparationRun`
