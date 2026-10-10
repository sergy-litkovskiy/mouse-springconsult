---
id: T123
title: "Коди, межі Prom і DTO відправки в контракті"
status: Todo
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1800
blocked_by: []
blocks: [T127, T130, T131, T141]
updated_at: "2026-10-10"
---

# T123 — Коди, межі Prom і DTO відправки в контракті

## Context

Нижній шар фічі: усе, що бекенд валідує, а фронт імпортує. Три частини, і кожна живе у своєму
файлі за правилом «схеми окремо, константи окремо» (кореневий `CLAUDE.md`):

- **`products-limits.ts`** — межі Prom: назва 130, ключове слово 50, усі разом 1024 (рядок,
  склеєний через `", "`), фото 10. Фронт імпортує їх у рантаймі, тож без жодної залежності.
- **`error-codes.ts`** — три HTTP-коди відправки: `product_already_on_prom`, `prom_sync_not_ready`,
  `prom_sync_not_recheckable`. Класи-нащадки `AppError` — у `products/ProductErrors.ts`, бо маршрути
  живуть у `products/prom-sync/`.
- **`prom-sync.contract.ts`** — zod-схема DTO `PromSyncRun` і виведений тип; фронт бере звідси
  **тільки** `import type`.

Union `PromSyncErrorCode` в entity [`PromSyncRun.ts`](../../../../apps/api/src/modules/products/prom-sync/PromSyncRun.ts)
має сім кодів, а контракт — вісім: бракує `prom_sync_failed` (рішення №1
[api-sync-report.md](../contracts/api-sync-report.md)). Колонка `error_code` без CHECK, тож
міграції не треба.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 2 — коди, які пише `worker`:

> `worker->>pg: відправка failed, код prom_access_denied`
> `worker->>pg: відправка failed, код prom_busy`

## Data delta

**Схема не змінюється.** Змінюється TypeScript-union над наявною колонкою:
`product_prom_sync_runs.error_code VARCHAR(64)` без CHECK отримує восьме можливе значення
`prom_sync_failed` ([data-model.md](../data-model.md)).

## API contract excerpt

```yaml
    PromSyncErrorCode:
      type: string
      enum:
        - prom_access_denied
        - prom_busy
        - prom_rejected
        - prom_unavailable
        - prom_timeout
        - prom_sync_failed
        - prom_photos_incomplete
        - prom_not_draft
            code: { type: string, const: prom_sync_not_ready }
            code: { type: string, const: product_already_on_prom }
        error: { code: prom_sync_not_recheckable, message: "Only a run that timed out waiting for Prom can be checked again" }
```

## Acceptance criteria

**AC-06** (US-02) — error, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** ключові слова картки
**When** одне слово довше за 50 знаків або всі разом, склеєні через `", "`, довші за 1024
**Then** константи меж Prom у `products-limits.ts` дають однакову відповідь бекенду й фронту

**AC-07** (US-03) — external service failure
**Given** відправка завершилась відмовою
**When** DTO відправки проходить через `promSyncRunSchema`
**Then** `errorCode` — один із восьми кодів контракту або `null`, а будь-який інший рядок відхиляється

## Checklist

1. `products-limits.ts`: `promTitleMaxLength: 130`, `promKeywordMaxLength: 50`, `promKeywordsMaxTotal: 1024`, `promMaxImages: 10`, з коментарем про склеювання через `", "`.
2. `PromSyncRun.ts`: `prom_sync_failed` у union `PromSyncErrorCode`, коментар над union про відмови й часткові результати оновити.
3. `contracts/prom-sync.contract.ts`: `promSyncStatusSchema`, `promSyncErrorCodeSchema`, `promSyncRunSchema` за `PromSyncRun` з openapi (`promProductId` — `^\d{1,19}$`, `imagesTotal` 1–10, `imagesOnProm` ≥ 0 або `null`); `PromSyncRunDto` через `z.infer`. Spec поруч: вісім кодів проходять, дев'ятий — ні.
4. `error-codes.ts` + `ProductErrors.ts`: три коди й класи `ProductAlreadyOnProm` (409), `PromSyncNotReady` (409, `details: {missing, overLimit}`), `PromSyncNotRecheckable` (409). Spec класів — як у наявних.
5. `deps:check` і typecheck обох застосунків зелені: фронт ці константи ще не імпортує.

## Out of scope

- Межа 130 при збереженні картки ([T127](limit-prom-title-on-save.md)).
- Хто кидає нові класи ([T132](start-prom-sync-run.md), [T133](recheck-prom-sync-run.md)).
- Тексти українською за кодами відправки ([T140](show-prom-sync-result.md)).

## DoD

- [ ] Вісім кодів у zod-схемі, entity-union і openapi збігаються.
- [ ] `prom-sync.contract.ts` не імпортується фронтом у рантаймі.
- [ ] Тести обох застосунків зелені.
- [ ] Коміт: `feat(products): add the Prom sync codes, limits and run contract`.

## Links

- [openapi.yaml](../contracts/openapi.yaml) `PromSyncRun`, `PromSyncErrorCode`, `PromSyncNotReadyError`
- [data-model.md](../data-model.md) · [api-sync-report.md](../contracts/api-sync-report.md), рішення №1
