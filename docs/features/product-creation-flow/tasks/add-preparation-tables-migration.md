---
id: T26
title: "Міграція таблиць підготовки, entity, перелік у dependency-cruiser"
status: Blocked
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1800
blocked_by: [T24, T25]
blocks: [T28, T31]
updated_at: "2026-09-05"
---

# T26 — Міграція таблиць підготовки, entity, перелік у dependency-cruiser

## Context

Обидві таблиці спроектовані в [data-model.md](../data-model.md) повністю, але міграції не
написано свідомо: таблицю без процесу, який у неї пише, не має сенсу заводити заздалегідь.
[T25](add-queue-and-worker.md) цей процес підняв — тепер має.

Форма зберігання — рішення [ADR 0006](../adr/0006-store-generated-values-as-separate-suggestions.md):
модель ніколи не пише в `products`. Це єдина форма, яка закриває три критерії приймання
одразу: AC-11 виконується **структурно**, AC-10b — бо текст і ціна є окремими записами,
AC-14 — бо вартість картки є сумою по цій самій таблиці.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 5** — обидві таблиці в одній діаграмі:

> `worker->>pg: пише пропозиції текстів і usage виклику`
> `api-->>web: тексти є пропозиціями, ціни немає`

## Data delta

**+2 таблиці, +3 індекси.** Обидві за [data-model.md](../data-model.md):

| Таблиця | Ключові колонки | Обмеження |
|---|---|---|
| `product_preparation_runs` | `product_id` FK CASCADE, `scope`, `idempotency_key` UNIQUE, `status`, `error_code`, `model`, `input_tokens`, `output_tokens`, три timestamptz | `scope CHECK IN (texts, price, both)`; `status CHECK IN (queued, running, succeeded, failed)` |
| `product_field_suggestions` | `run_id` FK CASCADE, `field`, `value` **JSONB**, `resolution`, `resolved_at` | `field CHECK IN (description_prom, description_olx, seo_keywords, price)`; `resolution CHECK IN (accepted, rejected)`, **`NULL` = ще не вирішено** |

Індекси: `product_preparation_runs_product_id_idx`, `..._idempotency_key_key` UNIQUE,
`product_field_suggestions_run_field_key` `(run_id, field)` UNIQUE.

`product_id` у пропозиціях **не дублюється** — картка досяжна через запуск.

## API contract excerpt

```yaml
    PreparationRun:
      description: "**Поставка 2 — спроектовано, таблиця без міграції.**"
      required: [id, productId, scope, status, model, inputTokens, outputTokens, createdAt]
    FieldSuggestion:
      required: [id, runId, field, value, createdAt]
```

Після цієї задачі обидва описи мають перестати казати «без міграції».

## Acceptance criteria

**AC-11** (US-05) — domain invariant
**Given** `user` виправив опис під OLX вручну
**When** підготовка запускається ще раз
**Then** система не перезаписує відредаговане поле — **структурно**, бо генерації нема куди писати

**AC-14** (US-08) — happy path
**Given** `user` завершив підготовку картки
**When** `user` відкриває картку
**Then** вартість картки є сумою по цій таблиці, а не окремим збереженим числом

## Checklist

1. Міграція `<timestamp>-create-preparation-tables.ts` — обидві таблиці, три індекси, усі `CHECK`.
2. Entity в `modules/products/`; `product_id` у пропозиціях не дублюється.
3. `apps/api/.dependency-cruiser.cjs` — дописати нові класи в іменний перелік `ENTITIES`; поточне його значення читай у самому файлі.
4. `src/api.ts` і `src/worker.ts` — нові entity в `createDataSource`.
5. `modules/ai/CLAUDE.md` — правка рядка про `ai_generations`: `usage` пише в `product_preparation_runs`. Знахідка звірки, див. [_epic.md](_epic.md).

## Out of scope

- Реєстрація класу міграції в переліку: `db/migrations-glob.ts` — це glob.
- Репозиторій і сервіс над таблицями — [T28](add-preparation-service.md).

## DoD

- [ ] `db:migrate` вниз і вгору проходить на тестовій базі.
- [ ] `value` — **єдиний JSONB у схемі**; жодної другої колонки такого типу не зʼявилось.
- [ ] `resolution` має три стани через `NULL`; слова `pending` у схемі немає — воно дублювало б відсутність рішення.
- [ ] Нові entity є в `ENTITIES` `.dependency-cruiser.cjs`; `deps:check` зелений — інакше правило меж їх просто не побачить.
- [ ] Рядок `ai/CLAUDE.md` про `ai_generations` приведений у відповідність зі схемою.
- [ ] Коміт: `feat(products): add the preparation runs and field suggestions tables`.

## Links

- [data-model.md](../data-model.md) · [ADR 0006](../adr/0006-store-generated-values-as-separate-suggestions.md)
- [sad.md §4 S3](../sad.md#s3-згенеровані-значення-живуть-окремою-таблицею-пропозицій-а-не-в-полях-картки) · [sad.md §5](../sad.md#5-building-block-view), місце реєстрації 3
- [CONTEXT.md](../CONTEXT.md) — «пропозиція», «запуск підготовки», Invariants
