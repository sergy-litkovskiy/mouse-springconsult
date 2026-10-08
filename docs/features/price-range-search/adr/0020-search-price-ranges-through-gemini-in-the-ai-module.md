---
status: Accepted
owner: "Serhii"
reviewers: ["Serhii"]
updated_at: "2026-10-08"
feature_size: M
stage: "04-05"
ticket: "TBD"
---

# 0020 — Шукати вилку цін через Gemini в модулі `ai`, а пошук ціни через Anthropic прибрати

- **Status:** Accepted
- **Date:** 2026-10-08
- **Deciders:** Serhii (Architect / Tech Lead)

## Context

Пошук ціни через Anthropic (`AnthropicAdapter.findPriceRange`, server tool `web_search_20260209`)
двічі не дав вилки: T54 (2026-09-21) і T96
([ADR 0019](../../product-creation-flow/adr/0019-keep-price-search-out-of-generate-all.md),
2026-10-07, 1 з 4). Фіча додає другого постачальника — Gemini API з Grounding with Google Search на
безкоштовному рівні — з єдиною задачею: вилка цін (PRD §3). Треба вирішити, де він живе і що
буде зі старим шляхом. PRD §8 залишив це питання до SAD.

## Decision drivers

- PRD §3: новий пошук **замінює** старий; два постачальники ціну паралельно не шукають.
- §2 SAD: SDK постачальника живе в одному файлі адаптера (правило `anthropic-sdk-stays-in-the-adapter`).
- Корінь `CLAUDE.md`: каркас модулів фіксований, «`pricing` живе всередині `ai`».
- §1 QG-1: один шлях ціни — одна модель відмов, яку можна перевірити.
- §1 гейт: no-go на замірі не має лишити систему без жодного шляху, поки рішення не ухвалене.

## Considered options

1. **`GeminiAdapter` в `ai`, Anthropic-пошук ціни прибрати.** Новий файл поруч з `AnthropicAdapter`,
   області `price`/`both` ведуть на Gemini, `findPriceRange` і `config.ai.webSearch` видаляються.
2. **Обидва постачальники за константою `config.ai.priceProvider`.** Anthropic-шлях лишається
   запасним; вибір — комітом.
3. **Окремий модуль `pricing`.** `GeminiAdapter` з власним `index.ts`; `ai` ходить у нього.

## Decision outcome

**Chosen: опція 1.** Вона єдина виконує PRD §3 дослівно і не тримає мертвого коду: Anthropic-шлях
ADR 0019 уже визнав неробочим, тож перемикач на нього нічого не страхує. Опція 3 перекриває
каркас `CLAUDE.md` і додає стрілку між модулями заради одного файлу.

1. `apps/api/src/modules/ai/GeminiAdapter.ts` — єдиний файл з `@google/genai`; нове правило
   `google-genai-sdk-stays-in-the-adapter` у `.dependency-cruiser.cjs`.
2. `PreparationService` отримує `GeminiAdapter` конструктором поруч з `AnthropicAdapter`;
   створює обидва `src/worker.ts`.
3. Виклик — `models.generateContent` з `tools: [{ googleSearch: {} }]`, без `retryOptions`, з
   `httpOptions.timeout` з `config.ts`. Модель (`gemini-2.5-flash` чи `-lite`) — константа
   `config.ts`, яку обирає замір.
4. `findPriceRange`, `requestPrice`, `PriceSchema`, `config.ai.webSearch` і `config.ai.effort.price`
   видаляються **після** go на гейті. До того обидва шляхи співіснують, а UI ціни лишається
   вимкненим (`priceLookupEnabled = false`).

## Consequences

**Positive**

- Один шлях ціни, одна модель відмов (ADR 0023), без перемикачів.
- `AnthropicAdapter` стає меншим і знову означає «тексти й поле».
- Межа SDK тримається машиною, як і для Anthropic.

**Negative**

- У системі два AI-постачальники, два ключі й дві залежності SDK.
- Повернути Anthropic-пошук можна лише `git revert`, а не константою.
- Документи, що називають Claude єдиною моделлю, треба виправити: корінь `CLAUDE.md`,
  `ai/CLAUDE.md`, `ARCHITECTURE.md`, `SPEC.md` (§11 SAD).

**Neutral**

- Передумати на опцію 3 пізніше — перенос одного файлу й одного правила, без міграції даних.
- Документація Google за замовчуванням показує Interactions API; `generateContent` лишається
  повністю підтримуваним, тож перехід на нове API — окреме рішення, якщо старе почнуть знімати.

## Links

- PRD: [PRD.md](../PRD.md) §3, §8
- SAD: [sad.md](../sad.md) §2, §4 S1, §5
- Пов'язане: [ADR 0019](../../product-creation-flow/adr/0019-keep-price-search-out-of-generate-all.md) — попередній no-go; [ADR 0018](../../../adr/0018-use-sonnet-5-for-card-preparation.md) — модель Claude, яка лишається для текстів
