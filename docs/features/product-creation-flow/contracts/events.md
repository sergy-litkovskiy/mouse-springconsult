---
status: Draft
owner: "Serhii"
reviewers: []
updated_at: "2026-09-19"
feature_size: M
stage: "05"
---

# Events — product-creation-flow

Черга — pg-boss поверх PostgreSQL, у схемі `pgboss` тієї самої бази, що й картки (CLAUDE.md:
«Не додаємо Redis/RabbitMQ»). Окремого DLQ немає. Задача, що вичерпала спроби, лишається
рядком у стані `failed` у таблиці pg-boss. Людина бачить не цей рядок, а запуск
підготовки, який обробник закриває сам (див. «Після вичерпаного `retryLimit`»).

## Job: `product-preparation`

**Producer:** маршрут `POST /products/{productId}/preparation-runs` ([T29](../tasks/add-preparation-run-endpoints.md)).
Спершу він вставляє рядок `product_preparation_runs` зі `status: queued`, потім ставить задачу
з `runId` цього рядка. Відповідь не чекає на модель.
**Consumer:** `apps/api/src/worker.ts` → `PreparationService.prepare` з `modules/ai/index.ts`
([T28](../tasks/add-preparation-service.md)).
**Налаштування черги:** `config.queue.preparation` у `apps/api/src/config.ts`, а не опції
`send()`. `startQueue` приводить до них рядок черги на кожному старті:

| Параметр | Значення | Чому |
|---|---|---|
| `retryLimit` | `2` | до трьох спроб; кожна повторна спроба `texts`/`both` платить за виклик ще раз |
| `retryDelay` · `retryBackoff` | `10` с · `true` | перехідна відмова сервісу рідко минає за секунду |
| `expireInSeconds` | `300` | спроба, активна довше, вважається мертвою, і pg-boss її повторює |
| `pollingIntervalSeconds` | `1` | задача має стартувати за 5 с (PRD §6) |

**Ідемпотентність:** `idempotency_key` рахує сервер із (картка, область, версія входу).
UNIQUE-індекс у `product_preparation_runs` не дає другому однаковому запуску ні рядка, ні
задачі. Сам pg-boss exactly-once за бізнес-ключем не гарантує. Повторна спроба pg-boss
працює з **тим самим** рядком запуску: `recordUsage` додає токени спроби до вже записаних
(`input_tokens + :n`), тож вартість картки (AC-14) враховує й оплачену невдалу спробу.

### Payload

Тип — `PreparationJob` з `apps/api/src/modules/ai/PreparationService.ts`:

```json
{ "runId": "<uuid>", "productId": "<uuid>", "scope": "texts" }
```

```json
{
  "runId": "<uuid>",
  "productId": "<uuid>",
  "scope": "field",
  "field": "descriptionOlx",
  "draftText": "<чернетка поля з форми>"
}
```

**Обовʼязкові поля:** `runId`, `productId`, `scope`. Для `scope: field` також `field`
(`titleProm | titleOlx | descriptionProm | descriptionOlx | seoKeywords`) і `draftText`.
Кадрів і текстів картки payload не несе: `worker` читає їх сам під час виконання
(сценарії 5 і 8 у [sad.md §6](../sad.md#6-runtime-view)). Тож payload лишається малим, а
модель бачить картку такою, якою вона є на момент старту спроби.
**Політика зворотної сумісності:** лише нові опційні поля. Видалення чи перейменування —
нова назва черги (`product-preparation-v2`), а стара живе, поки в ній є задачі.

### Результат спроби

| Що сталося | Запуск | Пропозиції | pg-boss |
|---|---|---|---|
| Усі виклики області вдалися | `succeeded` | усі, однією транзакцією зі статусом (AC-28) | `completed` |
| `both`: тексти є, ціновий виклик упав | `failed`, `price_unavailable` | лише тексти (AC-10b) | `completed`, без повтору |
| `price`: ціновий виклик упав | `failed`, `price_unavailable` | немає | `completed`, без повтору |
| Упав виклик текстів чи `field`, або запис | лишається `running` | немає | `retry` |
| Те саме на останній спробі | `failed`, `model_unavailable` | немає | `failed` |

Ціновий збій повтору не отримує: тексти вже оплачено, а ціну людина просить окремим
`scope: price` (AC-10b, AC-23).

### Після вичерпаного `retryLimit`

Обробник у `worker.ts` бачить `job.retryCount >= job.retryLimit`, кличе
`PreparationService.abandon(runId)` і кидає помилку далі. `abandon` закриває запуск як
`failed` з `error_code: model_unavailable` без пропозицій. Без цього запуск лишився б
`running` назавжди, і полінг фронту ніколи б не дізнався, що підготовка не відбулась (AC-10).

**Відома межа.** Якщо останню спробу вбило `expireInSeconds` (процес `worker` упав
посеред виклику), обробник свого `catch` не виконує, і запуск лишається `running`. Для
одного `worker` це рідкість, і повтор тут є дією людини. Закривати таку підготовку
окремим обходом «завислих» запусків поки не будемо.

## Стан і полінг

Фронт стежить за рядком `product_preparation_runs` (`status`, `error_code`) через
`GET /products/{productId}/preparation-runs/{runId}`. Id задачі pg-boss межу API не
перетинає.

## Спостережуваність

- pino в `worker`: `job started` (з `waitMs` — очікування в черзі), `job finished`,
  `job failed` (з `retryCount` і помилкою). Кожен рядок несе `jobId`, `runId` і `scope`.
  Тіла payload не логуються, бо `draftText` — текст людини.
- Задачі в `failed` видно ручним запитом до схеми `pgboss`. Дашборда для двох адмінів не
  заводимо.
