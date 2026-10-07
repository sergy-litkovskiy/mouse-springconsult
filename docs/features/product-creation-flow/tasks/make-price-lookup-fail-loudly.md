---
id: T98
title: "Пошук ціни падає видимо, коштує передбачувано й не переживає спробу"
status: Deferred
delivery: 4
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2000
blocked_by: [T96, T97]
blocks: [T99]
updated_at: "2026-10-07"
---

# T98 — Пошук ціни падає видимо, коштує передбачувано й не переживає спробу

> **Відкладено 2026-10-07 рішенням власника** ([ADR 0019](../adr/0019-keep-price-search-out-of-generate-all.md)).
> Замір [T96](decide-price-range-in-generate-all.md) дав no-go: вилку не знайдено в трьох викликах із
> чотирьох, а вартість одного «Згенерувати все» з ціною сягала $0,17–0,36 при стелі $0,15. Нижче —
> story на момент відкладення, без змін.

## Context

Пункти 1–7 скасованої [T54](bound-the-model-call-timeout.md) в межах адаптера. Що саме
зламано, T54 описала замірами; тут — лише фікси.

**1. Порожня вилка проходить як успіх.** `PriceSchema` описує межі як `z.string()` без
`.min(1)`, тож `""` валідний. Після правки порожня межа, порожній `sources` або нижня межа
більша за верхню піднімають `ModelAnswerUnavailable`.

**2. Межа має бути десятковим рядком.** Контракт читання перевіряє `priceFrom`/`priceTo`
регекспом `priceDecimal` (`products.contract.ts`). Відповідь моделі на кшталт «1 200 грн»
зламала б читання **всієї** картки. Адаптер нормалізує межу: прибирає пробіли й валюту,
кома стає крапкою, результат має два знаки (`"1200.00"`). Що не нормалізується —
`ModelAnswerUnavailable`. Відповідь моделі є недовіреним вводом (`AGENTS.md`), тож перевірка
стоїть на межі адаптера.

**3. Відхилена відповідь теж оплачена.** Зараз `ModelAnswerUnavailable` кидається до того,
як адаптер поверне `usage`, тож токени й пошуки відхиленої відповіді у вартість не потрапляють.
Помилка отримує `usage`, і [T99](find-price-from-generated-texts.md) його записує.

**4. Пошук обмежено.** `allowed_domains: prom.ua, olx.ua, shafa.ua`; `max_uses` і `effort.price`
взято з ADR 0019 ([T96](decide-price-range-in-generate-all.md)), а не з цього файлу.

**5. Таймаут клієнта коротший за спробу.** Клієнт створюється як `new Anthropic({ apiKey })`,
а дефолтний таймаут SDK довший за `expireInSeconds` = 300 с. Тому pg-boss запускав другу спробу
поверх живої першої. Опції таймауту й повторів — явні, з назвами й одиницями з ADR 0019. Умова:
таймаут × (повтори + 1) < `expireInSeconds`, і тест її фіксує, щоб зміна однієї константи її не
зламала мовчки.

**6. Лог.** Тривалість виклику й кількість пошуків — у `logger` адаптера: без них наступний
дефект знову закінчиться гіпотезами (T54).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 8. Задача живе між цими кроками:

> `worker->>anthropic: web_search з локацією UA — складений запит і відповідники на майданчиках`
> `anthropic-->>worker: діапазон «від — до»`
> `anthropic--xworker: помилка після вичерпання спроб`

Скільки триває проміжок між першим і третім, тепер обмежує клієнт, а не черга.

## Data delta

**Немає.** Кількість пошуків пише [T97](record-web-searches-per-run.md); ця задача змінює лише
адаптер і `config.ts`.

## API contract excerpt

```yaml
        value:
          description: >-
            Рядок для title*/description*, масив рядків для seoKeywords,
            {priceFrom, priceTo} для price (десяткові рядки, як і products.price).
```

Саме «десяткові рядки» адаптер зараз не гарантує. Після задачі гарантує.

## Acceptance criteria

AC-89 і AC-90 нові, до [PRD §5](../PRD.md#5-acceptance-criteria) їх вносить крок 8 чекліста.

**AC-89 (US-04) — domain invariant**
**Given** модель повернула межу «1 200 грн» або «1200,5»
**When** адаптер розбирає відповідь
**Then** межі стають `"1200.00"` і `"1200.50"`, а читання картки не падає на `priceDecimal`

**AC-89 — error**
**Given** модель повернула порожню межу, порожні `sources`, нижню межу більшу за верхню або текст без числа
**When** адаптер розбирає відповідь
**Then** це `ModelAnswerUnavailable` з `usage` виклику, а не результат

**AC-90 — domain invariant**
**Given** виклик моделі триває довше, ніж відведено спробі
**When** pg-boss доходить до межі `expireInSeconds`
**Then** клієнт уже обірвав виклик власним таймаутом із повторами, і друга спроба не йде поверх живого виклику

## Checklist

1. `AnthropicAdapter.spec.ts` на двійнику, без мережі: нормалізація меж, чотири відмови AC-89, `usage` на помилці.
2. `AnthropicAdapter.ts`: `PriceSchema` з `.min(1)` і непорожніми `sources`; нормалізація меж; `ModelAnswerUnavailable` несе `usage`.
3. `web_search`: `allowed_domains`, `max_uses` з ADR 0019; `config.ai.effort.price` з ADR 0019.
4. `config.ts`: таймаут і повтори клієнта з одиницями з ADR 0019, з коментарем, з якого виміру.
5. Тест умови AC-90 над константами `config.ts`.
6. `new Anthropic({ apiKey, … })` з обома опціями явно.
7. Лог тривалості й кількості пошуків на кожен виклик `findPriceRange`.
8. `PRD.md §5`: AC-89, AC-90.

## Out of scope

- Вхід пошуку зі згенерованих текстів і статус запуску — [T99](find-price-from-generated-texts.md).
- Стеля вартості в `config.ts`: стелю $0,15 перевіряє замір T96, а не код.
- Показ `sources`.

## DoD

- [ ] AC-89, AC-90 покрито тестами на двійнику.
- [ ] Тести `api` зелені, `typecheck`, `lint`, `deps:check` зелені.
- [ ] Коміт: `fix(ai): make the price lookup fail loudly and cost predictably`.

## Links

- [T54](bound-the-model-call-timeout.md) — замір і три дефекти · [T96](decide-price-range-in-generate-all.md) — ADR 0019
- [T27](add-anthropic-adapter.md) — адаптер · [T52](close-stuck-preparation-runs.md) — поріг завислого запуску
