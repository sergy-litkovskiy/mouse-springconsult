---
id: T93
title: "Кнопки AI вгорі, пропозиція з межею висоти"
status: Todo
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1900
blocked_by: []
blocks: []
updated_at: "2026-10-03"
---

# T93 — Кнопки AI вгорі, пропозиція з межею висоти

## Context

Запит 2026-10-03. Коли модель повертає довгий опис, панель пропозиції праворуч від поля росте на
всю довжину тексту, і кнопки між полем і пропозицією («Застосувати як промпт», «Покращити через
AI», «Застосувати для поля ліворуч») з'їжджають донизу, далеко від поля, до якого належать
(знімок власника: «Опис для OLX», кнопки на рівні кінця textarea й нижче).

Причина — у `suggestion-field.css`. Рядок `.suggestion` має `align-items: stretch`, тож
колонка `.suggestion__buttons` тягнеться на висоту панелі, а `justify-content: center` ставить
кнопки на її середину. Висота поля ліворуч має межу: textarea «Опис для OLX» має `rows="6"` і
скролиться сама, редактор опису Prom тримає `max-height: 24rem` (`prom-description-editor.css`).
У панелі пропозиції `.suggestion__value` межі немає.

Рішення власника 2026-10-03: обидві половини рядка мають межу й власний скрол, а кнопки
притиснуті до верху рядка. `.suggestion__value` отримує ту саму межу, що й редактор Prom
(`max-height: 24rem`, `overflow-y: auto`), а `.suggestion__buttons` — `justify-content:
flex-start`. Так кнопки стоять на одному місці незалежно від довжини пропозиції. Спінер
[T66](show-local-ai-progress.md) (`.suggestion__working`) тримає місце двох кнопок і зсуву
не дає, тож лишається як є.

Межа однакова для всіх полів. Назви й ключові слова до неї не доростають, тож для них
змінюється лише положення кнопок: з середини рядка вони переходять до його верху.

## Sequence

Власного сценарію немає: це верстка `app-suggestion-field`, запити не змінюються. Так само
[sad.md §6](../sad.md#6-runtime-view) описує стан форми:

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Немає.** Правка торкається лише `suggestion-field.css`.

## API contract excerpt

Текст панелі — `value` пропозиції з `latestSuggestions` картки. Задача змінює, як він стоїть на
екрані, а не що в ньому:

```yaml
            latestSuggestions:
              type: array
    FieldSuggestion:
      required: [id, runId, field, value, createdAt]
```

## Acceptance criteria

Нове AC із запиту 2026-10-03. До [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 3 чекліста.

**AC-83 (нове) — happy path**
**Given** `user` відкриває на екрані шириною 1280 px картку, де пропозиція «Опису для OLX» довша за 24rem
**When** форма відмальована
**Then** панель пропозиції має висоту не більше 24rem (384 px) і власний вертикальний скрол, а кнопки біля поля стоять угорі рядка, на рівні верхнього краю панелі

**AC-83 — edge case (коротка пропозиція)**
**Given** пропозиція поля коротка (назва для Prom) або її ще немає
**When** форма відмальована
**Then** панель має висоту за вмістом, а кнопки біля поля так само стоять на рівні її верхнього краю

**AC-83 — edge case (вузький екран)**
**Given** та сама картка з довгою пропозицією на екрані шириною 360 px
**When** форма відмальована
**Then** панель переноситься під поле, лишається не вищою за 24rem, а діалог не має горизонтального скролу

## Checklist

1. `suggestion-field.css`: `.suggestion__buttons` — `justify-content: flex-start` замість `center`; `.suggestion__value` — `max-height: 24rem` і `overflow-y: auto`. `.suggestion__working`, кольори й решту правил не чіпати.
2. `pw` на живому стеку без платних викликів: довгу пропозицію «Опису для OLX» (40 абзаців) підставити через `page.route` на `GET /api/products/<id>`. На 1280 і 360 px — `getBoundingClientRect().height` панелі `[data-field="descriptionOlx"] .suggestion__value` ≤ 384, `scrollHeight > clientHeight`; верх першої кнопки поля в межах 1 px від верху панелі — і для `descriptionOlx`, і для `titleProm`; на 360 px `scrollWidth <= clientWidth` діалогу. Знімки рядка на обох ширинах.
3. `PRD.md §5`: AC-83 з посиланням на цю story.

## Out of scope

- Висота полів ліворуч: textarea OLX і редактор Prom свої межі вже мають.
- Вигляд і розмір спінера T66 та самих кнопок AI.
- Скрол, що синхронізує обидві половини рядка.

## DoD

- [ ] AC-83: панель пропозиції не вища за 24rem зі скролом, кнопки вгорі рядка на обох ширинах, на 360 px горизонтального скролу немає.
- [ ] Наявні тести `web` зелені без правок у `*.spec.ts`, `lint` зелений.
- [ ] Коміт: `style(web): pin the AI buttons to the top of a capped suggestion`.

## Links

- [T66](show-local-ai-progress.md) — спінер на місці кнопок поля · [T73](add-improve-button-and-tonal-ai-actions.md) — три кнопки AI біля поля · [T48](add-prom-description-editor.md) — межа висоти редактора Prom
- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 10–15 · [openapi.yaml](../contracts/openapi.yaml) — `getProduct`
