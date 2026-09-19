---
id: T28
title: "Сервіс підготовки: тексти, діапазон ціни, запис usage"
status: Blocked
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2800
blocked_by: [T26, T27]
blocks: [T29]
updated_at: "2026-09-15"
---

# T28 — Сервіс підготовки: тексти, діапазон ціни, запис `usage`

## Context

Обробник задачі, який виконується у `worker`. Робить те, заради чого написана вся фіча:
одним запуском розпізнає товар за фото й готує опис під Prom із ключовими словами, опис під
OLX і орієнтовний діапазон ціни (US-03, US-04, [ADR 0014](../adr/0014-let-ai-recognize-the-item-from-photos.md)).
Четверта область, `field`, готує один рядок з чернетки без фото (US-10,
[ADR 0015](../adr/0015-add-per-field-text-rewrite-scope.md)) — менший, але той самий
обробник задачі, той самий шлях запис-пропозиції-і-usage.

Ключова властивість — **кожен результат є окремим записом**
([ADR 0006](../adr/0006-store-generated-values-as-separate-suggestions.md)). Саме тому
часткова відмова не втрачає нічого зі здобутого.

**Уточнення 2026-09-13 (AC-27).** Для `scope: price` саме тут, а не в маршруті ([T29](add-preparation-run-endpoints.md)),
складається запит до моделі: `worker` читає `titleProm`/`titleOlx` і
`descriptionProm`/`descriptionOlx` картки й будує текст за формулою `title = titleProm ??
titleOlx`, `description = descriptionProm ?? descriptionOlx`, `query = description ? "${title}
${description}" : title`. Той самий розподіл ролей, що й для `texts`/`both`: маршрут лише
гейтить дешевою перевіркою (AC-06 рахує кадри, AC-27 перевіряє заголовок), а важке читання
входу — тут, при виконанні задачі.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 5** — цілком, це і є контракт задачі:

> `worker->>anthropic: просить тексти під обидва майданчики`
> `worker->>pg: пише пропозиції текстів і usage виклику`
> `worker->>anthropic: просить діапазон ринкових цін`
> `anthropic--xworker: сервіс відповів помилкою`
> `worker->>pg: позначає цінову частину невиконаною`

та **сценарій 8** — побудова запиту ціни з заголовка й опису:

> `worker->>pg: читає titleProm/titleOlx і descriptionProm/descriptionOlx картки`
> `worker->>worker: складає запит — заголовок (Prom, інакше OLX) і, якщо є, опис (Prom, інакше OLX) (AC-27)`

Плюс **сценарій 7** (тексти) як окрема область.

## Data delta

| Таблиця | Зміна |
|---|---|
| `product_preparation_runs` | +1 рядок на запуск; `status` `queued` → `running` → `succeeded`/`failed`; `model`, `input_tokens`, `output_tokens` на кожен виклик |
| `product_field_suggestions` | +1 рядок **на кожне поле**: `description_prom`, `description_olx`, `seo_keywords`, `price` — окремими записами |
| `products` | **не змінюється жодним рядком** — модель ніколи не пише в картку ([ADR 0006](../adr/0006-store-generated-values-as-separate-suggestions.md)) |

## API contract excerpt

```yaml
        field:
          type: string
          enum: [titleProm, titleOlx, descriptionProm, descriptionOlx, seoKeywords, price]
        value:
          description: >-
            Рядок для title*/description*, масив рядків для seoKeywords,
            {priceFrom, priceTo} для price (десяткові рядки, як і products.price).
```

## Acceptance criteria

**AC-05** (US-03) — happy path
**Given** у картці є принаймні один кадр
**When** `user` запускає підготовку текстів
**Then** система розпізнає товар із головного кадру, зберігає опис під Prom, ключові слова під Prom і опис під OLX і показує їх для правки

**AC-10b** (US-03, US-04) — часткова відмова
**Given** підготовка повернула тексти, але не повернула діапазон ціни
**When** `user` відкриває картку
**Then** тексти лишаються пропозиціями, ціни немає, і її можна запросити окремо

**AC-28** (US-03, US-04, US-10) — domain invariant
**Given** модель повернула результат будь-якої області
**When** запуск стає видимим для полінгу як завершений
**Then** пропозиції цього запуску вже лежать у таблиці — стану «запуск завершено, пропозицій ще немає» не існує

## Checklist

1. Репозиторій запусків і пропозицій у `modules/products/` — вставка запуску, зміна статусу, вставка пропозицій, сума токенів на картку.
2. Сервіс у `modules/ai/` — бере задачу; для `texts`/`both` тягне до 3 кадрів і кличе адаптер, який розпізнає товар і повертає тексти, пише пропозиції й `usage`, потім кличе по ціну, пише окремо; для `price` (самостійно чи в складі `both`) читає `titleProm`/`titleOlx`/`descriptionProm`/`descriptionOlx` картки, складає запит формулою AC-27 (`title = titleProm ?? titleOlx`, `description = descriptionProm ?? descriptionOlx`, з описом коли він є) і передає його в `web_search`; для `field` кадрів не читає взагалі — кличе text-only метод адаптера з `draftText` задачі й пише одну пропозицію.
3. Обробка часткової відмови — за рішенням №5 з [T24](close-preparation-open-items.md).
4. `src/worker.ts` — реєстрація обробника.
5. `contracts/events.md` — тепер має предмет: producer, consumer, retry, поведінка після вичерпаного `retryLimit`.
6. `*.spec.ts` — двійники адаптера як підкласи з `override`: успіх обох викликів, відмова цінового, відмова обох.

## Out of scope

- HTTP-маршрути — [T29](add-preparation-run-endpoints.md). Сервіс про HTTP не знає.
- Прийняття пропозицій у поля картки — [T30](add-suggestion-resolution-endpoints.md).
- Стеля вартості в грошах — відкрите питання; тут лише токени.

## DoD

- [ ] AC-05: запуск дає опис під Prom, ключові слова й опис під OLX — **трьома окремими записами**, не одним.
- [ ] AC-08, AC-27: запит до `web_search` складається з заголовка (Prom, інакше OLX) і, якщо він є, опису (Prom, інакше OLX) — перевірено тестом на всіх чотирьох комбінаціях наявності title/description; ціна приходить діапазоном «від — до».
- [ ] Повторна спроба pg-boss (`config.queue.preparation.retryLimit`) працює з тим самим рядком запуску, тож **додає** свої токени до `input_tokens`/`output_tokens`, а не перезаписує їх — інакше вартість картки (AC-14) не врахує вже оплачену спробу. Тест на двійнику: дві спроби дають суму обох. Знахідка `critical-path-review` T26.
- [ ] AC-10b: коли ціновий виклик падає, тексти лишаються пропозиціями, а запуск завершується `failed` з `error_code: price_unavailable` (рішення №5 [T24](close-preparation-open-items.md)) — тест на двійнику.
- [ ] AC-14: `model`, `input_tokens`, `output_tokens` записані для **кожного** виклику, не для запуску загалом.
- [ ] AC-28: вставка пропозицій і перехід запуску в `succeeded` — одна транзакція; тест на двійнику, що падає між ними, лишає запуск незавершеним і без пропозицій.
- [ ] Модель не пише в `products` у жодній гілці — перевірено тестом, не оком.
- [ ] `events.md` створено й описує реальну задачу, а не намір.
- [ ] Коміт: `feat(ai): add the card preparation service`.

## Links

- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-05, AC-08, AC-10, AC-10b, AC-14, AC-27, AC-28
- [ADR 0006](../adr/0006-store-generated-values-as-separate-suggestions.md) · [sad.md §6](../sad.md#6-runtime-view), сценарії 5, 7, 8
- [CONTEXT.md](../CONTEXT.md) — «пропозиція», «область підготовки», «вартість картки»
