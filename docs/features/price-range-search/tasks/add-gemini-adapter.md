---
id: T105
title: "GeminiAdapter: пошук вилки з googleSearch і розбір JSON з тексту"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2400
blocked_by: [T104]
blocks: [T106]
updated_at: "2026-10-08"
---

# T105 — GeminiAdapter: пошук вилки з googleSearch і розбір JSON з тексту

## Context

Другий крок гейта заміру. `modules/ai/GeminiAdapter.ts` має бути **єдиним** файлом, який знає
`@google/genai` ([ADR 0020](../adr/0020-search-price-ranges-through-gemini-in-the-ai-module.md)
№1). Тому SDK-помилка назовні не виходить: адаптер сам перекладає її у власний результат, і
`PreparationService` класифікує відмову, не імпортуючи SDK
([ADR 0023](../adr/0023-classify-price-search-failures-and-never-retry-them.md) №1).

Адаптер нічого не знає про картку, пару «Prom, інакше OLX» і БД. Він приймає вже обрані назву,
опис і 0–3 кадри, а віддає вилку з оголошеннями або один із варіантів відмови. На ньому без
жодної іншої story стоїть замір [T106](measure-price-search-on-ten-cards.md).

На 2.5 structured outputs разом із `google_search` не працюють, тож JSON розбирається з тексту
відповіді ([sad.md §2](../sad.md#2-constraints)). Адреси `groundingChunks[].web.uri` — це лише
редиректи `vertexaisearch`. Посилання оголошень бере текст моделі, а редиректи адаптер віддає
окремо, щоб замір міг звірити одне з одним (§11, рядок Medium про вигадані адреси).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарії 1 і 3. Кроки, які виконує адаптер:

> `worker->>gemini: generateContent + googleSearch (без retryOptions)`
> `gemini-->>worker: текст з JSON вилки й оголошень + groundingMetadata`
> `gemini-->>worker: RESOURCE_EXHAUSTED`

## Data delta

**Немає.** Адаптер бази не бачить. Форма, яку розбирає його zod-схема, згодом стане `value`
пропозиції `price` у `product_field_suggestions` ([data-model.md](../data-model.md),
`{priceFrom, priceTo, listings[price, url]}`), але пише її сервіс
([T112](search-price-through-gemini.md)).

## API contract excerpt

Межі, які zod-схема адаптера має тримати так само, як контракт:

```yaml
    PriceListing:
      required: [price, url]
      properties:
        url:
          type: string
          pattern: '^https?://'
          maxLength: 2048
          description: >-
            Задовге посилання не обрізається й не відкидається поодинці: `GeminiAdapter` не
            розбирає таку відповідь, і запуск закривається `price_not_found` (рішення етапу
```

## Acceptance criteria

**AC-10** (US-06) — domain invariant, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** пошук завершився
**When** відповідь не розбирається як вилка: немає JSON, немає оголошень, посилання не `http(s)` чи довше 2048
**Then** адаптер повертає «не розібралось», а не кидає виняток і не повертає часткову вилку

**AC-09** (US-06) — відмова зовнішнього сервісу, ліміт
**Given** денну квоту пошуку вичерпано
**When** Gemini відповідає 429 з ознакою добової квоти (`quotaId` з `PerDay`)
**Then** адаптер повертає «квоту вичерпано», окремо від решти відмов; 429 без цієї ознаки — звичайна відмова (AC-08)

## Checklist

1. `GeminiAdapter` з ключем у конструкторі. Виклик: `models.generateContent` з `tools: [{ googleSearch: {} }]`, `httpOptions.timeout` з `config.ai.priceSearch.timeoutMs`, **без** `retryOptions`. Модель — `config.ai.priceSearch.model` ([ADR 0020](../adr/0020-search-price-ranges-through-gemini-in-the-ai-module.md) №3).
2. Промпт українською: вилка вживаних речей на українських майданчиках, у гривнях, 1–5 оголошень з ціною й посиланням, відповідь — лише JSON `{priceFrom, priceTo, listings: [{price, url}]}`.
3. Розбір JSON з тексту, зокрема з обгортки ```` ```json ````. zod-схема перевіряє лише форму: десяткові рядки за `productConstraints.pricePattern`, 1–5 оголошень, `^https?://`, ≤ 2048. Інваріант вилки (`priceFrom ≤ priceTo`, обидві > 0) лишається сервісу ([ADR 0023](../adr/0023-classify-price-search-failures-and-never-retry-them.md) №2).
4. Результат — власний union адаптера, а не SDK-тип: вилка, «не розібралось», «квоту вичерпано», «недоступно» (мережа, 5xx, таймаут, недійсний ключ, відмова моделі). Разом із вилкою віддаються `webSearchQueries`, адреси `groundingChunks` і токени виклику для логу ([ADR 0025](../adr/0025-keep-gemini-calls-out-of-the-token-ledger.md) №4).
5. Кадри — необов'язковий параметр. Скільки їх піде, вирішує викликач за `config.ai.priceSearch.maxFrames`.
6. `searchEntryPoint.renderedContent` адаптер не повертає взагалі ([ADR 0024](../adr/0024-show-only-the-range-and-listing-links.md) №3).
7. Виклик SDK винести в `protected` метод, щоб spec підміняв його підкласом з `override` (правило 8 `apps/api/CLAUDE.md`). Тести без мережі й без ключа покривають кожен варіант union-а, JSON в обгортці, 6 оголошень, `javascript:`-посилання, посилання на 2049 символів і 429 з `PerDay` та без нього.
8. `index.ts` модуля `ai`: експорт `GeminiAdapter` і типу результату.

## Out of scope

- Класифікація в коди запуску, інваріант вилки й запис пропозиції ([T112](search-price-through-gemini.md)).
- Вибір пари назва + опис ([T110](add-price-search-input.md)).
- Створення адаптера у `worker.ts` ([T112](search-price-through-gemini.md)).
- Живий виклик, бо він належить заміру ([T106](measure-price-search-on-ten-cards.md)).

## DoD

- [ ] `@google/genai` згадується лише в `GeminiAdapter.ts`; `deps:check` зелений.
- [ ] Жоден варіант відмови не кидає виняток назовні: це перевірено тестом на кожен варіант.
- [ ] Тести зелені без `GEMINI_API_KEY` і без мережі.
- [ ] Ключ не потрапляє ні в лог, ні в текст помилки, який повертає адаптер.
- [ ] Прохід `security-review` по diff: новий секрет і відповідь моделі як недовірений ввід ([PRD §6.1](../PRD.md#61-security--privacy)).
- [ ] Коміт: `feat(ai): add the Gemini adapter for price range search`.

## Links

- [sad.md §2](../sad.md#2-constraints), факти про Gemini API · [sad.md §8](../sad.md#8-crosscutting-concepts), «Відповідь моделі — недовірений ввід»
- [ADR 0020](../adr/0020-search-price-ranges-through-gemini-in-the-ai-module.md) · [ADR 0023](../adr/0023-classify-price-search-failures-and-never-retry-them.md) · [ADR 0024](../adr/0024-show-only-the-range-and-listing-links.md)
