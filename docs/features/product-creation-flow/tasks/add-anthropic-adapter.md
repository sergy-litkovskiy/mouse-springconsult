---
id: T27
title: "Адаптер Anthropic і оптимізація кадру через sharp"
status: Blocked
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1800
blocked_by: [T25]
blocks: [T28]
updated_at: "2026-09-18"
---

# T27 — Адаптер Anthropic і оптимізація кадру через sharp

## Context

Модуль `ai` існує в репозиторії самим `CLAUDE.md` — і цей `CLAUDE.md` уже містить майже всі
рішення, які лишається виконати. Задача не вигадує нічого: вона переносить його рядки в код
і в `src/config.ts`.

`sharp` повертається в поставку 2 не заради похідних розмірів (їх немає взагалі,
[ADR 0011](../adr/0011-store-only-the-original-frame.md)), а як **оптимізація кадру перед
викликом моделі** — свідоме зменшення рахунку.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 7** — крок, у якому кадр іде в модель:

> `worker->>r2: читає до трьох кадрів картки`
> `worker->>anthropic: просить тексти під обидва майданчики`
> `anthropic-->>worker: тексти`

## Data delta

**Немає власної.** Адаптер бази не бачить. Але дві колонки
[data-model.md](../data-model.md) існують саме заради його відповіді:

| Колонка | Що в неї пише адаптер (через [T28](add-preparation-service.md)) |
|---|---|
| `product_preparation_runs.model` | без нього токени не перевести в гроші, коли зʼявиться стеля |
| `input_tokens`, `output_tokens` | `usage` виклику — вимога `ai/CLAUDE.md` |

## API contract excerpt

```yaml
        model: { type: string, example: claude-sonnet-5 }
        inputTokens: { type: integer, minimum: 0 }
        outputTokens: { type: integer, minimum: 0 }
```

## Acceptance criteria

**AC-08** (US-04) — happy path
**Given** у картці є заголовок — `titleProm` або `titleOlx`
**When** `user` запитує ціну
**Then** модель повертає орієнтовний діапазон «від — до» і посилання на джерела, а не вигадану цифру

**AC ([modules/ai/CLAUDE.md](../../../../apps/api/src/modules/ai/CLAUDE.md), «Без зайвого форматування»)**
**Given** модель повернула текст
**When** він зберігається
**Then** це plain text — без Markdown, емодзі й обгорток «Ось ваш опис:»

## Checklist

1. `apps/api/package.json` — `sharp`, `@anthropic-ai/sdk`.
2. `src/config.ts` — константи з `ai/CLAUDE.md`: модель `claude-sonnet-5`, `effort` і `max_uses` пошуку **окремо на кожен виклик** — тексти, ціна, поле; старт — `effort: low` усюди, `max_uses: 2` ([ADR 0004](../../../adr/0004-use-sonnet-5-for-card-preparation.md)); довша сторона ≤ 1568 px, JPEG q80, sRGB, EXIF вирізано, максимум **3 кадри** на запит.
3. `src/config.ts` `envSchema` — `ANTHROPIC_API_KEY`; `.env.example`; проброс у сервіс `worker`.
4. Адаптер у `modules/ai/` — structured outputs (`output_config.format` з JSON-схемою), adaptive thinking без `budget_tokens`, `output_config.effort` з константи виклику, `stop_reason` перевіряється до читання відповіді, server tool `web_search_20260209` з `user_location` = UA для цін; повертає `usage`. Метод ціни приймає вже складений текст запиту (`title`/`description`) як параметр — сам їх не читає й не компонує, це робить [T28](add-preparation-service.md) за формулою AC-27; адаптер про `products` не знає нічого.
5. Оптимізація кадру через sharp перед відправкою.
6. **Розпізнавання в тому самому виклику.** Метод для `texts`/`both` повертає розпізнаний факт як частину structured-output схеми відповіді (не окремим полем БД) — адаптер його не персистує, лише повертає викликачу ([ADR 0014](../adr/0014-let-ai-recognize-the-item-from-photos.md)).
7. **Text-only метод для `scope: field`.** Без зображень: приймає `field` і `draftText`, повертає один рядок/масив (залежно від поля) і `usage`; той самий шлях structured outputs, plain text, без Markdown ([ADR 0015](../adr/0015-add-per-field-text-rewrite-scope.md)).
8. **Без мережі за замовчуванням.** Тести й локальний стек працюють з фейковим адаптером або записаною відповіддю; `ANTHROPIC_API_KEY` немає ні в тестах, ні в CI. Живий виклик вмикається свідомо — механізм перемикання визначає ця задача.
9. **Ключ розробки** — з окремого workspace у Claude Console з лімітом витрат $10 на місяць; ключ проду — з іншого workspace. Зазначити в `.env.example`.
10. **Прогін на 3–5 реальних товарах замовника** перед закриттям задачі (≈ $0.30–0.50, запуск — з дозволу). Якщо розпізнавання помиляється — кроки з ADR 0004: `effort: medium` на виклику розпізнавання, потім Opus 5 лише на ньому.

## Out of scope

- Бізнес-логіка підготовки — [T28](add-preparation-service.md). Адаптер не знає слова «картка».
- Запис у таблиці — [T28](add-preparation-service.md).
- Похідні розміри для галереї — їх немає; sharp тут лише для моделі.

## DoD

- [ ] SDK Anthropic не згадується в жодному файлі поза адаптером — `deps:check` зелений.
- [ ] Кадр перед відправкою справді зменшений: перевірено розміром байтів до і після, не припущено.
- [ ] Відповідь зберігається plain text.
- [ ] `usage` повертається з кожного виклику; ключ Anthropic не потрапляє в лог у жодній гілці.
- [ ] Модель і `effort` кожного виклику — константи `config.ts`, а не env-змінні: заміна має проходити через коміт і рев'ю.
- [ ] Тести зелені без `ANTHROPIC_API_KEY` у середовищі.
- [ ] Прогін на реальних товарах виконано, результат і `usage` записано в story.
- [ ] На один запит іде не більше трьох кадрів — перевірено тестом на картці з десятьма.
- [ ] Коміт: `feat(ai): add the Anthropic adapter with image optimisation`.

## Links

- [apps/api/src/modules/ai/CLAUDE.md](../../../../apps/api/src/modules/ai/CLAUDE.md) — усі рішення дослівно
- [ADR 0004](../../../adr/0004-use-sonnet-5-for-card-preparation.md) — модель, `effort` на виклик, бюджет розробки
- [sad.md §7](../sad.md#7-deployment-view) · [sad.md §2](../sad.md#2-constraints)
- [CONTEXT.md](../CONTEXT.md) — «розпізнавання», «вартість картки»
