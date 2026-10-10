---
id: T138
title: "worker: підписка на prom-sync і свіп завислих відправок"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1400
blocked_by: [T137]
blocks: [T142, T143]
updated_at: "2026-10-10"
---

# T138 — worker: підписка на prom-sync і свіп завислих відправок

## Context

Збирання ланцюга в `src/worker.ts`, поруч із підготовкою:

- entity `PromSyncRun` у списку `entities` джерела даних `worker`;
- `PromAdapter` з `PROM_API_TOKEN`; без токена — `warn` на старті, як без `GEMINI_API_KEY`;
- `queue.work` на `promSyncQueue`: `step` з payload обирає `submit` / `check` / `finish`, незнайомий
  крок закриває відправку `prom_sync_failed`, а не падає в retry
  ([events.md](../contracts/events.md), «Зворотна сумісність»);
- свіп за інтервалом `config.queue.promSync.stuckSweepIntervalSeconds`: активна відправка з минулим
  `deadline_at` із запасом на один крок, або без `deadline_at` і зі старим `created_at`. З
  `prom_import_id` → `prom_timeout` (картка пропонує «Перевірити ще раз»), без нього →
  `prom_sync_failed` («Повторити» безпечний, бо нова відправка спершу шукає товар).

Прибирати файл імпорту свіпу не треба: файл у R2 не потрапляє
([ADR 0032](../adr/0032-send-the-import-file-in-the-request-body.md)).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 2 — правило, яке тримає підписка:

> `Note over worker,pg: задача завершується без throw — pg-boss її не повторює; поля картки не змінюються`
> `worker->>pg: бере «подати», етап running`

## Data delta

Свіп оновлює `product_prom_sync_runs`: `status` → `failed`, `error_code`, `finished_at`. Окремого
індексу під вибірку немає свідомо: активних рядків щонайбільше стільки, скільки карток
([data-model.md](../data-model.md)).

## API contract excerpt

```yaml
        | `prom_timeout` | імпорт подано, остаточного звіту за 30 хв немає (AC-10); або свіп закрив завислу відправку з `prom_import_id` | невідомо | «Перевірити ще раз» |
        | `prom_sync_failed` | збій `worker`, а не Prom: свіп закрив завислу відправку **без** `prom_import_id`, незнайомий крок або id товару вже записано іншій картці | невідомо | «Повторити» — безпечно, бо спершу шукає товар за зовнішнім id |
```

## Acceptance criteria

**AC-10** (US-03) — довга обробка, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** `worker` упав після подачі, і відправка `running` з `prom_import_id` пережила дедлайн
**When** спрацьовує свіп
**Then** відправка `failed` з `prom_timeout`, а «Перевірити ще раз» опитує той самий імпорт

**AC-13** (US-04) — повтор після збою
**Given** `worker` упав до подачі, відправка `running` без `prom_import_id` і зі старим `created_at`
**When** спрацьовує свіп
**Then** відправка `failed` з `prom_sync_failed`, і нова відправка картки дозволена

## Checklist

1. `worker.ts`: entity, адаптер, `PromSyncService`, `queue.work` на `promSyncQueue` з розгалуженням за `step`; `warn` без токена.
2. Свіп через `PromSyncRepository` за інтервалом; лог кількості закритих, як у підготовки.
3. Spec обробника задачі: незнайомий `step` → `prom_sync_failed` без throw.
4. Smoke на живому стеку без токена: старт готової картки → відправка `failed` з `prom_access_denied` за ≤ 5 с від постановки.

## Out of scope

- Живий виклик Prom ([T143](verify-prom-draft-sync.md)).

## DoD

- [ ] `worker` стартує без `PROM_API_TOKEN` і обробляє чергу підготовки, як раніше.
- [ ] Тести зелені; smoke пройдено.
- [ ] Коміт: `feat(api): run the prom-sync chain in the worker`.

## Links

- [events.md](../contracts/events.md), Consumer, «Свіп завислих відправок» · [ADR 0027](../adr/0027-poll-prom-through-a-chain-of-short-jobs.md)
