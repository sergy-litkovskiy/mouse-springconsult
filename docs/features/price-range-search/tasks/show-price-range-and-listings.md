---
id: T114
title: "Вилка «від — до ₴» під ціною й оголошення за інфо-іконкою"
status: Blocked
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1600
blocked_by: [T109]
blocks: [T115]
updated_at: "2026-10-08"
---

# T114 — Вилка «від — до ₴» під ціною й оголошення за інфо-іконкою

## Context

User бачить лише вилку й оголошення
([ADR 0024](../adr/0024-show-only-the-range-and-listing-links.md)). Під полем ціни стоїть
«від — до ₴» і інфо-іконка. За нею — перелік оголошень (ціна й посилання в новій вкладці) і
дата пошуку, тобто `createdAt` пропозиції. Тултіп чи модалка — вибір цього етапу (№1). Search
Suggestions Google не показуються, HTML з відповіді ніде не рендериться, а стрілки «<- AI» біля
ціни немає, як і зараз (№4).

Сьогодні `app-suggestion-field` для ціни вже показує «від … до … ₴» (`describe` у
`suggestion-field.ts`), але сам блок схований за `priceLookupEnabled = false`. Задача додає
іконку й перелік. Вмикає блок [T115](enable-find-price-button.md), тож живий прохід
Playwright по формі робиться там, а тут достатньо spec компонентів.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 1, останні кроки:

> `api-->>web: картка + пропозиція price з created_at`
> `web-->>user: «від — до ₴» під полем, оголошення й дата за інфо-іконкою`

## Data delta

**Немає змін.** Задача лише читає `product_field_suggestions.value` (`priceFrom`, `priceTo`,
`listings`) і `created_at` через читання картки ([data-model.md](../data-model.md)).

## API contract excerpt

```yaml
    PriceFieldSuggestion:
      properties:
        field: { type: string, const: price }
        value: { $ref: "#/components/schemas/PriceRange" }
        createdAt:
          description: Дата пошуку, яку показує вікно з оголошеннями (AC-05); рухається з кожним новим пошуком
        недовірений ввід (PRD §6.1). У пропозицію воно потрапляє лише з `http:`/`https:`, а
        `web` відкриває його як `<a target="_blank" rel="noopener noreferrer">` (ADR 0024).
```

## Acceptance criteria

**AC-05** (US-03) — happy path, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** під полем ціни показано вилку
**When** user натискає інфо-іконку поруч
**Then** видно кожне оголошення з ціною й посиланням, що відкривається в новій вкладці, і дату пошуку

**AC-06** (US-04) — domain invariant
**Given** під полем ціни показано вилку
**When** user вирішує ціну картки
**Then** вилка не підставляється в поле, кнопки її прийняття немає; у картку потрапляє лише число, яке user вписав сам

## Checklist

1. `form/price-listings.*`: новий компонент з переліком оголошень (ціна у форматі гривні через `Intl.NumberFormat`, посилання `<a target="_blank" rel="noopener noreferrer">`) і датою пошуку, відформатованою на клієнті.
2. Посилання рендерити лише з `http:`/`https:`. Сервер це вже гарантує, а другий фільтр у шаблоні коштує рядок і закриває `javascript:`, якщо схема колись послабне ([PRD §6.1](../PRD.md#61-security--privacy)). Жодного `[innerHTML]`.
3. `form/suggestion-field.*`: для ціни біля «від — до ₴» з'являється інфо-іконка, яка відкриває `price-listings`. Тултіп чи модалку обрати тут і записати вибір у story. Тексти, ключові слова й решта полів не змінюються.
4. `describe` бере межі з типу контракту, без касту `as { priceFrom; priceTo }`.
5. Spec: перелік з трьох оголошень, атрибути посилання, дата, `javascript:`-посилання не рендериться, у полі ціни немає кнопки прийняття.

## Out of scope

- Кнопка «Знайти ціну», зняття `priceLookupEnabled` і повідомлення про невдачі ([T115](enable-find-price-button.md)).
- Чипи Search Suggestions, бо від них відмовились в [ADR 0024](../adr/0024-show-only-the-range-and-listing-links.md), опція 2.

## DoD

- [ ] `test` і `lint` для `web` зелені; zoneless spec компонентів.
- [ ] Прохід `security-review` по diff: посилання від моделі в UI ([PRD §6.1](../PRD.md#61-security--privacy)).
- [ ] Коміт: `feat(web): show the price range with its source listings`.

## Links

- [ADR 0024](../adr/0024-show-only-the-range-and-listing-links.md) · [sad.md §4 S5](../sad.md#4-solution-strategy) · [CONTEXT.md](../CONTEXT.md), «оголошення-джерело»
