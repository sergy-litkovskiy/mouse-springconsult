---
id: T117
title: "ARCHITECTURE.md і CONTEXT product-creation-flow: ціну шукає Gemini"
status: Done
delivery: 2
gate_profile: docs
owner: "Serhii"
estimate: XS
context_budget: 1500
blocked_by: [T113]
blocks: [T118]
updated_at: "2026-10-09"
---

# T117 — ARCHITECTURE.md і CONTEXT product-creation-flow: ціну шукає Gemini

## Context

За [sad.md §11](../sad.md#11-risks-and-technical-debt) `ARCHITECTURE.md` правиться «після go
на гейті, разом із кодом». Код пошуку через Gemini закрито в
[T112](search-price-through-gemini.md) і [T113](search-price-after-texts-in-both.md), тож
документ можна описувати таким, яким він став.

Звірка репозиторію знайшла ще два застарілі місця, яких §11 не називає
([_epic.md](_epic.md), «Звірка з репозиторієм»). Вони в
[CONTEXT.md product-creation-flow](../../product-creation-flow/CONTEXT.md): інваріант «вхід
пошуку ціни — заголовок плюс необов'язковий опис» і рядок `price_unavailable` у Sentinel
errors. AC-02 цієї фічі вимагає назви **й** опису, а `price_unavailable` тепер має ще й запуск
`price`.

## Sequence

**Не застосовується**, бо `gate_profile: docs`. Задача переносить у `ARCHITECTURE.md` потік,
уже намальований у [sad.md §6](../sad.md#6-runtime-view), сценарій 2:

> `worker->>worker: priceSearchInput зі щойно згенерованих titleProm / descriptionProm`
> `worker->>gemini: generateContent + googleSearch`

## Data delta

**Немає.** Жодної колонки чи міграції. Непрямий наслідок: рядок `ai` в `ARCHITECTURE.md` перестає
обіцяти облік `usage` для кожного виклику, бо Gemini токенів у запуск не пише
([ADR 0025](../adr/0025-keep-gemini-calls-out-of-the-token-ledger.md)).

## API contract excerpt

**Немає власного.** Тег контракту, з яким `ARCHITECTURE.md` після правки має збігатися:

```yaml
    description: Запуски підготовки AI; `price` і ціна в `both` тепер ідуть через Gemini
```

## Acceptance criteria

Задача AC не пише. Документи, які вона править, мусять не суперечити двом AC
([PRD §5](../PRD.md#5-acceptance-criteria)):

**AC-02** (US-01) — error
**Given** у картці немає жодної назви або жодного опису
**When** user дивиться на кнопку «Знайти ціну»
**Then** кнопка недоступна, бо для пошуку потрібні хоча б одна назва й хоча б один опис

**AC-03** (US-02) — cross-context
**Given** user запустив «Згенерувати все»
**When** тексти підготовлено
**Then** вилку шукають після текстів і за щойно підготовленими назвою й описом

## Checklist

1. `ARCHITECTURE.md`, таблиця модулів, рядок `ai`: два постачальники. Claude дає тексти й поле, Gemini — вилку; `GeminiAdapter` поруч з `AnthropicAdapter`; пошук ціни більше не «відкладено».
2. `ARCHITECTURE.md`, крок 6 потоку: «другим викликом через `web_search_20260209`» → пошук вилки через Gemini з Google Search після текстів.
3. `ARCHITECTURE.md`, схема `worker`: «Claude API web search» → «Gemini API + Google Search».
4. [CONTEXT.md product-creation-flow](../../product-creation-flow/CONTEXT.md): інваріант про вхід пошуку ціни й рядок `price_unavailable` позначити заміненими, з лінком на [CONTEXT.md цієї фічі](../CONTEXT.md). Переказувати їх не треба.
5. У `sad.md` §11 закреслити рядок `ARCHITECTURE.md` з датою.

## Out of scope

- `SPEC.md`, бо його правила [T115](enable-find-price-button.md).
- PRD product-creation-flow: заміну US-04 і AC-23…AC-27 уже названо в PRD цієї фічі, §1.

## DoD

- [x] `grep -n 'web_search' ARCHITECTURE.md SPEC.md apps/api/src/modules/ai/CLAUDE.md` порожній.
- [x] Коміт: `docs(price-range-search): describe the Gemini price search in the architecture`.

## Links

- [sad.md §11](../sad.md#11-risks-and-technical-debt) · [ADR 0020](../adr/0020-search-price-ranges-through-gemini-in-the-ai-module.md), Negative
