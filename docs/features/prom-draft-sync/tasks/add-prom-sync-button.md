---
id: T139
title: "Кнопка «Синхронізувати з Prom» і підказки меж у формі"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1600
blocked_by: [T127, T132, T134]
blocks: [T140]
updated_at: "2026-10-10"
---

# T139 — Кнопка «Синхронізувати з Prom» і підказки меж у формі

## Context

Нова підфіча `apps/web/src/app/products/prom-sync/` ([sad.md §5](../sad.md#5-building-block-view)).
Ця story дає кнопку і все, що вирішує, чи вона активна. Що відбувається після натискання, показує
[T140](show-prom-sync-result.md).

- **Кнопки немає**, якщо картка має `promId`. Замість неї — «Товар уже на Prom» і посилання
  `promCabinetUrl` у новій вкладці (AC-14).
- **Кнопка неактивна з підказкою**, якщо:
  - форма брудна: «Спершу збережіть картку — на Prom іде лише збережене» (AC-04);
  - збережена картка не готова: «На Prom іде лише готова картка», і перелік, чого бракує (AC-02);
  - збережена картка виходить за межі Prom: назва понад 130 (стара), ключові слова (AC-05, AC-06).
- **Біля ключових слів** ще до збереження видно, яке слово задовге для Prom (> 50) або на
  скільки перевищено загальну довжину (> 1024, через `", "`). Зберегти картку це не заважає (AC-06).

Підказка рахується за константами `products-limits.ts` з тим самим правилом, що `promReadiness`
([T130](add-prom-readiness.md)). Остаточно перевіряє бекенд: `409 prom_sync_not_ready` показується
тим самим текстом. `products-api.ts` отримує `startPromSync(productId)`. Стан форми — сигналами,
бо zoneless форму не відстежує.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 1:

> `user->>web: натискає «Синхронізувати з Prom»`
> `web->>api: запускає відправку картки`
> `api-->>web: відправка queued`

## Data delta

**Немає.** Фронт читає `promId`, `promCabinetUrl` і поля картки з
[T134](show-prom-state-on-card-read.md); пише лише через `POST …/prom-sync-runs`.

## API contract excerpt

```yaml
    PromSyncNotReadyError:
        `409 prom_sync_not_ready`. Готовність рахує бекенд на збереженій картці; фронт показує ту
        саму підказку заздалегідь за константами `products-limits.ts` і тримає кнопку неактивною
        (AC-02, AC-06). Хоч один масив непорожній.
```

## Acceptance criteria

**AC-02** (US-01) — domain invariant, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** збереженій картці бракує опису для OLX
**When** user відкриває картку
**Then** кнопка неактивна, підказка каже, що на Prom іде лише готова картка, і називає опис для OLX

**AC-04** (US-01) — cross-context
**Given** user змінив назву для Prom і ще не зберіг
**When** user дивиться на кнопку
**Then** кнопка неактивна з підказкою спершу зберегти картку

**AC-06** (US-02) — error
**Given** user додає ключове слово на 51 знак
**When** слово з'являється у формі
**Then** біля ключових слів видно, що воно задовге для Prom; картку можна зберегти, але кнопка неактивна

**AC-14** (US-01) — одноразова
**Given** картка має `promId`
**When** user відкриває картку
**Then** кнопки немає, є «Товар уже на Prom» з посиланням на кабінет

## Checklist

1. `products-api.ts`: `startPromSync(productId)` → `PromSyncRunDto`; spec.
2. Компонент кнопки в `products/prom-sync/` з входами `product` і `formDirty`; підказки за пріоритетом: на Prom → брудна форма → не готова → межі.
3. Підказка меж біля ключових слів у `product-form` — computed-сигнал над значенням контролу.
4. Специ компонентів на кожну гілку AC; тексти — українською, з одного місця.
5. Playwright: кнопка неактивна на брудній формі; активна на готовій збереженій; картка з `promId` показує посилання.

## Out of scope

- Стан після натискання, поллер, «Повторити», «Перевірити ще раз» ([T140](show-prom-sync-result.md)).

## DoD

- [ ] Фронт імпортує з `@contracts` лише константи `products-limits.ts` і `import type`.
- [ ] Тести й typecheck `web` зелені; Playwright-перевірка пройдена.
- [ ] Коміт: `feat(web): add the Prom sync button with readiness hints`.

## Links

- [openapi.yaml](../contracts/openapi.yaml) `startPromSyncRun`, `PromSyncNotReadyError` · [PRD §5](../PRD.md#5-acceptance-criteria) AC-02, AC-04–AC-06, AC-14
