---
id: T132
title: "Старт і стан відправки: POST і GET prom-sync-runs"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1800
blocked_by: [T124, T130, T131]
blocks: [T133, T135, T139]
updated_at: "2026-10-10"
---

# T132 — Старт і стан відправки: POST і GET prom-sync-runs

## Context

Перші два маршрути відправки й постановка задачі «подати». `api` до Prom не ходить: він пише
рядок, ставить задачу й одразу відповідає. Звідси QG-3, ≤ 500 ms
([ADR 0027](../adr/0027-poll-prom-through-a-chain-of-short-jobs.md)).

- **`PromSyncQueue.ts`** — постановка задач `prom-sync`. Id задачі — **детермінований UUID** з
  трійки «id відправки + крок + номер спроби» (у pg-boss 12 `job.id` — колонка `uuid`), наприклад
  UUID v5 через `node:crypto`. Повторна постановка тієї самої спроби — no-op
  ([events.md](../contracts/events.md), «Ідемпотентність»). `marketplace` ставить наступні кроки
  через цей клас з `products/index.ts`.
- **`PromSyncRunService.start(productId)`** — порядок перевірок з контракту: картка є → ще не на
  Prom → активна відправка повертається → готовність ([T130](add-prom-readiness.md)) → новий
  рядок `queued` з `imagesTotal` = кількість фото і задача «подати». `get(productId, runId)`.
- **`PromSyncRunController.ts`** — zod на межі, `sessionGuard`, мапінг у DTO з
  `promCabinetUrl` за шаблоном `config.prom`. Реєстрація в `src/api.ts`.

Ліміту частоти немає, а `PROM_API_TOKEN` тут не перевіряється (sad.md §7–§8).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарії 1 і 4:

> `web->>api: запускає відправку картки`
> `api->>pg: читає збережену картку, перевіряє готовність і межі Prom`
> `api->>pg: пише рядок відправки queued (одна активна на картку — правило БД)`
> `api->>pg: ставить задачу «подати»`
> `api-->>web: відправка queued`
> `api-->>web: наявна активна відправка — нова не запускається`
> `api-->>web: етап, лічильник фото, посилання на товар у кабінеті`

## Data delta

Вставка в `product_prom_sync_runs` (`status` = `queued`, `images_total`) і задача в `pgboss.job`.
Схема не змінюється.

## API contract excerpt

```yaml
  /products/{productId}/prom-sync-runs:
    post:
      operationId: startPromSyncRun
        Порядок перевірок: картка є (`404`) → вона ще не на Prom (`409 product_already_on_prom`,
        AC-14) → активної відправки немає, інакше повертається вона (`200`, AC-13) → картка
        готова й вкладається в межі Prom (`409 prom_sync_not_ready`, AC-02, AC-05, AC-06) → нова
        відправка `queued` і задача «подати» (`201`).
  /products/{productId}/prom-sync-runs/{runId}:
      operationId: getPromSyncRun
```

## Acceptance criteria

**AC-13** (US-04) — domain invariant, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** у картки вже є відправка `running`
**When** друга вкладка викликає `POST …/prom-sync-runs`
**Then** відповідь `200` з тією самою відправкою; нової задачі в черзі немає

**AC-04** (US-01) — cross-context
**Given** у формі є незбережені зміни, а збережена картка не готова
**When** клієнт обходить фронт і викликає старт
**Then** `409 prom_sync_not_ready` за **збереженою** карткою: тіла запиту маршрут не має

**AC-14** (US-01) — одноразова
**Given** картка має `promId`
**When** викликається старт
**Then** `409 product_already_on_prom`, рядка відправки не створено

## Checklist

1. `PromSyncQueue` з детермінованим UUID задачі; spec — та сама трійка дає той самий id, інший номер спроби — інший.
2. `PromSyncRunService.start` / `get`; spec з репозиторієм-двійником на кожну гілку порядку перевірок.
3. `PromSyncRunController`: `POST /products/:productId/prom-sync-runs` (`201`/`200`/`404`/`409`), `GET …/:runId` (`200`/`404`); zod params; `sessionGuard`; мапінг DTO; spec маршрутів.
4. `src/api.ts`: entity `PromSyncRun`, контролер, `promSyncQueue`; `products/index.ts` — експорти.
5. Smoke на живому стеку: старт непідготовленої картки — `409`, готової — `201` і задача в `pgboss.job` (worker ще не підписаний).

## Out of scope

- «Перевірити ще раз» ([T133](recheck-prom-sync-run.md)).
- Що робить задача «подати» ([T135](submit-prom-import.md)).

## DoD

- [ ] Маршрути під `sessionGuard`, payload — через zod у контролері.
- [ ] Тести зелені; `deps:check` зелений.
- [ ] Коміт: `feat(products): start a Prom sync run and read its state`.

## Links

- [openapi.yaml](../contracts/openapi.yaml) `startPromSyncRun`, `getPromSyncRun` · [events.md](../contracts/events.md), Producer
- [ADR 0027](../adr/0027-poll-prom-through-a-chain-of-short-jobs.md) · [ADR 0029](../adr/0029-record-each-prom-sync-as-its-own-run.md)
