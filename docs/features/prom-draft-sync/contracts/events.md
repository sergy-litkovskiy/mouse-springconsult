---
status: Draft
owner: "Serhii"
reviewers: []
updated_at: "2026-10-10"
feature_size: M
stage: "05"
---

# Events — prom-draft-sync

Черга — pg-boss поверх PostgreSQL, як і `product-preparation`. Окремого DLQ немає: вичерпаний retry
лишає задачу в стані `failed` у `pgboss.job`. Фіча додає другу чергу, `prom-sync`, і на неї
підписується лише `worker`, бо `api` до Prom не ходить (sad.md §7). Форму ланцюга задає
[ADR 0027](../adr/0027-poll-prom-through-a-chain-of-short-jobs.md): «подати» → «перевірити»
(ставить себе знову) → «довершити». Кожна задача триває секунди, стан і дедлайн живуть у рядку
`product_prom_sync_runs`, тож рестарт `worker` губить щонайбільше один крок.

## Job: `prom-sync`

**Producer:**

- `POST /products/{productId}/prom-sync-runs` (`PromSyncRunService`) — крок `submit`;
- `POST /products/{productId}/prom-sync-runs/{runId}/recheck` — крок `check` для того самого
  імпорту (sad.md сценарій 3);
- сам `worker` — `submit` ставить `check` чи `finish`, `check` ставить наступний `check` або
  `finish`.

Постановку робить `PromSyncQueue` (`products/prom-sync`), тож `marketplace` ставить наступний крок
через public API `products` і власної залежності від `queue.ts` не має (ADR 0028).

**Consumer:** `apps/api/src/worker.ts` → `PromSyncService` з `modules/marketplace/index.ts`.

**Retry** — опції `send()` для кожного кроку окремо, бо черга одна:

| Крок | `retryLimit` | Чому |
|---|---|---|
| `submit` | **0** | PRD §6: «0 автоматичних повторів відправки». Повторна подача — другий імпорт на живий магазин, тож повторює лише user |
| `check` | > 0 | лише читає статус імпорту; повтор безпечний |
| `finish` | > 0 | читає товар за зовнішнім id і доводить до кінця те, що вже сталося; кожен виклик ідемпотентний |

Числа (`retryLimit`, `retryDelay`, `expireInSeconds`, крок 30 с, дедлайн 30 хв) — константи
`config.queue.promSync` і `config.prom`, не частина контракту (ADR 0027, Neutral).

**Ідемпотентність.** ADR 0027 і sad.md §8 описують id задачі як «id відправки + крок + номер
спроби кроку». Буквально так не вийде: у pg-boss 12 `pgboss.job.id` — колонка `uuid`, тож рядок
`<runId>:check:3` вона не прийме. Id задачі має бути **детермінованим UUID**, виведеним з цієї
трійки, наприклад SHA-1 з `node:crypto` у форматі UUID v5, без нової залежності. Тоді повторна
постановка тієї самої спроби — no-op, як `{ id: runId }` у `PreparationQueue`, а кожна наступна
перевірка (`check_count + 1`) дістає новий id. Номер спроби для `submit` і `finish` — 0, для
`check` — `check_count` з рядка. Спосіб виведення обирає story `PromSyncQueue`.

### Payload

```json
{ "runId": "<uuid>", "step": "submit" }
```

```json
{ "runId": "<uuid>", "step": "check" }
```

```json
{ "runId": "<uuid>", "step": "finish" }
```

**Обов'язкові поля:** `runId`, `step` (`submit` | `check` | `finish`).

`productId` у payload немає, хоча `product-preparation` його має: `worker` читає рядок відправки за
PK і бере `product_id` звідти (data-model.md, access patterns «Кроки `worker` → PK»). Друге
джерело того самого значення лише створило б можливість розбіжності. Тексти картки в payload
теж не йдуть: «подати» читає збережену картку на момент подачі (AC-04).

**Зворотна сумісність:** лише нові опційні поля. Новий крок — нове значення `step`, і старий
`worker` має відхиляти незнайомий крок, закриваючи відправку `prom_sync_failed`, а не падати
в retry.

### Результат кроку

Жодна відмова Prom не кидається. Крок закриває відправку кодом і завершується, тож pg-boss її не
повторює (ADR 0027; той самий принцип, що
[ADR 0023](../../price-range-search/adr/0023-classify-price-search-failures-and-never-retry-them.md)).
Кидаються лише власні збої — БД. Для `check` і `finish` це означає повтор, а для `submit`
— відправку, яку закриє свіп.

**`submit`** — рядок `queued` → `running`, `started_at`:

| Що сталося | Відправка | Далі |
|---|---|---|
| `GET /products/by_external_id/{id картки}` — 404, товару немає | — | будує xlsx з картки, `POST /products/import_file` ([ADR 0032](../adr/0032-send-the-import-file-in-the-request-body.md)) |
| `import_file` прийняв (`status: success`, `id`) | пише `prom_import_id`, `deadline_at` = зараз + 30 хв | `check` зі `startAfter` 30 с |
| товар за зовнішнім id **є**, фото N з N (повтор, AC-11) | пише `prom_product_id` | одразу `finish`, імпорту немає |
| товар **є**, фото K < N (повтор, AC-12) | пише `prom_product_id` | файл картки ще раз через `import_file` з `force_update: true` і `updated_fields: ["images_urls", "presence"]` (ADR 0030) → `check` |
| 401/403 або токен не задано | `failed`, `prom_access_denied` | — |
| Prom не прийняв імпорт — відповідь без `id` | `failed`, `prom_busy` | — |
| мережа, 5xx, незнайома форма відповіді (zod) | `failed`, `prom_unavailable` | — |

**`check`** — `GET /products/import/status/{prom_import_id}`:

| Що сталося | Відправка | Далі |
|---|---|---|
| статус не остаточний: `SUCCESS` чи `PARTIAL` з нулями або ще без статусу | `check_count + 1` | наступний `check` через 30 с, якщо дедлайн не минув |
| дедлайн минув | `failed`, `prom_timeout`, `finished_at`; `prom_import_id` лишається | «Перевірити ще раз» опитує той самий імпорт |
| `FATAL` | `failed`, `prom_rejected` | — |
| `SUCCESS`/`PARTIAL` з ненульовими лічильниками | — | лічильники в лог, `not_in_file` ≠ 0 — `warn` (QG-1) → `finish` |
| мережа, 5xx, незнайома форма | `check_count + 1` | наступний `check`; один збій опитування — ще не відмова Prom |

Чим `SUCCESS` з нулями відрізняється від остаточного звіту — рішення одного методу
`PromSyncService` (sad.md §9). `PARTIAL` сам нічого не означає: контрольна відправка 2026-10-10
бачила його і без помилок, і з `not_changed`. Нескачане фото видно в `errors[].download_images`, але
K рахує `finish` за `images` товару, а не `check` за статусом.

**`finish`** — `GET /products/by_external_id/{id картки}` → `POST /products/edit_by_external_id`:

| Що сталося | Відправка | Далі |
|---|---|---|
| товару за зовнішнім id немає попри звіт | `failed`, `prom_rejected` | — |
| товар знайдено | пише `prom_product_id` | `edit_by_external_id` зі `status: draft`, `presence: available` |
| переведення не вдалося (`errors` у відповіді, мережа) | `failed`, `prom_not_draft` | — |
| фото на Prom K < N | `failed`, `prom_photos_incomplete`, `images_on_prom` = K | — |
| чернетка, K ≥ N | однією транзакцією: `products.prom_id` = `prom_product_id`, відправка `succeeded`, `images_on_prom` = K | — |

`edit_by_external_id` приймає `status` і `presence` одним викликом, тож обидва ставляться разом або
жоден. Sad.md §6 малює їх двома повідомленнями, але порядок «спершу чернетка, потім наявність»
тримається й так: невдалий виклик не міняє ні того, ні іншого (AC-11). Ціна через `edit` не
передається ніколи: там вона `number/float`, а гроші йдуть лише рядком у файлі імпорту
(CLAUDE.md «Гроші»).

### Свіп завислих відправок

Періодично, як `closeStuckRuns` у підготовці (ADR 0027, Negative). Відправку `queued` чи `running`
з минулим `deadline_at` і запасом на один крок, або без `deadline_at` і зі старим `created_at`, свіп
закриває так:

- з `prom_import_id` → `failed`, **`prom_timeout`**. Імпорт подано, тож картка пропонує «Перевірити
  ще раз», і нової подачі не буде;
- без `prom_import_id` → `failed`, **`prom_sync_failed`**. Упав `worker`, а не Prom. Подача могла
  й відбутися, але «Повторити» безпечний: нова відправка спершу шукає товар за зовнішнім id
  (ADR 0030).

Пороги — константи
`config.queue.promSync`.

## Стан і полінг

Стан задачі pg-boss межу API не перетинає. Фронт полить `GET
/products/{productId}/prom-sync-runs/{runId}`, а після перезавантаження сторінки бере
`latestPromSyncRun` з картки ([openapi.yaml](openapi.yaml)).

## Спостережуваність

- `worker` пише рядок на кожен крок з `runId`, кроком, `prom_import_id` і кодом. На остаточному
  звіті додає лічильники `created`, `updated`, `not_changed`, `not_in_file`, `with_errors_count`
  (QG-1, PRD §6). Ненульове `not_in_file` — сигнал перевірити кабінет. На `created` і `updated`
  сигнал не будується: з двох паралельних імпортів одного файлу їх отримує той, що встиг першим.
- У лог не йдуть `PROM_API_TOKEN`, сирі тіла відповідей Prom і тексти картки
  (`modules/marketplace/CLAUDE.md`, sad.md §8).
- На старті без `PROM_API_TOKEN` — `warn`, як без `GEMINI_API_KEY`.
