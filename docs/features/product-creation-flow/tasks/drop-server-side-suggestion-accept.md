---
id: T91
title: "`api` більше не приймає й не застосовує пропозиції"
status: Todo
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2000
blocked_by: [T90]
blocks: [T82, T92]
updated_at: "2026-10-02"
---

# T91 — `api` більше не приймає й не застосовує пропозиції

## Context

Друга з трьох задач [ADR 0017](../adr/0017-keep-one-latest-suggestion-per-field.md). Після
[T90](copy-suggestion-into-form-field.md) форма копіює пропозицію в поле сама й не кличе
`POST .../accept`, тож серверне прийняття лишилося без клієнта. Задача прибирає його разом з
автозастосуванням на читанні. Схема таблиці не змінюється: `resolution` лишається в базі до
[T92](keep-one-suggestion-per-field.md), але код її більше не пише й не віддає.

**Що прибираємо.**

- Маршрути `POST /:productId/suggestions/:suggestionId/accept` і `.../reject` у
  `ProductController.ts` разом з обробниками `acceptSuggestion` і `rejectSuggestion`.
- У `ProductService.ts`: `acceptSuggestion`, `rejectSuggestion`,
  `applySuggestionsToUntouchedFields` і `promDescription`, бо перетворення переїхало у `web`
  (T90). `suggestionChanges` і `cardHolds` зникають, якщо їх ніхто більше не кличе.
  `latestPerField` спрощується до «остання на поле»: розділу на `accepted` і `pending` більше
  немає. `getById` лише читає.
- `ProductErrors.ts`: `SuggestionNotFound`, `SuggestionAlreadyResolved`,
  `PriceSuggestionReadonly`; у `contracts/error-codes.ts` — їхні коди
  `suggestion_not_found`, `suggestion_already_resolved`, `price_suggestion_readonly`.
- `PreparationRepository.findSuggestion`, якщо після правки його ніхто не кличе.
  `resolveSuggestion` прибирає T92 разом з колонкою.
- `contracts/products.contract.ts`: `resolution` і `resolvedAt` у `fieldSuggestionSchema`. Мапінг
  у контролері їх більше не віддає.

**Чому не `cpr`.** Diff не чіпає ні сесій, ні грошей: маршрути зникають, а не з'являються, і
нових входів від браузера немає.

## Sequence

> `web->>api: перечитує картку`
> `api->>pg: читає поля картки й одну пропозицію на поле`
> `api-->>web: значення полів без змін, а поруч — остання пропозиція кожного поля`

Сценарій 9 [sad.md §6](../sad.md#6-runtime-view): читання картки нічого не пише.

## Data delta

**Немає.** Колонки `resolution` і `resolved_at` лишаються в таблиці до T92, код їх не читає й
не пише.

## API contract excerpt

`ProductCardRead` лишається, а пропозиція — без полів рішення:

```yaml
      operationId: getProduct
    FieldSuggestion:
      required: [id, runId, field, value, createdAt]
        createdAt: { type: string, format: date-time }
```

Шляхів `.../suggestions/{suggestionId}/accept` і `.../reject` в `openapi.yaml` вже немає.

## Acceptance criteria

Переписане AC-11 уже в [PRD §5](../PRD.md#5-acceptance-criteria).

**AC-11 (US-05) — domain invariant**
**Given** у картці порожній «Опис для OLX», виправлена «Назва для Prom» і нові пропозиції для обох полів
**When** `user` відкриває картку
**Then** обидва поля в базі й у відповіді лишаються як були, а пропозиції приходять поруч без `resolution` і `resolvedAt`

**AC-11 — edge case (старий маршрут)**
**Given** клієнт зі старим фронтом
**When** шле `POST /products/{id}/suggestions/{suggestionId}/accept`
**Then** `api` відповідає `404`, а картка не змінюється

## Checklist

1. Окремим комітом **до** `/tdd`: прибрати spec-и старої поведінки — прийняття й відхилення в `ProductController.spec.ts` і `ProductService.spec.ts`, автозастосування на читанні, класи помилок, `resolution` у `products.contract.spec.ts`. Коміт `test(api): drop specs of server-side accept`.
2. `ProductService.spec.ts`: читання картки після запуску не змінює жодного поля, ні порожнього, ні виправленого, і не кличе `products.update`.
3. `ProductController.spec.ts`: `POST .../accept` і `.../reject` → `404`; `latestSuggestions` без `resolution` і `resolvedAt`.
4. `ProductController.ts`, `ProductService.ts`, `ProductErrors.ts`, `error-codes.ts`, `products.contract.ts`, `PreparationRepository.ts`: прибрати перелічене в Context.
5. Перед комітом `rg -n "acceptSuggestion|rejectSuggestion|SuggestionAlreadyResolved|PriceSuggestionReadonly|SuggestionNotFound|resolvedAt" apps/api/src` порожній, а `resolution` лишається лише в `FieldSuggestion.ts` і `PreparationRepository.ts` до T92.

## Out of scope

- Міграція, upsert і ідемпотентність — [T92](keep-one-suggestion-per-field.md).
- Форма — [T90](copy-suggestion-into-form-field.md).

## DoD

- [ ] AC-11: читання картки не пише в поля; маршрутів прийняття немає.
- [ ] Тести `api` зелені, `typecheck`, `lint`, `deps:check` зелені.
- [ ] Коміт: `feat(products): stop accepting suggestions on the server`.

## Links

- [ADR 0017](../adr/0017-keep-one-latest-suggestion-per-field.md) · [T30](add-suggestion-resolution-endpoints.md) — маршрути, які прибираємо · [T53](expose-pending-suggestions.md) · [T55](show-applied-suggestions-in-product-form.md)
- [sad.md §6](../sad.md#6-runtime-view), сценарій 9 · [openapi.yaml](../contracts/openapi.yaml) — `FieldSuggestion`
