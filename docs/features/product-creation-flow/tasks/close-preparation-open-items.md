---
id: T24
title: "Закрити відкриті TBD і статус запуску при частковій відмові"
status: Done
delivery: 2
gate_profile: decision
owner: "Serhii"
estimate: S
context_budget: 3100
blocked_by: [T01]
blocks: [T26]
updated_at: "2026-09-18"
---

# T24 — Закрити відкриті TBD і статус запуску при частковій відмові

> **Гейт поставки 2.** Жодна задача T26–T33 не починається, поки цей файл не закритий:
> три з пʼяти питань впливають на схему або на форму контракту, і закривати їх під час
> реалізації означає правити міграцію після написання.

## Context

[data-model.md](../data-model.md) лишив чотири відкриті пункти, а
[api-sync-report.md](../contracts/api-sync-report.md) додав пʼятий — прогалину, якої в
`data-model.md` навіть не названо. Жоден з них не вигадується виконавцем на льоту.

**Уточнення 2026-09-12.** Пункти 1 і 4 вже закриті цим проходом разом з
[ADR 0014](../adr/0014-let-ai-recognize-the-item-from-photos.md) і
[ADR 0015](../adr/0015-add-per-field-text-rewrite-scope.md) — див. позначки нижче. Пункти
2, 3 і 5 (`price`, рейт-ліміт, статус часткової відмови) лишаються відкритими без змін.
Ця ж пара ADR додає **шосте питання**, якого раніше не було: форма ідемпотентності й
валідація тіла запиту для нової області `field` (checklist 6).

**Уточнення 2026-09-13.** Пункт 2 закрито разом із кнопкою ціни в PRD (AC-23–AC-26):
`{priceFrom, priceTo}`, десяткові рядки — вже в `openapi.yaml` і `data-model.md`.
Походження, яке звіт позначав **low**, більше не найслабша ланка: форма підтверджена й тим,
що `acceptFieldSuggestion` фізично не може писати діапазон у скалярну `price` — рішення
описане в [sad.md §4](../sad.md#4-solution-strategy), уточнення 2026-09-13, і в
[T30](add-suggestion-resolution-endpoints.md). Той самий прохід уточнив і половину пункту 4:
вхід пошуку ціни (PRD AC-27) — заголовок і, якщо він є, опис, а не `category`/`condition` —
тож «версія входу» для `price` в checklist 4 переглянута на хеш (`title`, `description`).
Новий гейт AC-27 (порожній заголовок для `scope: price`) додається в [T29](add-preparation-run-endpoints.md)
поруч із наявним AC-06. Пункти 3 і 5 лишаються відкритими без змін.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 5** — рядок, під яким і ховається пʼяте
питання: діаграма позначає цінову частину невиконаною, а колонка `status` одна на весь запуск.

> `worker->>pg: пише пропозиції текстів і usage виклику`
> `anthropic--xworker: сервіс відповів помилкою`
> `worker->>pg: позначає цінову частину невиконаною`

## Data delta

Задача сама схему не змінює — вона **вирішує, якою схема буде** в [T26](add-preparation-tables-migration.md):

| Питання | Що воно змінює в схемі |
|---|---|
| форма `value` для `price` | ✅ закрито 2026-09-13 — нічого структурно (`JSONB`), ключі `{priceFrom, priceTo}` зафіксовано в `openapi.yaml`/`data-model.md` |
| «версія входу» в `idempotency_key` | ✅ закрито — хеш `r2_key` кадрів для `texts`/`both`, хеш (`field`, `draftText`) для `field`; для `price` **переглянуто 2026-09-13** — хеш (`title`, `description`) за формулою AC-27, а не `category`/`condition` ([data-model.md](../data-model.md), Open items) |
| `status` при частковій відмові `scope: both` | **може додати колонку або таблицю** — саме тому гейт стоїть перед міграцією |
| гейт AC-06 | ✅ закрито — «немає жодного кадру», без гілки про розпізнавання |
| вікно обмеження частоти | нічого: константа `src/config.ts` |
| форма тіла запиту для `scope: field` | `field` і `draftText` у `PreparationRunCreateRequest` — `z.discriminatedUnion` за `scope` ([ADR 0015](../adr/0015-add-per-field-text-rewrite-scope.md)) |

## API contract excerpt

```yaml
      description: >-
        задачі — перевірка коштує одного читання, запуск коштує грошей (sad.md
        сценарій 7). Ідемпотентність — **не** заголовок клієнта:
        ключ (картка, область, версія входу) обчислює сервер із `idempotency_key`
        UNIQUE у `product_preparation_runs`; повторний виклик з тим самим входом
        повертає наявний запуск (`200`), а не створює новий (`201`). "Версія входу" —
        відкритий пункт data-model.md (Open items), контракт лишає його явним, а не
        ховає.
      operationId: startPreparationRun
```

## Acceptance criteria

**AC-06** (US-03) — cross-context, **формулювання закрито 2026-09-12**
**Given** у картці немає жодного кадру
**When** `user` намагається запустити підготовку текстів
**Then** система не запускає підготовку і повідомляє, що бракує хоча б одного кадру

**AC-10b** (US-03, US-04) — часткова відмова, **предмет пʼятого питання**
**Given** підготовка повернула тексти, але не повернула діапазон ціни
**When** `user` відкриває картку
**Then** система зберігає отримані тексти, показує, що ціни немає, і дозволяє запросити саму лише ціну

## Checklist

1. ✅ **Гейт AC-06.** Закрито: «немає жодного кадру» — правку внесено в [PRD §5](../PRD.md#5-acceptance-criteria) AC-06.
2. ✅ **Форма `value` для `price`.** Закрито 2026-09-13: `{priceFrom, priceTo}`, десяткові рядки — [openapi.yaml](../contracts/openapi.yaml) і `data-model.md` правлені; `acceptFieldSuggestion` виключає `field: price` (`price_suggestion_readonly`, [T30](add-suggestion-resolution-endpoints.md)).
3. ✅ **Вікно обмеження частоти запусків.** Закрито 2026-09-18: 20 запусків на картку за годину, спільні для всіх областей — [data-model.md](../data-model.md) Open items, [sad.md §8](../sad.md#8-crosscutting-concepts), `openapi.yaml` (`429`); константу в `src/config.ts` пише [T29](add-preparation-run-endpoints.md).
4. ✅ **«Версія входу».** Закрито: хеш `r2_key` кадрів для `texts`/`both` (бо саме фото тепер вхід розпізнавання, [ADR 0014](../adr/0014-let-ai-recognize-the-item-from-photos.md)); хеш (`field`, `draftText`) для `field`. Для `price` **переглянуто 2026-09-13**: хеш (`title`, `description`) за формулою AC-27 — попередній підхід (`category`, `condition`) не бачив зміни заголовка чи опису й повертав би застарілий діапазон під новим текстом картки.
5. ✅ **`status` при частковій відмові `scope: both`.** Закрито 2026-09-18 конвенцією: запуск завершується `failed` з `error_code: price_unavailable`, пропозиції текстів лишаються, ціну просить окремий `scope: price`. Колонки чи таблиці per-scope немає — схема [T26](add-preparation-tables-migration.md) не змінюється. Записано в [data-model.md](../data-model.md), [sad.md §6](../sad.md#6-runtime-view) сценарій 5, `openapi.yaml` (`PreparationRun.errorCode`), [CONTEXT.md](../CONTEXT.md), [T28](add-preparation-service.md).
6. ✅ **Валідація тіла запиту для `scope: field`.** Закрито: записано в [ADR 0015](../adr/0015-add-per-field-text-rewrite-scope.md), `openapi.yaml` (`PreparationRunCreateRequest`) і checklist 1 [T29](add-preparation-run-endpoints.md), яка його виконує. `field` і `draftText` обов'язкові лише для цієї області — `z.discriminatedUnion('scope', …)` у `contracts/ai.contract.ts`, не окрема `.optional()` пара на плоскій схемі ([ADR 0015](../adr/0015-add-per-field-text-rewrite-scope.md)).

## Out of scope

- Стеля вартості картки в грошах — інший строк і інша природа: це число зі статистики, не проєктне рішення.
- Питання «предмет з особистої колекції» — рішення власника з правовими наслідками; блокує реліз [T33](verify-delivery-2.md), не цю задачу.

## DoD

- [x] Рішення №1 (гейт AC-06) і №4 (версія входу) записані й закриті 2026-09-12 — [ADR 0014](../adr/0014-let-ai-recognize-the-item-from-photos.md), [ADR 0015](../adr/0015-add-per-field-text-rewrite-scope.md).
- [x] Рішення №2 (форма `value` для `price`) записане й закрите 2026-09-13 — `openapi.yaml`, `data-model.md`, PRD AC-23–AC-26, [T30](add-suggestion-resolution-endpoints.md).
- [x] Рішення №3, №5, №6 записані — кожне в тому документі, який його виконує.
- [x] Жодного `<!-- TBD -->` у розділі Open items [data-model.md](../data-model.md), крім пунктів 3, 5.
- [x] `unresolved_origins` у [api-sync-report.md](../contracts/api-sync-report.md) порожній, або кожен рядок має названу причину й строк.
- [x] Рішення №5, якщо воно вводить колонку, відображене в схемі **до** [T26](add-preparation-tables-migration.md), а не після.
- [x] Рішення №1/№4 пройшли гейт blast-radius (незворотне, зачіпає кілька модулів, мали живу альтернативу) — заведено [ADR 0014](../adr/0014-let-ai-recognize-the-item-from-photos.md) і [ADR 0015](../adr/0015-add-per-field-text-rewrite-scope.md), наскрізні номери після 0013.
- [x] Коміт: `docs(product-creation-flow): close the preparation open items`.

## Links

- [data-model.md, Open items](../data-model.md) · [api-sync-report.md, Section C](../contracts/api-sync-report.md)
- [sad.md §6](../sad.md#6-runtime-view), сценарії 5, 7, 8
- [CONTEXT.md](../CONTEXT.md) — «запуск підготовки», «область підготовки», «пропозиція»
