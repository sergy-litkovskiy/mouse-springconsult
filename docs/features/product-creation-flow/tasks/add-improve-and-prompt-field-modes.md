---
id: T72
title: "Два режими запуску поля: покращити чернетку й виконати її як промпт"
status: Blocked
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2800
blocked_by: [T67, T71]
blocks: [T73]
updated_at: "2026-09-23"
---

# T72 — Два режими запуску поля: покращити чернетку й виконати її як промпт

## Context

Запит 2026-09-23, пункти 3 і 5. Людина має два різні наміри щодо того, що вона написала в полі:

- **покращити** готовий текст: «Юзер може написати свій готовий опис чи назву товару і попросити
  AI адаптувати чи покращити цей текст для відповідної платформи». Кнопка «має точно знати до
  якої платформи вона відноситься»;
- **виконати** написане як інструкцію: «юзер може ввести не готовий опис для покращення, а свій
  промпт для AI, на основі якого AI має зробити роботу по генеруванню текста».

**Що є зараз.** `AnthropicAdapter.rewriteField` має один промпт: переписати чернетку як новий
варіант. `fieldKind` дає `titleProm` і `titleOlx` ту саму назву «listing title», тож майданчика
модель не знає. Режиму «чернетка як інструкція» немає.

**Контракт.** У гілці `field` схеми `preparationRunRequestSchema` з'являється
`mode: 'improve' | 'prompt'` зі значенням за замовчуванням `improve`. Значення за замовчуванням
потрібне, бо T72 мержиться раніше за T73: доти форма шле запит без `mode`, і кнопка «? -> AI»
має працювати як сьогодні. `mode` входить у хеш ключа ідемпотентності (`PreparationRunService`):
інакше той самий текст через другу кнопку повернув би запуск першої. Задача, поставлена в чергу
до деплою й без `mode`, у `worker` читається як `improve`.

**Два промпти.** Обидва називають майданчик з поля: Prom.ua для `titleProm`/`descriptionProm`/
`seoKeywords`, OLX для `titleOlx`/`descriptionOlx`.

- `improve` адаптує текст під майданчик, зберігає всі факти чернетки й нічого не вигадує.
- `prompt` виконує інструкцію й пише текст поля. Характеристик, яких в інструкції немає, модель
  не додає. **Без `web_search`**, хоча приклад власника просить «знайди ще додаткову інформацію,
  якщо можеш». Це рішення власника 2026-09-23: пошук у мережі коштував $0,27–0,77 за виклик
  (T54), а поле коштує частки цента.

Опис для Prom в обох режимах — plain text з абзацами, як і в `generateTexts` (ADR 0016: розмітку
ставить редактор, а `api` її чистить). Нормалізація назви з [T67](generate-titles-with-texts.md)
діє в обох режимах. На вхід обидва режими отримують чернетку, очищену [T71](strip-tags-from-field-draft.md).

## Sequence

> `worker->>anthropic: text-only виклик — без фото, вхід лише draftText`
> `anthropic-->>worker: новий варіант поля`
> `worker->>pg: пише одну пропозицію та usage виклику`

[sad.md §6](../sad.md#6-runtime-view), сценарій 10. Крок 7 чекліста дописує в сценарій режим
і міняє хеш ключа на `(field, mode, draftText)`. Рядок `web->>api: запуск з областю field, …`
не переписується: його дослівно цитують T66, T71 і T73.

## Data delta

**Немає.** `mode` не зберігається окремою колонкою: він входить лише в хеш
`product_preparation_runs.idempotency_key`. Запуски `field`, створені до деплою, лишаються з
ключами без `mode`, тож перший повтор тієї самої чернетки після деплою створить новий запуск.

## API contract excerpt

```yaml
    PreparationRunCreateRequest:
        field:
          enum: [titleProm, titleOlx, descriptionProm, descriptionOlx, seoKeywords]
        draftText:
            Лише при `scope: field` — поточна незбережена чернетка поля, з якої
            модель готує новий варіант.
```

Крок 6 додає властивість `mode` поруч, наявних рядків не переписуючи.

## Acceptance criteria

AC-21 переписується, AC-66 і AC-67 нові. До [PRD §5](../PRD.md#5-acceptance-criteria) їх вносить
крок 8 чекліста.

**AC-66 (US-10) — happy path, improve**
**Given** у полі «Опис для OLX» людина написала готовий опис
**When** `user` просить його покращити
**Then** модель повертає опис, адаптований під OLX, з усіма фактами чернетки й без нових

**AC-67 (US-10) — happy path, prompt**
**Given** у полі «Опис для Prom» людина написала «скатертина з льону, 140×120 см, нова, червона — склади опис для Prom»
**When** `user` застосовує чернетку як промпт
**Then** модель повертає опис для Prom.ua, а не переписану інструкцію, і не додає характеристик, яких в інструкції немає

**AC-66 — edge case**
**Given** та сама чернетка вже мала запуск `improve`
**When** `user` застосовує її як промпт
**Then** `api` ставить новий запуск `prompt`, а не повертає запуск `improve`

**AC-66 — edge case (старий запит)**
**Given** запит `scope: field` без `mode` або задача в черзі без `mode`
**When** `api` приймає його чи `worker` бере задачу
**Then** запуск іде в режимі `improve`

## Checklist

1. Новий `ai.contract.spec.ts` поруч з `products.contract.spec.ts`: `mode` у гілці `field` приймає `improve` і `prompt`, за замовчуванням `improve`, інше значення відхиляється.
2. `AnthropicAdapter.spec.ts`: текст запиту кожного режиму називає майданчик поля (Prom.ua чи OLX); `improve` просить зберегти факти й нічого не вигадувати; `prompt` просить виконати інструкцію без нових характеристик; жоден режим не передає інструмент `web_search`.
3. `PreparationRunService.spec.ts`: та сама чернетка з різним `mode` дає різні ключі; `mode` доходить до задачі черги. `PreparationService.spec.ts`: задача без `mode` йде як `improve`; нормалізація назви з T67 діє в обох режимах.
4. `ai.contract.ts`, `PreparationQueue.ts`, `PreparationRunService.ts`: `mode` у запиті, у задачі й у хеші.
5. `AnthropicAdapter.ts`: `rewriteField(field, draftText, mode)` з двома промптами; `fieldKind` називає майданчик. `PreparationService.ts`: `job.mode ?? 'improve'`.
6. `openapi.yaml`: властивість `mode` у `PreparationRunCreateRequest` (enum, default, опис двох режимів).
7. `sad.md`: §4 S7 — «Уточнення 2026-09-23» про два режими й відмову від `web_search`; §6 сценарій 10 — `Note` про `mode` і хеш `(field, mode, draftText)`.
8. `PRD.md`: US-10 (покращити власний текст **або** дати моделі інструкцію), AC-21 у редакції «покращити», AC-22 стосується обох дій, AC-66 і AC-67 з посиланням на цю story.
9. `pw` на живому стеку: по одному запиту `improve` і `prompt` через `POST` з `mode`, бо кнопок ще немає (T73). Два платні виклики `field`, ≈ $0,01 разом. Очікувану суму назвати до виклику, виміряну — після.

## Out of scope

- Кнопки у формі — [T73](add-improve-button-and-tonal-ai-actions.md).
- `web_search` для режиму `prompt`: рішення власника 2026-09-23.
- Режими для `scope: texts`, `price`, `both`.

## DoD

- [ ] AC-66, AC-67: два режими з майданчиком у промпті, `mode` у ключі.
- [ ] Тести `api` зелені, `typecheck`, `lint`, `deps:check` зелені, `pw` пройдено.
- [ ] Коміт: `feat(ai): rewrite a field either as an improvement or from a prompt`.

## Links

- [ADR 0015](../adr/0015-add-per-field-text-rewrite-scope.md) — область `field` · [ADR 0016](../adr/0016-store-the-prom-description-as-html.md) — опис Prom як HTML
- [T67](generate-titles-with-texts.md) — нормалізація назви · [T71](strip-tags-from-field-draft.md) — очищена чернетка · [T54](bound-the-model-call-timeout.md) — вартість `web_search`
- [sad.md §6](../sad.md#6-runtime-view), сценарій 10 · [openapi.yaml](../contracts/openapi.yaml) — `PreparationRunCreateRequest`
