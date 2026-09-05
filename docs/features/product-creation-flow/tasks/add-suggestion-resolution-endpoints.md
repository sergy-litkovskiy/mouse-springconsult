---
id: T30
title: "Прийняття й відхилення пропозицій, захист ручної правки"
status: Blocked
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1700
blocked_by: [T29]
blocks: [T32]
updated_at: "2026-09-05"
---

# T30 — Прийняття й відхилення пропозицій, захист ручної правки

## Context

Тут виконується QG-3 — **ручна правка остаточна** — і виконується вона структурно, а не
перевіркою: модель фізично не має куди перезаписати поле.

Тонкість, яка робить AC-11 придатним до життя: порожня картка не має вимагати підтверджень.
Поки поточне значення поля збігається з останньою **прийнятою** пропозицією, нова
застосовується сама; щойно розійшлося — діє AC-11. Окремого прапорця «редаговано вручну»
для цього не потрібно.

Наслідок цього вибору названий у [sad.md §6](../sad.md#6-runtime-view), сценарій 9: звірка
живе на читанні картки, тож **читання може писати**. Це вибір, а не недогляд.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 9** — обидві гілки:

> `api->>pg: звіряє поточне значення з останньою прийнятою пропозицією`
> гілка «збігається» → нова застосовується сама
> гілка «розійшлося» → пропозиція чекає на рішення людини (AC-11)

## Data delta

| Таблиця | Зміна |
|---|---|
| `product_field_suggestions.resolution` | `NULL` → `accepted` або `rejected`; `resolved_at` заповнюється |
| `products` | при `accepted` — поле картки оновлюється **тим самим запитом**, що й ручне збереження |
| `product_field_suggestions_run_field_key` | `(run_id, field)` UNIQUE — один запуск дає не більше однієї пропозиції на поле; той самий індекс обслуговує join у звірці ([data-model.md](../data-model.md)) |

Третього стану `resolution` немає: `pending` дублював би те, що вже несе `NULL`.

## API contract excerpt

```yaml
      description: >-
        прийнятою пропозицією) не проходить через цей ендпоінт — воно відбувається
        всередині читання картки ([ADR 0006](../adr/0006-store-generated-values-as-separate-suggestions.md)),
        цей маршрут — лише явна дія людини після розходження (AC-11).
      operationId: acceptFieldSuggestion
      responses:
        "409": { $ref: "#/components/responses/SuggestionAlreadyResolved" }
```

## Acceptance criteria

**AC-11** (US-05) — domain invariant
**Given** `user` виправив опис під OLX вручну
**When** `user` запускає підготовку текстів ще раз
**Then** система не перезаписує відредаговане поле, а пропонує нове значення окремо

**AC-12** (US-06) — happy path
**Given** `user` приймає пропозицію
**When** значення пишеться в поле картки
**Then** воно йде тим самим маршрутом, що й ручне збереження — окремої дії «прийняти картку як підготовлену» в системі немає

## Checklist

1. `contracts/error-codes.ts` — `suggestion_not_found`, `suggestion_already_resolved`.
2. Сервіс: правило звірки, автозастосування, `resolution` = `accepted` | `rejected`.
3. `POST /:productId/suggestions/:suggestionId/accept` і `.../reject` під `sessionGuard`.
4. Прийняття пише значення в поле картки тим самим запитом, що й ручне збереження.
5. `*.spec.ts`: поле збігається з прийнятим → нова застосовується сама; поле виправлено руками → чекає рішення; повторне рішення → `suggestion_already_resolved`.

## Out of scope

- Інтерфейс — [T32](add-preparation-ui.md).
- Прапорець «редаговано вручну» — його свідомо немає.

## DoD

- [ ] AC-11: після ручної правки повторний запуск **не** перезаписує поле, а лишає пропозицію окремо.
- [ ] Порожня картка приймає першу пропозицію без підтвердження — інакше AC-11 зробив би роботу нестерпною.
- [ ] `resolution` має рівно три стани, і `NULL` серед них — не четвертий рядок, а відсутність рішення.
- [ ] Місце, де читання пише, позначене коментарем із посиланням на [sad.md §6](../sad.md#6-runtime-view), сценарій 9 — щоб на рев'ю це читалось як вибір, а не як помилка.
- [ ] Коміт: `feat(products): add suggestion accept and reject endpoints`.

## Links

- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-11, AC-12 · [PRD §4](../PRD.md#4-user-stories) US-05
- [ADR 0006](../adr/0006-store-generated-values-as-separate-suggestions.md) · [openapi.yaml](../contracts/openapi.yaml)
- [CONTEXT.md](../CONTEXT.md) — «пропозиція», Invariants
