---
id: T103
title: "Узгодити PRD, CLAUDE.md і відкриті пункти контракту з архітектурою пошуку ціни"
status: Todo
delivery: 0
gate_profile: docs
owner: "Serhii"
estimate: S
context_budget: 2300
blocked_by: []
blocks: [T104]
updated_at: "2026-10-08"
---

# T103 — Узгодити PRD, CLAUDE.md і відкриті пункти контракту з архітектурою пошуку ціни

## Context

Прохід 04-05 залишив чотири рядки боргу зі строком «до `break-tasks`»
([sad.md §11](../sad.md#11-risks-and-technical-debt)), і на момент розбивки жоден не закрито.
Ще два хвости лишили стейджі 08 і 10: у [data-model.md](../data-model.md) обидва `## Open items`
досі позначені `<!-- TBD -->`, хоча власник закрив їх 2026-10-08
([api-sync-report.md](../contracts/api-sync-report.md), «Рішення, прийняті цим прогоном»), а
Section C того звіту лишила відкритими імена пари в payload задачі `price`.

Задача править **лише документи**. `sad.md` і ADR не редагуються: вони є джерелом правок.
`ARCHITECTURE.md` і `SPEC.md` сюди не входять. За §11 їх правлять після go і разом із кодом
([T117](update-architecture-for-gemini.md), [T115](enable-find-price-button.md)).

## Sequence

**Не застосовується**, бо `gate_profile: docs` і рантайму задача не має. Речення PRD §1, яке
вона виправляє, суперечить кінцю [sad.md §6](../sad.md#6-runtime-view), сценарій 4:

> `api->>pg: попередній запуск завершено — новий запуск (ADR 0017 №6)`

## Data delta

**Немає.** Жодної таблиці, колонки чи міграції. Наслідок для схеми лише непрямий: закриті
TBD у `data-model.md` фіксують межу `listings[].url` (2048 символів) і відсутність правила
«ціна оголошення в межах вилки», тож CHECK чи колонка під це не з'являться.

## API contract excerpt

**Немає власного.** Правило ідемпотентності, яке PRD §1 описує застарілим, контракт уже
називає правильно:

```yaml
        **Ідемпотентність** — ключ сервера, а не заголовок клієнта: (картка, область, версія
        самий вхід, поки запуск у черзі чи йде, повертає його (`200`) — другий пошук не
        стартує (sad.md сценарій 4). Після `succeeded` чи `failed` той самий вхід ставить
        новий запуск (`201`) з новим запитом до Google (AC-07). Повтор ліміту частоти не
```

## Acceptance criteria

Нових AC задача не пише. Речення PRD §1, яке вона виправляє, пояснює два AC, і після правки
воно мусить їм не суперечити ([PRD §5](../PRD.md#5-acceptance-criteria)):

**AC-07** (US-05) — domain invariant
**Given** у картці вже є вилка або попередній пошук її не знайшов
**When** user знову натискає «Знайти ціну», навіть не змінивши назву й опис
**Then** система виконує новий пошук, і нова вилка замінює попередню; поки пошук іде, другий не стартує

**AC-03** (US-02) — cross-context
**Given** user запустив «Згенерувати все»
**When** тексти підготовлено
**Then** система шукає вилку за щойно підготовленими назвою й описом, навіть якщо в картку вони ще не збережені

## Checklist

1. [PRD.md](../PRD.md) §1, третій пункт traceability: правило «той самий вхід — той самий запуск» з 2026-10-02 діє лише для `queued`/`running` ([ADR 0017](../../product-creation-flow/adr/0017-keep-one-latest-suggestion-per-field.md) №6). AC-07 його не змінює, AC-03 змінює лише джерело входу (рядок §11 «Розходження: PRD §1»).
2. PRD §8: питання про підказки Google позначити закритим з лінком на [ADR 0024](../adr/0024-show-only-the-range-and-listing-links.md), а питання про старий пошук — з лінком на [ADR 0020](../adr/0020-search-price-ranges-through-gemini-in-the-ai-module.md) і [ADR 0021](../adr/0021-search-prices-from-the-run-input-not-the-saved-card.md). Питання про ЄЕЗ і Flash/Flash-Lite лишаються відкритими, їх закриває [T106](measure-price-search-on-ten-cards.md).
3. Кореневий [CLAUDE.md](../../../../CLAUDE.md), «Структура репозиторію»: «той самий Claude, інший метод сервісу» → «той самий модуль, інший постачальник» з лінком на ADR 0020.
4. [modules/ai/CLAUDE.md](../../../../apps/api/src/modules/ai/CLAUDE.md): Claude — тексти й поле, Gemini — вилка. Правила адаптера Gemini: SDK в одному файлі, без `retryOptions`, JSON розбирається з тексту, а не через structured outputs, `recordUsage` лише для Claude ([ADR 0023](../adr/0023-classify-price-search-failures-and-never-retry-them.md), [ADR 0025](../adr/0025-keep-gemini-calls-out-of-the-token-ledger.md)). Рядок про `web_search_20260209` позначити як «живе до [T107](remove-anthropic-price-search.md)», бо код пошуку через Anthropic до go лишається.
5. [data-model.md](../data-model.md) `## Open items`: обидва `<!-- TBD -->` замінити рішеннями з api-sync-report.md і лінком на нього. Те саме для TBD у рядку `listings[].url` таблиці.
6. [api-sync-report.md](../contracts/api-sync-report.md) Section C: прийняти імена `title`/`description` з [events.md](../contracts/events.md), однакові в `PreparationJob` і `PreparationRunJob`, і позначити пункт закритим.
7. У `sad.md` §11 закреслити рядки, закриті цією задачею, з датою. Рядки про `ARCHITECTURE.md` і `SPEC.md` лишаються відкритими.

## Out of scope

- `ARCHITECTURE.md`, бо його правлять після go разом із кодом ([T117](update-architecture-for-gemini.md)).
- `SPEC.md` ([T115](enable-find-price-button.md)).
- Умови Gemini API щодо ЄЕЗ і «Paid Service» перечитує власник у межах [T106](measure-price-search-on-ten-cards.md).

## DoD

- [ ] Пункти чеклиста 1–7 внесено. Жоден рядок §11 зі строком «до `break-tasks`» не лишився нерозглянутим.
- [ ] У `data-model.md` не лишилось `<!-- TBD -->`.
- [ ] `status` PRD і `data-model.md` не змінено, `updated_at` оновлено: правка узгоджує документ, а не перевідкриває його.
- [ ] Коміт: `docs(price-range-search): align PRD and module rules with the architecture`.

## Links

- [sad.md §11](../sad.md#11-risks-and-technical-debt), джерело пунктів 1–4 · [PRD §1](../PRD.md#1-context) · [PRD §8](../PRD.md#8-open-questions)
- [api-sync-report.md](../contracts/api-sync-report.md), «Рішення» і Section C · [data-model.md](../data-model.md), Open items
