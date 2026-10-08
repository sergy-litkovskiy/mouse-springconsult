---
status: Accepted
owner: "Serhii"
reviewers: ["Serhii"]
updated_at: "2026-10-08"
feature_size: M
stage: "04-05"
ticket: "TBD"
---

# 0022 — Тримати оголошення всередині пропозиції `price`

- **Status:** Accepted
- **Date:** 2026-10-08
- **Deciders:** Serhii (Architect / Tech Lead)

## Context

Пропозиція `price` сьогодні — `{priceFrom, priceTo}` у `product_field_suggestions.value` (`jsonb`),
одна на картку, і нова генерація її замінює
([ADR 0017](../../product-creation-flow/adr/0017-keep-one-latest-suggestion-per-field.md)). Фіча
додає оголошення-джерела з цінами й дату пошуку (AC-01, AC-05). Форма зберігання стає контрактом
для етапу 08 і для читання картки, а після накопичення живих даних передумати її коштує міграції.

## Decision drivers

- §1 QG-2: без оголошень вилки немає — вилка й джерела народжуються й замінюються разом.
- ADR 0017: одна, остання пропозиція на поле; нова генерація замінює попередню.
- AC-08, AC-10: невдалий пошук лишає попередню вилку.
- Похідний стан замість дубльованого: дата пошуку вже є — це `created_at` пропозиції.

## Considered options

1. **У тій самій пропозиції.** `value` = `{priceFrom, priceTo, listings: [{price, url}]}`.
2. **Окрема таблиця `product_price_listings`.** Рядок на оголошення з FK на картку.

## Decision outcome

**Chosen: опція 1.** Жоден екран не читає оголошень окремо від вилки, а одна upsert-операція
замінює вилку й джерела атомарно — тим самим `finishRun`, що й сьогодні.

1. `PriceRange` у `FieldSuggestion.ts` отримує `listings: readonly {price: string; url: string}[]`;
   ціни — десяткові рядки, як `priceFrom`/`priceTo`.
2. Дата пошуку — `product_field_suggestions.created_at` (рухається з кожною генерацією); окремого
   `searchedAt` немає.
3. Пропозиція `price` пишеться лише при успіху; `failed` запуск пропозицій `price` не пише.
4. Схема БД не змінюється. Рядки `price` без `listings`, якщо такі лишилися з T54, етап 08 або
   прибирає міграцією даних з робочим `down`, або читає як відсутні — вибір за `data-model.md`.
5. `searchEntryPoint.renderedContent` не зберігається
   ([ADR 0024](0024-show-only-the-range-and-listing-links.md)).

## Consequences

**Positive**

- Без міграції схеми; ADR 0017 тримається без винятків.
- Вилка й оголошення не розходяться: їх не можна записати окремо.

**Negative**

- `value` стає ще поліморфнішим; zod-схема `products.contract.ts` має розрізняти форму ціни.
- Оголошення неможливо фільтрувати SQL-ем — зараз це нікому не потрібно.
- Вилка з джерелами живе стільки, скільки картка, — довше за 2 роки, які умови Google дозволяють
  для тексту Grounded Results (§11 SAD).

**Neutral**

- Перехід на окрему таблицю пізніше — міграція з перенесенням масиву з `jsonb`, ~день роботи.

## Links

- PRD: [PRD.md](../PRD.md) AC-01, AC-05, AC-08, AC-10
- SAD: [sad.md](../sad.md) §4 S3, §5
- Пов'язане: [ADR 0017](../../product-creation-flow/adr/0017-keep-one-latest-suggestion-per-field.md) — одна пропозиція на поле
