---
id: T124
title: "Конфігурація Prom, токен і черга prom-sync"
status: Todo
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1500
blocked_by: []
blocks: [T128, T132, T134]
updated_at: "2026-10-10"
---

# T124 — Конфігурація Prom, токен і черга prom-sync

## Context

Точки реєстрації, які [sad.md §5](../sad.md#5-building-block-view) називає «легко забути», крім
entity й маршрутів. Таблиця §7 розкладає їх по трьох рівнях конфігурації кореневого `CLAUDE.md`:

- **секрет** `PROM_API_TOKEN` — у zod-схемі env `src/config.ts`, **необов'язковий**. Без нього
  `worker` стартує з попередженням, як без `GEMINI_API_KEY`, а відправку закриває
  `prom_access_denied`. Зразок порожній у `.env.example`;
- **константи** `config.prom`: базова адреса Prom API, шаблон адреси товару в кабінеті
  `https://my.prom.ua/cms/product/edit/{id}` (звірено на живому кабінеті 2026-10-10), крок
  опитування 30 с, дедлайн 30 хв, `draftDefaults` (одиниця «шт.», регіон «Київ», лише роздріб;
  кількість — за рішенням [T121](resolve-prom-import-questions.md)), таймаут HTTP-виклику Prom;
- **черга** `config.queue.promSync`: `retryLimit` по кроках (`submit` — 0), поріг завислої
  відправки й період свіпу; у `src/queue.ts` — `promSyncQueue`.

Префікса ключа R2 немає: файл імпорту в R2 не потрапляє
([ADR 0032](../adr/0032-send-the-import-file-in-the-request-body.md)).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 1 — числа, які тут стають константами:

> `worker->>pg: пише id імпорту й дедлайн (+30 хв), ставить «перевірити» через 30 с`
> `loop не частіше разу на 30 с, до дедлайну`

## Data delta

**Немає.** Константи й env не мають колонок. Непрямий зв'язок: `deadline_at` у
`product_prom_sync_runs` рахується з `config.prom` у [T135](submit-prom-import.md).

## API contract excerpt

Шаблон, з якого складається похідне поле:

```yaml
    PromCabinetUrl:
      type: string
      format: uri
        `config.prom` при мапінгу в DTO — так само, як `ProductImage.url` складається з `r2Key`
      example: "https://my.prom.ua/cms/product/edit/2000000001"
```

## Acceptance criteria

**AC-08** (US-03) — доступ, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** `PROM_API_TOKEN` не задано
**When** стартує `api` чи `worker`
**Then** процес стартує; `worker` пише `warn`, а не падає на zod-схемі env

**AC-10** (US-03) — довга обробка
**Given** константи `config.prom`
**When** їх читає код опитування
**Then** крок — 30 с, дедлайн — 30 хв, і жодне з чисел не прийшло з `process.env`

## Checklist

1. `config.ts`: `PROM_API_TOKEN` у zod-схемі env як `z.string().min(1).optional()`, без значення за замовчуванням; spec схеми — без токена й з ним.
2. `config.prom` (`apiBaseUrl`, `cabinetProductUrlTemplate`, `pollIntervalSeconds: 30`, `deadlineMinutes: 30`, `requestTimeoutMs`, `draftDefaults`) і `config.queue.promSync` (`retryLimit` по кроках, `stuckAfterSeconds`, `stuckSweepIntervalSeconds`, `expireInSeconds`).
3. `src/queue.ts`: `promSyncQueue` поруч із `preparationQueue`.
4. `.env.example`: `PROM_API_TOKEN=` з коментарем «лише прод; у деві порожній — тестової компанії Prom немає».

## Out of scope

- Підписка `worker` на чергу й свіп ([T138](close-stuck-prom-sync-runs.md)).
- Постановка задач `PromSyncQueue` ([T132](start-prom-sync-run.md)).

## DoD

- [ ] `api` і `worker` стартують без `PROM_API_TOKEN`.
- [ ] Токен ніде не логується й не потрапляє у фронт.
- [ ] Тести зелені; `deps:check` зелений.
- [ ] Коміт: `feat(api): add the Prom config, token and prom-sync queue`.

## Links

- [sad.md §7](../sad.md#7-deployment-view), таблиця конфігурації · [events.md](../contracts/events.md), Retry
- [ADR 0027](../adr/0027-poll-prom-through-a-chain-of-short-jobs.md)
