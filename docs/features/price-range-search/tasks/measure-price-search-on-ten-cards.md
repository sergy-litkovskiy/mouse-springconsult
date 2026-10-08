---
id: T106
title: "Гейт заміру: пошук вилки на 10 реальних картках, go або no-go"
status: Blocked
delivery: 1
gate_profile: decision
owner: "Serhii"
estimate: S
context_budget: 2400
blocked_by: [T105]
blocks: [T107, T108, T110]
updated_at: "2026-10-08"
---

# T106 — Гейт заміру: пошук вилки на 10 реальних картках, go або no-go

## Context

Рубіж між поставками ([sad.md §1](../sad.md#1-introduction-and-goals), «Поставка з гейтом»).
Поставка 2, тобто контракт, `worker` і UI, починається лише після go, а no-go обмежує втрату
одним-двома днями. Мірило go/no-go задає [PRD §7](../PRD.md#7-metrics--kpis): вилка з
оголошеннями-джерелами вживаних речей у гривнях **щонайменше для 5 з 10** карток і **не більше
2 з 10** хибних вилок серед знайдених.

**Перший виклик** перевіряє лише доступ: чи відкриває ключ, створений 2026-10, модель
`gemini-2.5-flash`. Безкоштовний пошук Google є лише на 2.5, а нові проєкти Google відсилає на
3.x (§11, ризик High). Немає доступу — no-go одразу, без решти дев'яти карток.

Прогін діагностичний. Одноразовий скрипт кличе [T105](add-gemini-adapter.md) напряму за
назвою й описом реальних карток з бази і в поставку не входить, як і в
[T27](../../product-creation-flow/tasks/add-anthropic-adapter.md). Вибірка змішана:
популярні речі й рідкісні. Пошук безкоштовний, тож обмеження одне: 500 запитів на добу,
спільних для обох моделей 2.5.

**Відкриті питання, які закриває рішення:**

1. Go чи no-go за порогом PRD §7.
2. `config.ai.priceSearch.model`: Flash чи Flash-Lite ([PRD §8](../PRD.md#8-open-questions)).
3. `config.ai.priceSearch.maxFrames`: 0–3, і чи надсилати кадри взагалі (PRD §8).
4. Звідки брати посилання оголошень: з тексту моделі чи з редиректів `groundingChunks` (§11, Medium).
5. Тіло реального 429, якщо воно трапиться: чи справді ознака добової квоти — `quotaId` з `PerDay` ([ADR 0023](../adr/0023-classify-price-search-failures-and-never-retry-them.md) №3).
6. Умови Gemini API: пункт про ЄЕЗ і те, що grounding там описано як Paid Service (§11, обидва з строком 2026-10-15).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 1. Замір перевіряє саме ці кроки, але ще без
`api`, черги й запису:

> `worker->>gemini: generateContent + googleSearch за назвою й описом (до 3 кадрів — за підсумком заміру)`
> `gemini-->>worker: текст з JSON вилки й оголошень + groundingMetadata`
> `worker->>worker: zod-розбір, 1–5 оголошень http/https, priceFrom ≤ priceTo, обидві > 0`

## Data delta

**Схема не змінюється за жодного рішення** ([data-model.md](../data-model.md), Migrations). Від
рішення залежить лише вміст наявних колонок:

| Рішення | Що стає в схемі |
|---|---|
| go, Flash чи Flash-Lite | `product_preparation_runs.model` — `gemini-2.5-flash` (16) чи `gemini-2.5-flash-lite` (21) символів у `VARCHAR(64)` |
| посилання — редиректи | `listings[].url` у `value` пропозиції `price` — адреса `vertexaisearch…`, у межах тих самих 2048; форма `value` та сама |
| no-go | нічого: поставка 2 не стартує, жодного рядка з новою формою не з'являється |

## API contract excerpt

Значення, яке рішення фіксує в константі й показує в контракті:

```yaml
        model:
          type: string
          maxLength: 64
          example: gemini-2.5-flash
```

## Acceptance criteria

Задача AC не реалізує. Вона **перевіряє** поріг, від якого залежать AC-01 і AC-10:

**KPI ([PRD §7](../PRD.md#7-metrics--kpis)) — поріг go**
**Given** 10 реальних карток, змішано популярних і рідкісних, з назвою й описом
**When** для кожної виконано один пошук через `GeminiAdapter`
**Then** go, якщо вилка з 1–5 оголошеннями вживаних речей у гривнях є щонайменше для 5 з 10, а хибних серед знайдених не більше 2

**QG-2 ([sad.md §10](../sad.md#10-quality-requirements)) — без джерел вилки немає**
**Given** відповідь моделі без оголошень, з межами, що не утворюють вилку, чи з посиланням не `http(s)`
**When** адаптер і перевірка інваріанту її розбирають
**Then** вона рахується як «вилку не знайдено», а не як знайдена вилка

## Checklist

1. Перший виклик із ключем на `gemini-2.5-flash`: доступ є чи ні. Немає — no-go, далі одразу пункт 7.
2. Прогін на 10 картках. Для кожної в story записати назву, вилку, оголошення, `webSearchQueries`, адреси `groundingChunks`, токени й тривалість.
3. Оцінка власника по кожній картці: чи оголошення справді про вживану річ тієї самої моделі й у гривнях. Підсумок: знайдено N з 10, хибних M.
4. Порівняти Flash і Flash-Lite на тих самих картках, а з кадрами й без — щонайменше на трьох. Вписати обрані `model` і `maxFrames` у `config.ts`.
5. Звірити посилання з тексту з редиректами `groundingChunks`: чи вигадує модель адреси. Якщо вигадує — рішення брати редиректи й правка [T105](add-gemini-adapter.md) окремим комітом.
6. Перечитати умови Gemini API щодо ЄЕЗ і «Paid Service»; висновок записати в story і закрити відповідне питання [PRD §8](../PRD.md#8-open-questions).
7. Записати рішення в `sad.md` §11: закреслити рядки «доступ до 2.5», «Flash чи Flash-Lite», «вигадані адреси» з датою. На no-go T107–T118 переходять у `Deferred` у [tracker.md](tracker.md), а власник вирішує, чи лишати в коді T104–T105.

## Out of scope

- Будь-які зміни контракту, `worker` чи UI: це поставка 2, яка стартує лише після go.
- Платний рівень Gemini, бо це non-goal [PRD §3](../PRD.md#3-non-goals). Якби він знадобився, це було б окреме рішення власника.

## DoD

- [ ] Рішення go чи no-go записано в story з числами N і M, а не враженням.
- [ ] `model` і `maxFrames` у `config.ts` дорівнюють обраним; на no-go лишаються як були.
- [ ] Ключ не потрапив ні в скрипт у git, ні в story.
- [ ] Одноразовий скрипт видалено після прогону.
- [ ] Коміт: `docs(price-range-search): record the price search measurement` (плюс `fix(ai): …`, якщо пункт 5 змінив адаптер).

## Links

- [sad.md §1](../sad.md#1-introduction-and-goals) · [sad.md §11](../sad.md#11-risks-and-technical-debt) · [PRD §7](../PRD.md#7-metrics--kpis) · [PRD §8](../PRD.md#8-open-questions)
- [ADR 0019](../../product-creation-flow/adr/0019-keep-price-search-out-of-generate-all.md), попередній no-go: 1 з 4
