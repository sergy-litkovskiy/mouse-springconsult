---
id: T135
title: "Крок «подати»: знайти товар за зовнішнім id і подати імпорт"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1800
blocked_by: [T129, T132]
blocks: [T136]
updated_at: "2026-10-10"
---

# T135 — Крок «подати»: знайти товар за зовнішнім id і подати імпорт

## Context

`marketplace/PromSyncService.submit(runId)` — перший крок ланцюга в `worker`
([ADR 0027](../adr/0027-poll-prom-through-a-chain-of-short-jobs.md)). `retryLimit` = 0: повторна
подача — другий імпорт у живий магазин, тож повторює лише user. **Жодна відмова Prom не кидається:**
крок закриває відправку кодом і завершується. Кидаються лише власні збої БД.

Спершу крок питає Prom, чи товар уже є ([ADR 0030](../adr/0030-identify-the-prom-product-by-the-card-id.md)):

| Що сталося | Відправка | Далі |
|---|---|---|
| товару немає (404) | — | `buildPromImportFile` → `submitImport(first)` |
| імпорт прийнято (`id`) | `prom_import_id`, `deadline_at` = зараз + 30 хв | «перевірити» через 30 с |
| товар є, фото N з N (повтор, AC-11) | `prom_product_id` | одразу «довершити» |
| товар є, фото K < N (повтор, AC-12) | `prom_product_id` | `submitImport(retry)` → «перевірити» |
| доступ недійсний або токен не задано | `failed`, `prom_access_denied` | — |
| відповідь подачі без `id` | `failed`, `prom_busy` | — |
| мережа, 5xx, незнайома форма | `failed`, `prom_unavailable` | — |

Повтор подає файл з **поточної** картки з константою `retry` (`force_update` +
`updated_fields: ["images_urls", "presence"]`): Prom оновлює лише фото й наявність, і товар знову
«немає в наявності», доки «довершити» не поставить чернетку. Картка читається на момент подачі
(AC-04), а не з payload.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарії 1, 2 і 4:

> `worker->>pg: бере «подати», етап running`
> `worker->>prom: шукає товар за зовнішнім id = id картки`
> `prom-->>worker: товару немає`
> `worker->>prom: подає імпорт файлом: xlsx з одним рядком, mark_missing_product_as: none`
> `worker->>pg: пише id імпорту й дедлайн (+30 хв), ставить «перевірити» через 30 с`
> `worker->>pg: відправка failed, код prom_busy`
> `worker->>prom: подає файл картки з примусовим оновленням фото й наявності — Prom оновлює товар за зовнішнім id`

## Data delta

Оновлення рядка `product_prom_sync_runs`: `status` → `running`, `started_at`, `prom_import_id`,
`deadline_at`, `prom_product_id` або `error_code` + `finished_at`. Схема не змінюється.

## API contract excerpt

```yaml
        | `prom_access_denied` | токен недійсний, без права запису чи не заданий (AC-08) | немає; якщо відмова на перевірці чи довершенні — невідомо | поновити доступ, «Повторити» |
        | `prom_busy` | Prom не прийняв імпорт: завислий імпорт чи вичерпано добовий ліміт ручних імпортів (AC-09) | немає | «Повторити» пізніше; після ліміту — до 2 год |
        | `prom_unavailable` | Prom не відповів чи відповів незнайомою формою (AC-07) | немає | «Повторити» |
```

## Acceptance criteria

**AC-13** (US-04) — одна картка — один товар, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** попередня відправка створила товар, але фото 3 з 4
**When** user натискає «Повторити» і виконується «подати»
**Then** адаптер отримує `submitImport(retry)`, а не `first`; другого товару не створюється

**AC-09** (US-03) — Prom зайнятий
**Given** Prom відповідає на подачу без `id`
**When** виконується «подати»
**Then** відправка `failed` з `prom_busy`, задача завершується без throw, поля картки не змінено

**AC-08** (US-03) — доступ
**Given** `PROM_API_TOKEN` не задано
**When** виконується «подати»
**Then** відправка `failed` з `prom_access_denied` без жодного виклику Prom

## Checklist

1. `PromSyncService` з адаптером, репозиторієм, `PromSyncQueue` і читанням картки з `products/index.ts` у конструкторі; метод `submit(runId)`.
2. Гілки таблиці вище; spec з адаптером-двійником (підклас з `override`) на кожну.
3. Лог кроку: `runId`, крок, `prom_import_id`, код. Без токена, тіл відповідей і текстів картки.
4. `marketplace/index.ts` — експорт сервісу.
5. Відправка вже не `queued` (її закрив свіп, поки задача чекала) — крок нічого не робить, лише пише лог; spec.

## Out of scope

- «Перевірити» й «довершити» ([T136](check-prom-import-status.md), [T137](finish-prom-draft.md)).
- Підписка `worker` на чергу ([T138](close-stuck-prom-sync-runs.md)).

## DoD

- [ ] Жодна відмова Prom не кидає виняток: spec на кожну гілку.
- [ ] Тести зелені без мережі й токена; `deps:check` зелений.
- [ ] Коміт: `feat(marketplace): submit the Prom import of a card`.

## Links

- [events.md](../contracts/events.md), `submit` · [ADR 0030](../adr/0030-identify-the-prom-product-by-the-card-id.md) · [ADR 0032](../adr/0032-send-the-import-file-in-the-request-body.md)
