---
id: T131
title: "PromSyncRepository: рядок відправки й «одна активна на картку»"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1700
blocked_by: [T123]
blocks: [T132, T134]
updated_at: "2026-10-10"
---

# T131 — PromSyncRepository: рядок відправки й «одна активна на картку»

## Context

`products/prom-sync/PromSyncRepository.ts` — єдиний файл, що пише `product_prom_sync_runs`.
Таблицю й entity вже створено (міграція `1791630446458`, `PromSyncRun.ts`). Форма — дзеркало
`PreparationRepository`, зокрема `createRunOnce`: друга вкладка, що програла гонку на вставці,
отримує наявну активну відправку, а не помилку
([ADR 0029](../adr/0029-record-each-prom-sync-as-its-own-run.md)).

Методи за access patterns [data-model.md](../data-model.md):

- `createRunOnce(productId, imagesTotal)` — вставка `queued`; порушення
  `product_prom_sync_runs_active_key` → повертає наявну активну;
- `findRun(productId, runId)` — чужа чи неіснуюча відправка → `null` (буде `404 product_not_found`);
- `findLatestRun(productId)` — `order by created_at desc limit 1`, зокрема завершена;
- кроки `worker` за PK: `startRun`, `recordImport(importId, deadlineAt)`, `recordProduct(promProductId)`,
  `nextCheck` (`check_count + 1`), `failRun(code, imagesOnProm?)`, `recheck(deadlineAt)` (`running`, новий
  дедлайн, `check_count + 1`);
- `succeedRun(runId, imagesOnProm)` — **одна транзакція**: `products.prom_id` = `prom_product_id`,
  відправка `succeeded`, `finished_at`. Порушення `products_prom_id_key` → транзакція відкочується, і
  метод повертає `false`, а не кидає: повтор кроку дав би той самий конфлікт;
- `findStuckRuns(olderThan)` / закриття свіпом — `prom_timeout` з `prom_import_id`, інакше
  `prom_sync_failed`.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарії 1 і 4 — записи, які робить репозиторій:

> `api->>pg: пише рядок відправки queued (одна активна на картку — правило БД)`
> `api->>pg: правило «одна активна» відхиляє другий рядок`
> `worker->>pg: фото N з N, пише products.prom_id, відправка succeeded`

## Data delta

Пише наявну `product_prom_sync_runs` і `products.prom_id`; схема не змінюється. Інваріанти, які
тримає БД, а не код: частковий UNIQUE `product_prom_sync_runs_active_key`, `products_prom_id_key`,
CHECK статусу й `images_total > 0` ([data-model.md](../data-model.md)). Запис `prom_id` рухає
`products.updated_at` — так і має бути.

## API contract excerpt

```yaml
    PromSyncRun:
      required:
        - status
        - errorCode
        - promProductId
        - imagesTotal
        - imagesOnProm
        - finishedAt
          description: Остаточний стан; «Перевірити ще раз» повертає його в `null`.
```

## Acceptance criteria

**AC-13** (US-04) — domain invariant, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** у картки є відправка `running`
**When** дві вкладки одночасно викликають `createRunOnce`
**Then** обидві отримують ту саму активну відправку; у таблиці одна активна

**AC-14** (US-01) — синхронізація одноразова
**Given** `prom_id` 2000000001 уже має інша картка
**When** `succeedRun` пише той самий id цій картці
**Then** транзакція відкочується, метод повертає `false`: відправка лишається `running`, `prom_id` картки — `null`

## Checklist

1. `PromSyncRepository` з `DataSource` у конструкторі; методи вище. Розпізнавання порушення унікальності — як у `PreparationRepository.createRunOnce`.
2. `succeedRun` — `dataSource.transaction`, обидва записи в одній.
3. Свіп: вибірка активних з минулим `deadline_at` (із запасом) або без нього й зі старим `created_at`; код за наявністю `prom_import_id`.
4. Spec проти тестової БД: гонка двох вставок, `findLatestRun` після кількох, `succeedRun` з конфліктом `products_prom_id_key`, `recheck` повертає `running`, обнуляє `finished_at` і піднімає `check_count`, свіп дає обидва коди.
5. `products/index.ts` — експорт репозиторію для `marketplace` і composition root.

## Out of scope

- Сервіси, що вирішують, коли який метод викликати ([T132](start-prom-sync-run.md), [T135](submit-prom-import.md)–[T138](close-stuck-prom-sync-runs.md)).

## DoD

- [ ] `typeorm` згадується лише в репозиторії та entity; `deps:check` зелений.
- [ ] Тести проти тестової БД зелені.
- [ ] Прохід `critical-path-review`: репозиторій з доменним інваріантом (унікальність, транзакція).
- [ ] Коміт: `feat(products): add the Prom sync run repository`.

## Links

- [data-model.md](../data-model.md), `product_prom_sync_runs` · [events.md](../contracts/events.md), «Свіп завислих відправок»
- [ADR 0029](../adr/0029-record-each-prom-sync-as-its-own-run.md)
