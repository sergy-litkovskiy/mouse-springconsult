---
id: T25
title: "queue.ts, worker.ts, pg-boss, сервіс worker у compose"
status: Blocked
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1500
blocked_by: [T23]
blocks: [T26, T27]
updated_at: "2026-09-05"
---

# T25 — `queue.ts`, `worker.ts`, pg-boss, сервіс `worker` у compose

## Context

Черга й другий процес відкладені, а не скасовані: `ai/CLAUDE.md` вимагає виконувати виклики
моделі **тільки** у воркері. Ціна відкладення теж названа: налагоджувати чергу доведеться
одразу на викликах моделі, а не на тривіальній задачі. Тому ця задача піднімає чергу
**окремо** — з обробником, який лише логує, — і закривається до того, як зверху ляже Anthropic.

Окремого DLQ немає: вичерпаний `retryLimit` лишає рядок job'и у стані `failed` тієї самої
таблиці pg-boss ([api-sync-report.md](../contracts/api-sync-report.md), Section B п.5 —
термінологічний дрейф `sad.md`, не контракту).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 5** — дві стрілки, які ця задача робить можливими:

> `api->>pg: ставить задачу підготовки`
> `api-->>web: задачу прийнято`
> `worker->>pg: бере задачу`

## Data delta

| Схема | Зміна | Джерело |
|---|---|---|
| службові таблиці pg-boss | створюються самим pg-boss **у тій самій базі**, що й картки | [sad.md §7](../sad.md#7-deployment-view) |
| `products`, `product_images` | не змінюються | — |
| таблиці підготовки | **не тут** — [T26](add-preparation-tables-migration.md) | [data-model.md](../data-model.md) |

Redis і RabbitMQ не додаємо: черга живе в Postgres ([CLAUDE.md](../../../../CLAUDE.md)).

## API contract excerpt

```yaml
    PreparationRun:
      description: "**Поставка 2 — спроектовано, таблиця без міграції.**"
        status: { type: string, enum: [queued, running, succeeded, failed] }
```

Стану `dlq` в переліку немає свідомо — його немає й у pg-boss.

## Acceptance criteria

**AC ([PRD §6](../PRD.md#6-non-functional-requirements), рядок «Очікування фонової задачі в черзі»)**
**Given** `api` поставив задачу в чергу
**When** `worker` вільний
**Then** задача стартує за ≤ 5 с від постановки — виміряно `enqueue → started` з логів воркера

**AC ([sad.md §7](../sad.md#7-deployment-view))**
**Given** контейнер `worker` зупинено
**When** `user` працює з карткою й галереєю
**Then** `api` живий, поставка 1 не деградує — процеси незалежні

## Checklist

1. `apps/api/package.json` — `pg-boss`.
2. `src/queue.ts` — технічний сервіс поруч із `config.ts`, `db.ts`, `logger.ts`; про `modules/` не знає.
3. `src/worker.ts` — **другий composition root**: тільки тут `new Repository()` для процесу обробника.
4. `src/config.ts` — параметри черги константами: `retryLimit`, `retryBackoff`, таймаути. Не env-змінними.
5. `docker-compose.yml` і `docker-compose.prod.yml` — сервіс `worker`: **той самий образ** з командою `dist/worker.js`.

## Out of scope

- Виклики моделі — [T27](add-anthropic-adapter.md), [T28](add-preparation-service.md).
- Таблиці підготовки — [T26](add-preparation-tables-migration.md).
- `events.md` — створюється разом із першою реальною задачею, тобто в [T28](add-preparation-service.md).

## DoD

- [ ] `docker compose up` піднімає `worker`; `docker compose logs -f worker` показує, що обробник підписався.
- [ ] Задача доходить до обробника за ≤ 5 с — виміряно, а не припущено.
- [ ] `worker.ts` не імпортується з `api.ts` і навпаки — `deps:check` зелений.
- [ ] Падіння `worker` не валить `api` — перевірено зупинкою контейнера.
- [ ] Параметри черги — константи `config.ts`, а не env-змінні: значення однакове на всіх машинах.
- [ ] Коміт: `feat(api): add the pg-boss queue and the worker process`.

## Links

- [sad.md §7](../sad.md#7-deployment-view) · [sad.md §8](../sad.md#8-crosscutting-concepts), рядок «Черга»
- [apps/api/src/modules/ai/CLAUDE.md](../../../../apps/api/src/modules/ai/CLAUDE.md)
- [CONTEXT.md](../CONTEXT.md) — «запуск підготовки», Out of scope
