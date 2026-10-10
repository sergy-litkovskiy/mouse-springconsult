---
id: T136
title: "Крок «перевірити»: чекати на остаточний звіт імпорту"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1700
blocked_by: [T135]
blocks: [T137]
updated_at: "2026-10-10"
---

# T136 — Крок «перевірити»: чекати на остаточний звіт імпорту

## Context

`PromSyncService.check(runId)` питає статус імпорту й ставить себе знову через 30 с, доки Prom не
дасть остаточного звіту або не мине дедлайн. Крок лише читає, тож `retryLimit` > 0. Один збій
опитування ще не означає відмови Prom.

**Що вважати остаточним** — правило одного методу ([sad.md §9](../sad.md#9-architecture-decisions)),
уточнене контрольною відправкою 2026-10-10:

- `SUCCESS` **чи `PARTIAL`** з нулями або ще без статусу — не остаточний (на пробі `SUCCESS` з
  нулями, далі `PARTIAL` з нулями, остаточний — через ~9,5 хв);
- остаточний — ненульовий будь-який з `created`, `updated`, `not_changed`, `with_errors_count`, або
  `FATAL`. Рядок, який Prom відхилив як невірний, дає лише `with_errors_count`: такий звіт іде до
  «довершити», а та, не знайшовши товару, закриває відправку `prom_rejected`;
- сам `PARTIAL` нічого не означає: він приходить і без помилок.

| Що сталося | Відправка | Далі |
|---|---|---|
| не остаточний | `check_count + 1` | «перевірити» через 30 с, якщо дедлайн не минув |
| дедлайн минув | `failed`, `prom_timeout`, `finished_at`; `prom_import_id` лишається | «Перевірити ще раз» |
| `FATAL` | `failed`, `prom_rejected` | — |
| доступ недійсний (401/403) | `failed`, `prom_access_denied` | — |
| остаточний звіт | — | лічильники в лог; `not_in_file` ≠ 0 — `warn` (QG-1) → «довершити» |
| мережа, 5xx, незнайома форма | `check_count + 1` | наступний «перевірити» |

`created` і `updated` для звірки не годяться: з двох паралельних імпортів одного файлу їх отримує
той, що встиг першим. Тому QG-1 звіряє лише `not_in_file == 0`.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарії 1 і 3:

> `worker->>prom: статус імпорту`
> `prom-->>worker: SUCCESS чи PARTIAL з нулями — не остаточний, чекаємо далі`
> `prom-->>worker: остаточний звіт: ненульові лічильники, «не у файлі» = 0`
> `worker->>worker: звіряє лічильники з очікуваними, пише їх у лог`
> `worker->>pg: ставить «довершити»`
> `worker->>pg: дедлайн минув — відправка failed, код prom_timeout, id імпорту лишається`

## Data delta

Оновлення `product_prom_sync_runs`: `check_count`, або `status`/`error_code`/`finished_at`.
Лічильники звіту в БД не пишуться — лише в лог ([data-model.md](../data-model.md), «Поза
агрегатом»).

## API contract excerpt

```yaml
        Фронт питає в циклі, поки відправка `queued` чи `running` (sad.md сценарій 1). Поки Prom
        обробляє імпорт, це `running` — лоадер «Prom ще обробляє картку»; перший звіт Prom з нулями
        відправку не завершує (AC-10). Відправка чужої картки чи неіснуюча — `404
        | `prom_rejected` | Prom остаточно відхилив (`FATAL`) (AC-07) | немає | «Повторити» |
```

## Acceptance criteria

**AC-10** (US-03) — довга обробка, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** Prom відповідає `PARTIAL` з усіма лічильниками 0 і порожніми `errors`
**When** виконується «перевірити»
**Then** відправка лишається `running`, `check_count` + 1, наступна перевірка — через 30 с

**AC-10** (US-03) — вичерпано час
**Given** `deadline_at` минув, а звіт досі не остаточний
**When** виконується «перевірити»
**Then** відправка `failed` з `prom_timeout`, `prom_import_id` збережено

**AC-03** (US-01) — недоторканність каталогу
**Given** остаточний звіт з `not_in_file` = 3
**When** виконується «перевірити»
**Then** у лозі `warn` з лічильниками й `runId`, крок іде до «довершити»: товар уже створено, і відкотити його звіт не може

## Checklist

1. `PromSyncService.check(runId)` за таблицею; функція «чи остаточний звіт» — окремо, з spec на звіти проби й контрольної відправки з протоколу.
2. Дедлайн — з `deadline_at` рядка, крок — `config.prom.pollIntervalSeconds`; постановка через `PromSyncQueue` з номером спроби `check_count`.
3. Spec на кожен рядок таблиці з адаптером-двійником.
4. Відправка вже не `running` (її закрив свіп, поки задача чекала) — крок нічого не робить, лише пише лог; spec.

## Out of scope

- «Довершити» ([T137](finish-prom-draft.md)) і «Перевірити ще раз» ([T133](recheck-prom-sync-run.md)).

## DoD

- [ ] `PARTIAL` з нулями не завершує відправку: є spec.
- [ ] Тести зелені.
- [ ] Коміт: `feat(marketplace): poll the Prom import until its final report`.

## Links

- [events.md](../contracts/events.md), `check` · [api-sync-report.md](../contracts/api-sync-report.md), «Контрольна відправка 2026-10-10»
