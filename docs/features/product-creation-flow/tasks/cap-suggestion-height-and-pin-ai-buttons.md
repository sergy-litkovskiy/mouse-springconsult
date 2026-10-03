---
id: T93
title: "Кнопки AI вгорі, пропозиція з межею висоти"
status: Done
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 2400
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

Рішення власника 2026-10-03: поки поле й пропозиція стоять поруч, панель пропозиції має висоту
поля ліворуч і власний скрол, тож обидві половини рядка однакові, а висоту рядка задає поле.
Пропозиція рядок не розтягує (`contain: size` на `.suggestion__value`), тому кнопкам нема куди
з'їжджати; `.suggestion__buttons` — `justify-content: flex-start`, кнопки біля верхнього краю
поля. Спінер [T66](show-local-ai-progress.md) (`.suggestion__working`) тримає місце двох кнопок
і зсуву не дає, тож лишається як є.

Перша версія цього рішення того ж дня ставила панелі межу 24rem, як у редактора Prom. Власник
обрав висоту поля: поруч стоять половини однакової висоти. Ціна — вікно довгої пропозиції
«Опису для OLX» дорівнює textarea ліворуч (`rows="6"`, ≈ 152 px), а не 384 px.

Коли пара переноситься (діалог вужчий за дві половини по 20rem і проміжок 16px з
`product-form.css`), поля поруч немає, і рівнятися нема на що. Тоді панель має висоту за
вмістом, але не більше 24rem (`max-height`, `box-sizing: border-box`), і власний скрол. Межу
переносу компонент читає з ширини рядка пари: `.card-form__paired` — іменований контейнер
`card-pair`, а `suggestion-field.css` вмикає висоту поля через `@container`.

## Sequence

Власного сценарію немає: це верстка `app-suggestion-field`, запити не змінюються. Так само
[sad.md §6](../sad.md#6-runtime-view) описує стан форми:

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Немає.** Правка торкається лише `suggestion-field.css` і `product-form.css` (контейнер рядка пари).

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
**Given** `user` відкриває на екрані шириною 1280 px картку, де пропозиція «Опису для OLX» довша за поле ліворуч
**When** форма відмальована
**Then** панель пропозиції має висоту поля ліворуч і власний вертикальний скрол, а кнопки біля поля стоять угорі рядка, на рівні верхнього краю панелі

**AC-83 — edge case (коротка пропозиція)**
**Given** пропозиція поля коротка (назва для Prom, ключові слова) або її ще немає
**When** форма відмальована
**Then** панель так само має висоту поля ліворуч, а кнопки біля поля стоять на рівні її верхнього краю

**AC-83 — edge case (вузький екран)**
**Given** та сама картка з довгою пропозицією на екрані шириною 360 px
**When** форма відмальована
**Then** панель переноситься під поле, має висоту за вмістом, але не більше 24rem (384 px), і власний скрол, а діалог не має горизонтального скролу

## Checklist

1. `product-form.css`: `.card-form__paired` — `container: card-pair / inline-size`.
2. `suggestion-field.css`: `:host` — `display: flex`, `.suggestion` — `flex: 1 1 auto`, щоб панель брала висоту рядка; `.suggestion__buttons` — `justify-content: flex-start` замість `center`; `.suggestion__value` — `max-height: 24rem`, `overflow-y: auto` і `box-sizing: border-box` (без нього padding і рамка додають до межі 18 px); `@container card-pair (width >= calc(40rem + 16px))` — `.suggestion__value` з `contain: size` і `max-height: none`. `.suggestion__working`, кольори й решту правил не чіпати.
3. `pw` на живому стеку без платних викликів: довгу пропозицію «Опису для OLX» (40 абзаців) підставити через `page.route` на `GET /api/products/<id>`. На 1280 і 800 px для `titleProm`, `titleOlx`, `descriptionProm`, `descriptionOlx` і `seoKeywords` висота `.suggestion__value` в межах 1 px від висоти лівої половини пари, у `descriptionOlx` `scrollHeight > clientHeight`. На 700 і 360 px пара перенесена, а `.suggestion__value` поля `descriptionOlx` ≤ 384 px зі скролом. На всіх ширинах верх першої кнопки поля в межах 1 px від верху панелі; на 360 px `scrollWidth <= clientWidth` діалогу. Знімки рядка на 1280 і 360 px.
4. `PRD.md §5`: AC-83 з посиланням на цю story.

## Out of scope

- Висота полів ліворуч: textarea OLX і редактор Prom свої межі вже мають.
- Вигляд і розмір спінера T66 та самих кнопок AI.
- Скрол, що синхронізує обидві половини рядка.

## DoD

- [x] AC-83: поруч з полем панель має його висоту й скрол, перенесена — не вища за 24rem; кнопки вгорі рядка на всіх ширинах, на 360 px горизонтального скролу немає.
- [x] Наявні тести `web` зелені без правок у `*.spec.ts`, `lint` зелений.
- [x] Коміт: `style(web): match the suggestion panel to the height of its field`.

## Links

- [T66](show-local-ai-progress.md) — спінер на місці кнопок поля · [T73](add-improve-button-and-tonal-ai-actions.md) — три кнопки AI біля поля · [T48](add-prom-description-editor.md) — межа висоти редактора Prom
- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 10–15 · [openapi.yaml](../contracts/openapi.yaml) — `getProduct`
