---
status: Draft
owner: "Serhii"
reviewers: []
updated_at: "2026-09-20"
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
| `superviseIntervalSeconds` · `monitorIntervalSeconds` | `60` с · `60` с | дефолти pg-boss, задані явно: з них виведено поріг завислого запуску, і новий дефолт у мінорному релізі зсунув би його непомітно |

**Ідемпотентність:** `idempotency_key` рахує сервер із (картка, область, версія входу).
UNIQUE-індекс у `product_preparation_runs` не дає другому однаковому запуску ні рядка, ні
задачі. Індекс частковий — `WHERE status <> 'failed'`: він захищає від другої оплати того
самого результату, а відмовлений запуск результату не має, тож повтор того самого входу
після `failed` — новий рядок і нова задача (AC-10, AC-37). Сам pg-boss exactly-once за бізнес-ключем не гарантує. Повторна спроба pg-boss
працює з **тим самим** рядком запуску: `recordUsage` додає токени спроби до вже записаних
(`input_tokens + :n`), тож вартість картки (AC-14) враховує й оплачену невдалу спробу.

**Id задачі = id запуску.** Рядок запуску і задача пишуться двома записами. Якщо `send` не
дійшов, запуск лишається `queued`. Повторний запит з тим самим входом бачить це й ставить
задачу ще раз. pg-boss ігнорує другий `send` з тим самим `id` (`ON CONFLICT DO NOTHING`,
перевірено на живій базі 2026-09-19), тож задача однаково виконується один раз. Повторний
запит ліміту частоти не витрачає: наявний запуск повертається раніше, ніж рахується ліміт.

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
| Те саме на останній спробі | `failed`, `preparation_failed` | немає | `failed` |
| Повторна доставка після вже закоміченого завершення | не змінюється | не змінюються | `completed`, модель не викликається |

Ціновий збій повтору не отримує: тексти вже оплачено, а ціну людина просить окремим
`scope: price` (AC-10b, AC-23).

### Після вичерпаного `retryLimit`

Обробник у `worker.ts` бачить `job.retryCount >= job.retryLimit`, кличе
`PreparationService.abandon(runId)` і кидає помилку далі. `abandon` закриває запуск як
`failed` з `error_code: preparation_failed` без пропозицій. Без цього запуск лишився б
`running` назавжди, і полінг фронту ніколи б не дізнався, що підготовка не відбулась (AC-10).

### Обхід завислих запусків

`abandon` викликається лише з `catch` обробника, тож двома шляхами до нього не доходить:
останню спробу вбило `expireInSeconds` (процес `worker` упав посеред виклику — pg-boss
позначає задачу простроченою без жодного `catch`), або впав сам `abandon`. В обох випадках
запуск лишився б `queued`/`running` назавжди.

Обидва шляхи закриває обхід у `worker.ts` ([T52](../tasks/close-stuck-preparation-runs.md)):
`PreparationService.closeStuckRuns` раз на `stuckSweepIntervalSeconds` (60 с) і один раз
одразу на старті процесу — щойно піднятий `worker` є саме тим моментом, коли на закриття
чекають запуски, полишені його попередньою смертю. Запуск, старший за
`stuckAfterSeconds`, стає `failed` з `error_code: preparation_failed` без пропозицій — тим
самим кодом, що й вичерпаний `retryLimit`, бо для фронту це та сама подія (AC-39).

Поріг виведений з `config.queue.preparation`, а не вписаний числом: повна серія
`retryLimit + 1` спроб, кожна по `expireInSeconds` плюс час, за який pg-boss її прострочення
помітить, паузи між спробами (з `retryBackoff` кожна наступна вдвічі довша) і запас на полінг
та на сам період обходу — ≈22,5 хв за нинішніх значень. Час виявлення входить у поріг не про
запас: `failJobsByTimeout` виконується в проході monitor, який тікає таймером supervise і
гейтиться `monitorIntervalSeconds`, тож спроба живе до двох таких інтервалів понад свій
`expireInSeconds`. Обидва інтервали задані в `config.queue` явно, хоч і збігаються з дефолтами
pg-boss: інакше новий дефолт у мінорному релізі тихо зсунув би поріг. Поріг — найгірший
випадок, а не типовий: закрити ще живу спробу дорожче, ніж закрити мертву пізніше, бо
оплачений виклик моделі вже не потрапить у картку (`finishRun` не матчить guard статусу). Живий запуск обхід не чіпає (AC-40): молодший за поріг лишається як є, а
завершені запуски не змінює ніколи — той самий guard `status in ('queued','running')`, що
й у `finishRun`, тож гонки з обробником, який саме завершує запуск, немає.

Повтор завислого запуску лишається дією людини (AC-10): обхід його закриває, але не
перезапускає.

## Стан і полінг

Фронт стежить за рядком `product_preparation_runs` (`status`, `error_code`) через
`GET /products/{productId}/preparation-runs/{runId}`. Id задачі pg-boss межу API не
перетинає.

## Спостережуваність

- pino в `worker`: `job started` (з `waitMs` — очікування в черзі), `job finished`,
  `job failed` (з `retryCount` і помилкою). Кожен рядок несе `jobId`, `runId` і `scope`.
  Тіла payload не логуються, бо `draftText` — текст людини.
- Обхід завислих запусків пише `closed stuck preparation runs` (`warn`, з кількістю) лише
  тоді, коли когось закрив: обхід, який щоразу звітує про нуль, засмічує лог і ховає той
  рядок, що справді щось означає. Власна відмова обходу — `stuck run sweep failed`
  (`error`), і `worker` від неї не падає.
- Задачі в `failed` видно ручним запитом до схеми `pgboss`. Дашборда для двох адмінів не
  заводимо.
