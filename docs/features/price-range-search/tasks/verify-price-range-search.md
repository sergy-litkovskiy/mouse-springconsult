---
id: T118
title: "Приймання: QG-1–QG-3 на живому стеку, ліміт і кадри"
status: Done
delivery: 2
gate_profile: verification
owner: "Serhii"
estimate: S
context_budget: 3300
blocked_by: [T116, T117, T119]
blocks: []
updated_at: "2026-10-09"
---

# T118 — Приймання: QG-1–QG-3 на живому стеку, ліміт і кадри

## Context

Закриває фічу. Прогони взято з «How verify» трьох quality goals
([sad.md §10](../sad.md#10-quality-requirements)) і з рядків PRD §6 без окремого QG. Spec-и
окремих story вже перевірили логіку з двійниками. Тут перевіряється зібрана система: `api`,
`worker`, черга, справжній Gemini і браузер.

Перед деплоєм ще одна перевірка з [events.md](../contracts/events.md) («Зворотна
сумісність»): у `pgboss.job` немає задач `price` у станах `created`/`retry`/`active`, бо payload
`price` отримав обов'язкові поля.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарії 3 і 4, які приймання проганяє наживо:

> `else мережа, 5xx, таймаут, недійсний ключ`
> `worker->>pg: finishRun failed price_unavailable + пропозиції текстів`
> `api->>pg: частковий UNIQUE на queued/running — знаходить той самий запуск`
> `api->>pg: попередній запуск завершено — новий запуск (ADR 0017 №6)`

## Data delta

Нічого не змінює, а **перевіряє** в схемі:

| Що | Де |
|---|---|
| попередня пропозиція `price` і її `created_at` не змінились після невдачі | `product_field_suggestions` |
| запуск `price` має `model` Gemini і 0 токенів, `both` — модель і токени Claude | `product_preparation_runs` |
| `error_code` кожної невдачі відповідає причині | `product_preparation_runs.error_code` |
| `products.price` не змінилась після пошуку | `products` |

## API contract excerpt

```yaml
        "429":
          description: >-
            20 запусків на картку за годину, спільних для всіх областей (PRD §1). Це ліміт
            частоти самого `api`, а не квота Gemini: вичерпану денну квоту запуск отримує
            вже у `worker` як `errorCode: price_quota_exhausted` (AC-09).
```

## Acceptance criteria

Quality goals [sad.md §10](../sad.md#10-quality-requirements):

**QG-1. Стійкість до відмови пошуку**
**Given** постачальник пошуку недоступний: недійсний ключ або вимкнена мережа `worker`
**When** запущено `price` і окремо `both`
**Then** тексти, поля картки й попередня вилка цілі, на запуск пішов 1 запит, повтору немає, код — `price_unavailable`

**QG-2. Без джерел вилки немає**
**Given** пошук знайшов вилку
**When** user дивиться на форму
**Then** поле ціни порожнє, кнопки прийняття немає, вилка має 1–5 оголошень, і ті відкриваються в новій вкладці

**QG-3. Незаблокований інтерфейс**
**Given** user натискає «Знайти ціну» чи «Згенерувати все»
**When** запуск прийнято
**Then** відгук ≤ 500 ms, `waitMs` до старту задачі ≤ 5 с, форма робоча, кнопки запусків вимкнені до кінця

## Checklist

1. QG-1, `price`: недійсний `GEMINI_API_KEY`, потім вимкнена мережа `worker`. Звірити код запуску, незмінну пропозицію `price` і кількість викликів у лозі.
2. QG-1, `both`: те саме. Тексти записано пропозиціями. Два запуски Claude коштують ≈ $0,2 ([ADR 0018](../../../adr/0018-use-sonnet-5-for-card-preparation.md)), тож лише з дозволу власника.
3. `worker` без ключа: стартує з warn, `price` закривається `price_unavailable` без запиту до Google ([sad.md §7](../sad.md#7-deployment-view)).
4. QG-2: Playwright-прохід форми після успішного пошуку. Звірити атрибути посилань і порожнє поле ціни; переглянути збережену пропозицію на картці з 10 кадрами (у запиті ≤ `maxFrames` кадрів, з логу).
5. QG-3: 10 повторів старту, тривалість з pino-логів; `waitMs` запису «job started».
6. Подвійний клік поки запуск іде повертає той самий запуск. Повтор після `failed` ставить новий.
7. 21-й запуск за годину дає `429 preparation_rate_limited`.
8. Запит до `pgboss.job` перед деплоєм (Context).
9. Обидва проходи `security-review` ([T105](add-gemini-adapter.md), [T114](show-price-range-and-listings.md)) виконано, а знахідки закрито ([PRD §6.1](../PRD.md#61-security--privacy)).

## Result — 2026-10-09: прийнято

Прогін на локальному стеку (`api`, `worker`, Postgres, `web`), коміт `91088a9`. Відмови Gemini
імітувалися оверрайдом compose лише для `worker`, а після прогону його повернено до `.env`:

- недійсний ключ: `GEMINI_API_KEY: invalid-key-for-acceptance`;
- вимкнена мережа: `extra_hosts` `generativelanguage.googleapis.com:0.0.0.0`, бо без мережі
  `worker` не бачив би й Postgres;
- без ключа: `unset GEMINI_API_KEY` перед стартом процесу.

Дефектів не знайдено.

| # | Пункт | Результат |
|---|---|---|
| 1 | QG-1, `price` | Картка «Вінтажна шкатулка» з вилкою від 15:43:02. Недійсний ключ — `price_unavailable`, `HTTP 400 API_KEY_INVALID`; вимкнена мережа — `price_unavailable`, `TypeError: fetch failed`. На кожен запуск один рядок `price search finished`, `job failed` — 0. Пропозиція `price`, її `created_at`, `products.price` (123.00) і `updated_at` не змінились |
| 2 | QG-1, `both` | Та сама картка, 2 запуски: вимкнена мережа й недійсний ключ. Обидва `failed` з `price_unavailable`, `model` `claude-sonnet-5`, 4548/989 і 4548/1008 токенів. Тексти записано пропозиціями (`created_at` 16:36:22), а вилка лишилась від 15:43:02. На кожен запуск один `price search finished` |
| 3 | `worker` без ключа | На старті `WARN: GEMINI_API_KEY is not set`, далі `worker subscribed`. Запуск `price` — `price_unavailable`, «price search is not configured». Рядка `price search finished` немає, отже до Google запиту не було |
| 4 | QG-2 | Картка з 10 кадрами «Книга "100 притч…"», 250.00. Поле ціни у формі очищено без збереження, «Знайти ціну» — `succeeded`, вилка «від 450 до 1500 ₴», 2 оголошення OLX. Після пошуку поле ціни порожнє (`value` `""`), кнопки прийняття немає, у БД `products.price` 250.00, `updated_at` від 2026-09-20. Посилання мають `target="_blank"` і `rel="noopener noreferrer"`, клік відкрив оголошення в новій вкладці. Збережена пропозиція: `priceFrom` 450, `priceTo` 1500, 2 `listings` `https://www.olx.ua/…`. Кадри: payload задачі в `pgboss.job` має лише `runId`, `scope`, `title`, `productId`, `description`, тож у запит пішло 0 кадрів (`maxFrames: 0`). Лог кадрів не пише |
| 5 | QG-3 | Картка «Набір іграшок "Пірати"». 10 стартів `price` (і всі 22 POST серії): `responseTime` у pino-лозі `api` — max 16,5 ms, медіана 12,9 ms. `waitMs` записів «job started» — max 1016 ms, медіана 587 ms. Під час запуску у формі вимкнені «Згенерувати все» й кнопки AI полів, текстові поля доступні |
| 6 | Подвійний клік | Другий POST, поки запуск `queued`, дав `200` з тим самим `id`. POST після `failed` — `201` з новим `id` |
| 7 | Ліміт | На тій самій картці запуски 1–20 — `201`, 21-й — `429` `preparation_rate_limited` |
| 8 | `pgboss.job` | На dev задач `price`/`both` у `created`/`retry`/`active` немає (0); у черзі лише `completed`. На проді той самий запит виконує людина перед деплоєм: `select count(*) from pgboss.job where data->>'scope' in ('price','both') and state in ('created','retry','active');` |
| 9 | `security-review` | T105 — PR #139: без знахідок. T114 — PR #150: без знахідок. T120 — PR #147: P0 0 · P1 0 · P2 0 |

**Спостереження без порога.** `webSearchQueries` у лозі порожній і за успішного пошуку. Так і має
бути на 3.x: `groundingMetadata` не приходить
([ADR 0026](../adr/0026-search-on-the-paid-tier-with-gemini-3-5-flash-lite.md)). Друге оголошення
вилки — подарунковий набір на 8 предметів, а не та сама книга. Чи оголошення про ту саму річ,
перевіряє лише людина (KPI [PRD §7](../PRD.md#7-metrics--kpis)), тож дефектом це не є.

**Вартість.** Claude: два `both` — $0,0382 (вартість картки зросла з $0,0394 до $0,0776). Gemini:
один успішний пошук, 1015/1879 токенів — ≈ $0,005; пошукові запити — у межах безкоштовних 5 000.
Відмови з недійсним ключем і без мережі не тарифікуються. Разом ≈ $0,043 з погоджених ≤ $0,23.

## Out of scope

- KPI першого місяця ([PRD §7](../PRD.md#7-metrics--kpis)) міряються після релізу, а не на прийманні.
- Тривалість самого виклику Gemini, бо порога на неї немає ([sad.md §10](../sad.md#10-quality-requirements), «Спостереження без порога»).

## DoD

- [x] Кожен пункт чеклиста має результат у story: число, код або посилання на лог, а не «працює».
- [x] Знайдені дефекти стали окремими story, а не правками в цій.
- [x] Коміт: `docs(price-range-search): record the acceptance run`.

## Links

- [sad.md §10](../sad.md#10-quality-requirements) · [PRD §6](../PRD.md#6-non-functional-requirements) · [PRD §6.1](../PRD.md#61-security--privacy)
