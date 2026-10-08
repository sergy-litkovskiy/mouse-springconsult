---
id: T109
title: "Оголошення-джерела в пропозиції price: форма value, межі й читання картки"
status: Blocked
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1800
blocked_by: [T107]
blocks: [T112, T114]
updated_at: "2026-10-08"
---

# T109 — Оголошення-джерела в пропозиції price: форма value, межі й читання картки

## Context

Оголошення живуть усередині тієї самої пропозиції `price`, без окремої таблиці
([ADR 0022](../adr/0022-keep-price-listings-inside-the-price-suggestion.md)). Дата пошуку — це
наявний `createdAt` пропозиції, тож поля `searchedAt` немає (№2). Задача змінює лише форму
`value` у типі entity й у zod-схемі читання картки, а також додає дві константи без залежностей,
які фронт імпортує в рантаймі.

Стоїть після [T107](remove-anthropic-price-search.md), бо до неї пропозицію `price` писав код
без оголошень, і обов'язкові `listings` зламали б typecheck. Обидва рішення щодо Open items
`data-model.md` закрито: задовге посилання робить увесь результат `price_not_found`, а ціни
оголошень у межах вилки бути не мусять ([api-sync-report.md](../contracts/api-sync-report.md),
«Рішення»).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 1, читання, яке після задачі несе оголошення:

> `worker->>pg: finishRun succeeded: upsert product_field_suggestions (price: від, до, listings)`
> `api-->>web: картка + пропозиція price з created_at`

## Data delta

| Колонка | Зміна |
|---|---|
| `product_field_suggestions.value` для `field = 'price'` | + `listings: [{price, url}]`, 1–5 елементів; `jsonb`, тож міграції немає ([data-model.md](../data-model.md)) |
| `product_field_suggestions.created_at` | без змін; тепер це ще й дата пошуку |

## API contract excerpt

```yaml
    PriceListing:
      type: object
      required: [price, url]
      additionalProperties: false
      properties:
        price: { $ref: "#/components/schemas/Money" }
        url:
          type: string
          format: uri
          pattern: '^https?://'
          maxLength: 2048
    PriceRange:
      required: [priceFrom, priceTo, listings]
        listings:
          type: array
          minItems: 1
          maxItems: 5
```

## Acceptance criteria

**AC-05** (US-03), [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** під полем ціни показано вилку
**When** `web` читає картку
**Then** пропозиція `price` несе для кожного оголошення ціну й посилання, а дата пошуку дорівнює `createdAt` пропозиції

**AC-10** (US-06) — domain invariant
**Given** у пропозиції `price` нуль оголошень, понад 5, або посилання не `http(s)` чи довше 2048
**When** схема читання її розбирає
**Then** це не вилка: схема таку форму відхиляє

## Checklist

1. `contracts/products-limits.ts` (`productConstraints`): `maxPriceListings: 5` і межа довжини посилання 2048 з коментарем, чому ціле посилання не обрізається.
2. `contracts/products.contract.ts`: гілка ціни в `fieldSuggestionSchema.value` отримує `listings`, `url` за `^https?://` і з межею довжини. Ціни оголошень — десятковий рядок за `pricePattern`. Плюс кейси в `products.contract.spec.ts`: 0 оголошень, 6, `javascript:`, 2049 символів.
3. `modules/products/preparation/FieldSuggestion.ts`: `PriceRange` отримує `listings: readonly {price: string; url: string}[]` (ADR 0022 №1).
4. Seed-и пропозиції `price` у `ProductController.spec.ts` і `PreparationRepository.spec.ts` переходять на нову форму ([data-model.md](../data-model.md), Test fixtures). `schema.spec.ts` не чіпати.
5. Контракт [product-creation-flow](../../product-creation-flow/contracts/openapi.yaml): `FieldSuggestion` описує `price` як `{priceFrom, priceTo}`. Дописати лінк на `PriceRange` цього контракту ([api-sync-report.md](../contracts/api-sync-report.md), Follow-up).

## Out of scope

- Інваріант вилки `priceFrom ≤ priceTo`, обидві > 0 тримає сервіс ([T112](search-price-through-gemini.md)), а не схема читання.
- Показ вилки й оголошень ([T114](show-price-range-and-listings.md)).

## DoD

- [ ] `web` імпортує `maxPriceListings` з `products-limits.ts`, а з `products.contract.ts` бере лише `import type`.
- [ ] Жодного `transformer` і `float`: ціни лишаються рядками від драйвера до браузера.
- [ ] `typecheck` і `test` обох застосунків зелені.
- [ ] Коміт: `feat(products): carry the source listings in the price suggestion`.

## Links

- [ADR 0022](../adr/0022-keep-price-listings-inside-the-price-suggestion.md) · [data-model.md](../data-model.md), `product_field_suggestions` · [CONTEXT.md](../CONTEXT.md), «оголошення-джерело»
