---
id: T133
title: "«Перевірити ще раз»: POST …/recheck для prom_timeout"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1500
blocked_by: [T132]
blocks: [T140]
updated_at: "2026-10-10"
---

# T133 — «Перевірити ще раз»: POST …/recheck для prom_timeout

## Context

Третій маршрут відправки. Дія над наявним рядком, а не нова відправка й не `PATCH status`
(рішення №3 [api-sync-report.md](../contracts/api-sync-report.md)). Prom уже прийняв імпорт, тож
нова подача дала б другий імпорт. Натомість рядок повертається в `running` з новим дедлайном, і
ставиться задача «перевірити» для того самого `prom_import_id`. Це єдиний виняток з «завершене —
остаточне» ([data-model.md](../data-model.md)).

`PromSyncRunService.recheck(productId, runId)`:

- відправка `failed` з `prom_timeout` → `running`, `deadline_at` = зараз + 30 хв, `finished_at` =
  `null`, задача «перевірити» з наступним номером спроби;
- уже `running` ця сама → `200` з нею ж, без другої задачі (подвійний клік);
- інший стан чи код, або в картки вже є інша активна → `409 prom_sync_not_recheckable`;
- картку тим часом довела до Prom інша відправка → `409 product_already_on_prom`.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 3:

> `user->>web: «Перевірити ще раз»`
> `web->>api: перевірити ту саму відправку`
> `api->>pg: відправка знову running з новим дедлайном, задача «перевірити»`
> `worker->>prom: статус того самого імпорту — нової подачі немає`

## Data delta

Оновлення рядка `product_prom_sync_runs`: `status`, `deadline_at`, `finished_at`, `error_code` →
`null`. `prom_import_id` лишається. Схема не змінюється.

## API contract excerpt

```yaml
  /products/{productId}/prom-sync-runs/{runId}/recheck:
      operationId: recheckPromSyncRun
        Лише для відправки `failed` з `prom_timeout` (AC-10, sad.md сценарій 3). Нової подачі
        немає: той самий рядок повертається в `running` з новим `deadline_at` і
        Тіла немає. Повторне натискання на вже `running` цієї самої відправки — `200` з нею ж,
        без другої задачі (подвійний клік, друга вкладка). Відправка в іншому стані чи з іншим
        кодом, або в картки вже є інша активна відправка — `409 prom_sync_not_recheckable`.
```

## Acceptance criteria

**AC-10** (US-03) — довга обробка, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** відправка `failed` з `prom_timeout`
**When** user натискає «Перевірити ще раз»
**Then** відповідь `200`, відправка `running`, у черзі одна задача «перевірити» для того самого `prom_import_id`; нової подачі немає

**AC-13** (US-04) — повторне натискання
**Given** ця сама відправка вже `running` після «Перевірити ще раз»
**When** user натискає ще раз в іншій вкладці
**Then** `200` з тією самою відправкою, друга задача не ставиться

**AC-07** (US-03) — недоречна дія
**Given** відправка `failed` з `prom_busy`
**When** клієнт викликає `recheck`
**Then** `409 prom_sync_not_recheckable`, рядок не змінено

## Checklist

1. `PromSyncRunService.recheck` з гілками вище; spec на кожну.
2. Маршрут `POST /products/:productId/prom-sync-runs/:runId/recheck` у `PromSyncRunController`, `sessionGuard`, zod params, без тіла; spec.
3. Номер спроби задачі «перевірити» — `check_count + 1`, щоб детермінований id не збігся з попередньою перевіркою.

## Out of scope

- Сам крок «перевірити» ([T136](check-prom-import-status.md)).
- Кнопка у фронті ([T140](show-prom-sync-result.md)).

## DoD

- [ ] Нова подача імпорту з цього маршруту неможлива: spec перевіряє, що задачі «подати» немає.
- [ ] Тести зелені.
- [ ] Коміт: `feat(products): recheck a Prom sync run that timed out`.

## Links

- [openapi.yaml](../contracts/openapi.yaml) `recheckPromSyncRun` · [data-model.md](../data-model.md), виняток `prom_timeout`
