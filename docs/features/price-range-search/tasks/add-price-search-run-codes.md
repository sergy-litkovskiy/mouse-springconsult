---
id: T108
title: "Коди запуску price_not_found і price_quota_exhausted"
status: Blocked
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1500
blocked_by: [T106]
blocks: [T112, T115]
updated_at: "2026-10-08"
---

# T108 — Коди запуску price_not_found і price_quota_exhausted

## Context

PRD вимагає трьох різних повідомлень про невдалий пошук. Сьогодні є лише `price_unavailable`
([ADR 0023](../adr/0023-classify-price-search-failures-and-never-retry-them.md)). Два нові
значення — це словник `errorCode` **запуску**, а не HTTP-коди. Тому в `error-codes.ts` вони
не йдуть: пише їх `worker`, а читає `web/products/run-failure-messages.ts`
([api-sync-report.md](../contracts/api-sync-report.md), Section B п.2).

**Нероздільно з фронтом, і це названий виняток.** `runFailureMessages` має тип `Record` над
enum контракту, тож новий код без тексту ламає typecheck `web`. Обидва тексти йдуть у цей
самий PR. Залежність тексту `price_unavailable` від області лишається
[T115](enable-find-price-button.md).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарії 3 і 4, кроки, де з'являються нові коди:

> `worker->>pg: finishRun failed price_quota_exhausted + пропозиції текстів`
> `worker->>pg: finishRun failed price_not_found, без пропозицій`

## Data delta

| Колонка | Зміна |
|---|---|
| `product_preparation_runs.error_code` | два нові значення; `VARCHAR(64)` без CHECK, тож міграції немає ([data-model.md](../data-model.md)) |

Перелік розширюється в union `PreparationErrorCode`, а не в БД.

## API contract excerpt

```yaml
        errorCode:
          type: [string, "null"]
          enum: [price_unavailable, price_not_found, price_quota_exhausted, preparation_failed, null]
            - `price_not_found` — відповідь не розібралась як вилка: немає 1–5 оголошень з
            - `price_quota_exhausted` — Gemini відповів 429 з ознакою добової квоти (AC-09).
```

## Acceptance criteria

**AC-09** (US-06), [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** денний ліміт пошуку вичерпано
**When** запуск закрито `price_quota_exhausted`
**Then** user бачить, що ліміт пошуку на сьогодні вичерпано і спробувати можна наступного дня, і це не видано за звичайний збій

**AC-10** (US-06)
**Given** пошук завершився без вилки
**When** запуск закрито `price_not_found`
**Then** user бачить, що вилку не знайдено, і пропозицію повторити чи уточнити назву

## Checklist

1. `contracts/ai.contract.ts`: `errorCode` у `preparationRunSchema` отримує `price_not_found` і `price_quota_exhausted`. Коментар над ним переписати під чотири коди. Плюс кейси в `ai.contract.spec.ts`.
2. `modules/products/preparation/PreparationRun.ts`: union `PreparationErrorCode` і doc-коментар до нього.
3. `web/products/run-failure-messages.ts`: два тексти за [sad.md §6](../sad.md#6-runtime-view) і AC-09, «Вилку не знайдено — повторіть чи уточніть назву.» і «Ліміт пошуку на сьогодні вичерпано — спробуйте наступного дня.». Каталог показує їх у переліку невдалих запусків без окремих змін.
4. Контракт [product-creation-flow](../../product-creation-flow/contracts/openapi.yaml): `PreparationRun.errorCode` знає два коди. Дописати нові з лінком на цей контракт ([api-sync-report.md](../contracts/api-sync-report.md), Follow-up).

## Out of scope

- Хто й коли пише ці коди ([T112](search-price-through-gemini.md)).
- Текст `price_unavailable` для запуску `price`, де текстів не було ([T115](enable-find-price-button.md)).

## DoD

- [ ] `typecheck` і `test` обох застосунків зелені.
- [ ] Жодного нового значення в `error-codes.ts`.
- [ ] Коміт: `feat(ai): add the price search run failure codes`.

## Links

- [ADR 0023](../adr/0023-classify-price-search-failures-and-never-retry-them.md) №2–4, №6 · [CONTEXT.md](../CONTEXT.md), Sentinel errors
