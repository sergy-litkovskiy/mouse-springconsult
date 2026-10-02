---
id: T92
title: "Одна пропозиція на поле, повтор запуску — нова генерація"
status: Todo
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2400
blocked_by: [T91]
blocks: [T82]
updated_at: "2026-10-02"
---

# T92 — Одна пропозиція на поле, повтор запуску — нова генерація

## Context

Третя з трьох задач [ADR 0017](../adr/0017-keep-one-latest-suggestion-per-field.md). Після
[T91](drop-server-side-suggestion-accept.md) колонку `resolution` ніхто не читає, а «остання
пропозиція на поле» досі збирається з кількох рядків. Ця задача доводить схему до рішення:
рядок один на (картка, поле), а повтор того самого входу після завершеного запуску кличе
модель знову.

**Міграція** (`db:migrate:new keep-one-suggestion-per-field`).

- `up`:
  1. `product_field_suggestions.product_id uuid`; backfill з `product_preparation_runs.product_id`
     через `run_id`; тоді `not null` і FK → `products(id)` `on delete cascade`.
  2. Видалити всі рядки, крім найновішого на (`product_id`, `field`): `created_at desc`, за
     рівності — `id desc`.
  3. Прибрати `resolution` (разом з її `CHECK`) і `resolved_at`.
  4. `product_field_suggestions_run_field_key` (`run_id`, `field`) →
     `product_field_suggestions_product_field_key` UNIQUE (`product_id`, `field`).
  5. `product_preparation_runs_idempotency_key_key`: предикат `where status <> 'failed'` →
     `where status in ('queued', 'running')`.
- `down` повертає колонки (`resolution` — `null` у всіх рядках), старі індекси й предикат, але
  **не видалені рядки**. Після `up` у базі нормально з'являються два `succeeded` запуски з
  одним ключем (AC-82), і старий предикат `status <> 'failed'` на них упав би. Тому до
  створення індексу `down` дописує до ключа всіх старших дублікатів `'#' || id`. Статус і
  `usage` запусків лишаються, а ключ завершеного запуску ні на що не впливає.

**Код.**

- `FieldSuggestion.ts`: без `resolution` і `resolvedAt`, з `productId`.
- `PreparationRepository.finishRun`: upsert `on conflict (product_id, field) do update set
  value, run_id, created_at = now()`. `product_id` береться з запуску в тій самій транзакції.
  `findSuggestions` фільтрує `where product_id`, без `join`. `resolveSuggestion` зникає.
- `findRunByKey` і `createRunOnce` читають лише `queued` і `running` (`In(UNFINISHED)` замість
  `NOT_FAILED`). Коментар про два проходи `createRunOnce` оновлюється: запуск, що встиг
  завершитися між `insert` і читанням, тепер звільняє ключ і за `succeeded` теж, і другий
  прохід ставить новий запуск.
- `PreparationService` та `ProductService`: «остання на поле» стає просто «пропозиції картки».

**Чому `cpr`.** Diff чіпає `*Repository.ts` з доменним інваріантом (унікальність, upsert) і
гроші: повтор того самого входу знову платить.

## Sequence

> `api->>pg: шукає запуск того самого входу в черзі чи в роботі`
> `api-->>web: повертає наявний запуск, моделі вдруге не кличе (AC-82)`
> `worker->>pg: бере задачу, кличе модель (сценарій 7) і замінює пропозицію кожного поля`

Сценарій 9 [sad.md §6](../sad.md#6-runtime-view), гілки «подвійний клік» і «нова генерація».

## Data delta

`product_field_suggestions`: `+ product_id` (FK cascade), `− resolution`, `− resolved_at`,
UNIQUE (`product_id`, `field`) замість (`run_id`, `field`). `product_preparation_runs`: предикат
частково-унікального `idempotency_key` → `status in ('queued', 'running')`. Деталі —
[data-model.md](../data-model.md), розділ `product_field_suggestions`.

## API contract excerpt

```yaml
      operationId: startPreparationRun
        "201":
          description: Новий запуск поставлено в чергу
        "200":
          description: Той самий вхід уже має запуск у черзі чи в роботі — повернуто його
```

## Acceptance criteria

AC-82 уже в [PRD §5](../PRD.md#5-acceptance-criteria).

**AC-82 (US-03, US-10) — happy path**
**Given** попередній запуск «Згенерувати все» чи промпту поля завершився, і вхід відтоді не змінився
**When** `user` запускає його ще раз
**Then** система ставить новий запуск і кличе модель, а нова пропозиція кожного поля замінює попередню; для одного поля картки в базі зберігається одна пропозиція

**AC-82 — edge case**
**Given** запуск з тим самим входом ще в черзі чи йде
**When** `user` тисне ту саму кнопку вдруге (подвійний клік)
**Then** система повертає наявний запуск і моделі вдруге не кличе; ліміт частоти запусків діє як раніше

## Checklist

1. `db/schema.spec.ts`: UNIQUE (`product_id`, `field`) відкидає другий рядок; видалення картки прибирає її пропозиції; два `succeeded` запуски з одним ключем дозволені, два `queued` — ні.
2. `PreparationRepository.spec.ts`: друга генерація поля перезаписує `value`, `run_id` і `created_at`, рядок один; `findRunByKey` не бачить `succeeded`.
3. `PreparationRunService.spec.ts`: повтор після `succeeded` → `201` і нова задача; повтор, поки `queued` чи `running` → `200` і той самий запуск.
4. Міграція за Context; `FieldSuggestion.ts`, `PreparationRepository.ts` і споживачі за Context. Між кроками — `migrate` → `db:migrate:revert` → `db:migrate` з `--no-deps` на копії з даними.
5. `pw` з одним платним викликом поля, ≈ $0,005, лише з дозволу, суму назвати до й після: нова пропозиція замінила стару; `select product_id, field, count(*) from product_field_suggestions group by 1, 2 having count(*) > 1` порожній.
6. Перед комітом `rg -n "resolution|resolvedAt|acceptFieldSuggestion|suggestion_already_resolved" apps docs/features/product-creation-flow/contracts` порожній.

## Out of scope

- Відновлення видалених рядків історії в `down`: їх немає де взяти.
- Облік вартості (AC-14): запуски не видаляються, сума не змінюється.

## DoD

- [ ] AC-82: повтор — нова генерація, подвійний клік — один запуск, рядок один на поле.
- [ ] Тести `api` зелені, up/down міграції пройдено, `pw` пройдено, `cpr` — ACCEPT чи WARN.
- [ ] Коміт: `feat(products): keep one suggestion per field of the card`.

## Links

- [ADR 0017](../adr/0017-keep-one-latest-suggestion-per-field.md) · [T26](add-preparation-tables-migration.md) — таблиці · [T51](allow-retry-after-failed-run.md) — повтор після відмови
- [sad.md §6](../sad.md#6-runtime-view), сценарій 9 · [data-model.md](../data-model.md) · [openapi.yaml](../contracts/openapi.yaml) — `startPreparationRun`
