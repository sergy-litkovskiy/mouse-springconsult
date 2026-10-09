---
id: T104
title: "Ключ Gemini, константи пошуку ціни, SDK і правило dep-cruiser"
status: Done
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1800
blocked_by: [T103]
blocks: [T105, T110]
updated_at: "2026-10-09"
---

# T104 — Ключ Gemini, константи пошуку ціни, SDK і правило dep-cruiser

## Context

Перший крок гейта заміру ([sad.md §1](../sad.md#1-introduction-and-goals)). Тут лише точки
збирання з [sad.md §5](../sad.md#5-building-block-view) і таблиця конфігурації з
[§7](../sad.md#7-deployment-view), без жодного виклику моделі. Адаптер пише
[T105](add-gemini-adapter.md).

Ключ **опційний**, як `ANTHROPIC_API_KEY`: тести, CI й `api` стартують без нього, і `worker`
без нього теж стартує (§7). Звірка репозиторію показала розходження з рядком §7 «передається
лише `worker`». `docker-compose*.yml` віддають увесь `.env` кожному контейнеру образу `api`
(`env_file: [.env]`), так само як і ключ Anthropic. Задача тримає наявний патерн: ключ читає
лише `worker.ts` ([_epic.md](_epic.md), «Звірка з репозиторієм»).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 1: виклик, для якого задача готує ключ, модель і
таймаут.

> `worker->>gemini: generateContent + googleSearch за назвою й описом (до 3 кадрів — за підсумком заміру)`

## Data delta

**Немає.** Конфігурація бази не бачить. Модель із `config.ai.priceSearch.model` згодом ляже в
`product_preparation_runs.model` (`VARCHAR(64)`; `gemini-2.5-flash-lite` має 21 символ,
[data-model.md](../data-model.md)), але пише її [T111](start-price-run-from-draft.md).

## API contract excerpt

Значення константи моделі, яке контракт показує в запуску `price`:

```yaml
        model:
          type: string
          maxLength: 64
          example: gemini-2.5-flash
```

## Acceptance criteria

Поведінки з PRD задача не реалізує. Вона тримає дві межі [PRD §6.1](../PRD.md#61-security--privacy)
і §7 SAD:

**AC (PRD §6.1, «Секрети»)**
**Given** ключ Gemini задано в `.env`
**When** стартує будь-який процес або пишеться будь-який лог
**Then** ключ живе лише в `process.env` через схему `src/config.ts` і не з'являється ні в логах, ні в `@environments`

**AC (sad.md §7, старт без ключа)**
**Given** `GEMINI_API_KEY` не задано
**When** стартують `api`, `worker` і тести
**Then** жоден із них не падає на валідації env; відсутній ключ є станом, а не помилкою конфігурації

## Checklist

1. `apps/api/package.json`: `@google/genai` 2.28.0 у тому стилі версій, що й решта залежностей. Встановити в контейнері (`mouse-commands`).
2. `src/config.ts` `envSchema`: `GEMINI_API_KEY: z.string().min(1).optional()`, з коментарем, чому опційний (за зразком `ANTHROPIC_API_KEY`).
3. `src/config.ts` `ai.priceSearch`: `model` (старт `gemini-2.5-flash`, остаточне значення обирає [T106](measure-price-search-on-ten-cards.md)), `timeoutMs`, `maxFrames` (0–3; до заміру значення неважливе, його обирає T106), `maxInputChars`. Це константи, а не env: модель змінює якість і квоту ([ai/CLAUDE.md](../../../../apps/api/src/modules/ai/CLAUDE.md)).
4. `.env.example`: закоментований `GEMINI_API_KEY` з приміткою, що це ключ проєкту Google AI Studio на free tier.
5. `apps/api/.dependency-cruiser.cjs`: правило `google-genai-sdk-stays-in-the-adapter` за зразком `anthropic-sdk-stays-in-the-adapter`. Дозволено лише з `src/modules/ai/GeminiAdapter.ts`, `to` — `^node_modules/@google/genai`.
6. [apps/api/CLAUDE.md](../../../../apps/api/CLAUDE.md), «Логи»: «ключі R2/Anthropic» → «ключі R2/Anthropic/Gemini» ([sad.md §8](../sad.md#8-crosscutting-concepts), «Логування»).

## Out of scope

- Адаптер і виклик моделі ([T105](add-gemini-adapter.md)).
- Створення адаптера в `worker.ts` і warn без ключа ([T112](search-price-through-gemini.md)).
- Рядок Gemini з нульовим тарифом у `config.ai.pricing`, бо він потрібен лише з першим запуском з моделлю Gemini ([T111](start-price-run-from-draft.md)).

## DoD

- [x] `typecheck` · `lint` · `test` · `deps:check` зелені без `GEMINI_API_KEY` у середовищі.
- [x] Пробний імпорт `@google/genai` з будь-якого файлу, крім `GeminiAdapter.ts`, `deps:check` відхиляє. Перевірено, а не припущено; пробу відкочено.
- [x] Ключ не потрапляє в лог на старті ні з ним, ні без нього.
- [x] Коміт: `feat(ai): add the Gemini key, price search constants and SDK boundary`.

## Links

- [sad.md §5](../sad.md#5-building-block-view), «Точки збирання» · [sad.md §7](../sad.md#7-deployment-view), таблиця конфігурації
- [ADR 0020](../adr/0020-search-price-ranges-through-gemini-in-the-ai-module.md) №1–3
