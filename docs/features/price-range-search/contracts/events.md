---
status: Draft
owner: "Serhii"
reviewers: []
updated_at: "2026-10-08"
feature_size: M
stage: "05"
---

# Events — price-range-search

Нової задачі фіча не додає. Черга, `config.queue.preparation`, `retryLimit`, обхід завислих
запусків і «id задачі = id запуску» лишаються такими, як описано в
[events.md product-creation-flow](../../product-creation-flow/contracts/events.md). Тут лише
дельта задачі `product-preparation`: що несе payload `price` і чим закінчується спроба, коли
ціну шукає Gemini.

## Job: `product-preparation` — дельта

**Producer:** `POST /products/{productId}/preparation-runs` (`PreparationRunService.start`).
**Consumer:** `apps/api/src/worker.ts` → `PreparationService.prepare` з `modules/ai/index.ts`;
`worker` створює `GeminiAdapter` лише тоді, коли задано `GEMINI_API_KEY` (sad.md §7).

### Payload

Тип — `PreparationJob` з `apps/api/src/modules/ai/PreparationService.ts`. Змінюється лише
гілка `price`: вона несе пару, яку обрав `api`, і `worker` картку для пошуку не читає
([ADR 0021](../adr/0021-search-prices-from-the-run-input-not-the-saved-card.md) №3).

```json
{
  "runId": "<uuid>",
  "productId": "<uuid>",
  "scope": "price",
  "title": "<назва Prom, інакше OLX — з чернетки, обрізана>",
  "description": "<опис Prom, інакше OLX — текст після draftPlainText, обрізаний>"
}
```

```json
{ "runId": "<uuid>", "productId": "<uuid>", "scope": "both" }
```

**Обов'язкові поля:** `runId`, `productId`, `scope`. Для `scope: price` — також `title` і
`description`, обидва непорожні: порожню пару `api` відхиляє з `409` ще до постановки задачі.
Payload `both` не змінюється: пару для пошуку `worker` бере з щойно отриманих текстів того
самого запуску (`titleProm`/`descriptionProm`, інакше OLX). Кадри, якщо замір їх лишить
(`config.ai.priceSearch.maxFrames`, 0–3), `worker` читає з R2 сам, як і для текстів.

**Зворотна сумісність.** Політика черги дозволяє додавати лише опційні поля, а тут для `price`
з'являються два обов'язкові. Виняток спирається на факт, а не на припущення: кнопку ціни
вимкнено з 2026-09-20, і `web` задач `price` не ставить. Перед деплоєм це варто підтвердити
запитом до `pgboss.job` (немає `price` у станах `created`/`retry`/`active`). Нова назва черги не
потрібна.

### Результат спроби

Рядки, яких немає в таблиці, не змінюються (product-creation-flow events.md, «Результат
спроби»). Відмову Gemini `PreparationService` класифікує сам і закриває запуск без throw, тож
pg-boss її не повторює. SDK працює без `retryOptions`, і на спробу йде рівно один запит до Google
([ADR 0023](../adr/0023-classify-price-search-failures-and-never-retry-them.md)).

| Що сталося | Запуск | Пропозиції | pg-boss |
|---|---|---|---|
| `price`: вилка пройшла zod-розбір та інваріант | `succeeded` | `price` з `listings`, upsert за (`product_id`, `field`) | `completed` |
| `both`: тексти й вилка | `succeeded` | тексти й `price` однією транзакцією | `completed` |
| Відповідь не розібралась: немає 1–5 оголошень `http(s)` ≤ 2048 символів, межа ≤ 0 чи `priceFrom > priceTo` | `failed`, `price_not_found` | `price`: немає; `both`: лише тексти | `completed`, без повтору |
| 429 з ознакою добової квоти | `failed`, `price_quota_exhausted` | `price`: немає; `both`: лише тексти | `completed`, без повтору |
| Мережа, 5xx, таймаут, недійсний ключ, відмова моделі, `GeminiAdapter` не створено | `failed`, `price_unavailable` | `price`: немає; `both`: лише тексти | `completed`, без повтору |
| Gemini відповів, але впав запис результату | лишається `running` | немає | `retry` — повтор робить **другий** запит до Google (ADR 0023, Neutral; рядок Low у sad.md §11) |

Невдалий пошук пропозиції `price` не пише, тож попередня вилка в картці лишається (AC-08, AC-10).
Помилки поза викликом Gemini (кадри з R2, БД) кидаються й повторюються, як і раніше. На
останній спробі `abandon` закриває запуск з `preparation_failed`.

**Облік.** Запуск `price` створюється з `model` = `config.ai.priceSearch.model` і токенами 0;
у `both` виклик Gemini `recordUsage` не кличе
([ADR 0025](../adr/0025-keep-gemini-calls-out-of-the-token-ledger.md)).

## Спостережуваність

Поруч з наявними `job started` / `job finished` / `job failed` `worker` пише рядок пошуку:
`runId`, модель, код результату, `webSearchQueries` і токени виклику Gemini (ADR 0024, ADR 0025).
Пару `title`/`description` у лог не пишемо: payload не логується з тієї ж причини, що й
`draftText`. На старті без ключа — `warn` «GEMINI_API_KEY is not set».
