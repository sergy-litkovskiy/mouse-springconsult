---
id: T27
title: "Адаптер Anthropic і оптимізація кадру через sharp"
status: Done
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2900
blocked_by: [T25]
blocks: [T28]
updated_at: "2026-09-19"
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

- [x] SDK Anthropic не згадується в жодному файлі поза адаптером — `deps:check` зелений.
- [x] Кадр перед відправкою справді зменшений: перевірено розміром байтів до і після, не припущено.
- [x] Відповідь зберігається plain text.
- [x] `usage` повертається з кожного виклику; ключ Anthropic не потрапляє в лог у жодній гілці.
- [x] Модель і `effort` кожного виклику — константи `config.ts`, а не env-змінні: заміна має проходити через коміт і рев'ю.
- [x] Тести зелені без `ANTHROPIC_API_KEY` у середовищі.
- [x] Прогін на реальних товарах виконано, результат і `usage` записано в story.
- [x] На один запит іде не більше трьох кадрів — перевірено тестом на картці з десятьма.
- [x] Коміт: `feat(ai): add the Anthropic adapter with image optimisation`.

## Live run (2026-09-19)

Чотири реальні фото Олени (`export-products-18-09-26_Helen.xlsx`: книга, пов'язка, підвіска-сердечка,
сукня) через `generateTexts` + `findPriceRange` з реальним dev-ключем. Одноразовий скрипт видалено
після прогону (не входить у поставку — сам адаптер тестами вкритий, прогін лише підтверджує
контракт з живим API).

**Розпізнавання й тексти** — всі чотири впізнані точно (назва й автор книги, колір/матеріал
пов'язки, деталі декору підвіски, крій і тканина сукні), опис plain text без Markdown/емодзі,
українською, обидва майданчики різні за тоном.

**Дві знахідки, які змінили код:**

1. `user_location: { country: 'UA' }` — провайдер пошуку відповідає 400 `Country code UA is not
   supported`. Замінено на `timezone: 'Europe/Kyiv'` (`config.ts`, `ai/CLAUDE.md`) — той самий намір
   локалізації, підтриманий провайдером. Локалізацію «в Україні, у гривнях» несе сам текст запиту.
2. Для 2 із 4 товарів (пов'язка, сердечка) модель повернула **порожній** `priceFrom`/`priceTo` і
   `sources: []` замість помилки — валідна відповідь за схемою, не `stop_reason: refusal` і не
   `parsed_output: null`. T28 має рахувати порожній рядок як «діапазону немає» (AC-10b), а не як
   успішну пропозицію ціни.

**Вартість:** $0.65 на 4 товари (≈ $0.16/товар за тексти + ціну разом) — вище за оцінку ADR 0004
($0.08–0.10/картку). Різниця — вартість вхідних токенів вмісту сторінок, які `web_search`
підвантажує в контекст (45–100k вхідних токенів на ціновий виклик, ADR 0004 рахував лише сам
пошук). Токени й модель — у виводі кожного виклику; рахунок вище зафіксовано тут, а не в таблиці
ADR 0004, щоб не редагувати Accepted-рішення заднім числом.

## Links

- [apps/api/src/modules/ai/CLAUDE.md](../../../../apps/api/src/modules/ai/CLAUDE.md) — усі рішення дослівно
- [ADR 0004](../../../adr/0004-use-sonnet-5-for-card-preparation.md) — модель, `effort` на виклик, бюджет розробки
- [sad.md §7](../sad.md#7-deployment-view) · [sad.md §2](../sad.md#2-constraints)
- [CONTEXT.md](../CONTEXT.md) — «розпізнавання», «вартість картки»
