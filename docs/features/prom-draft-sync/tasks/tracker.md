---
status: Draft
owner: "Serhii"
reviewers: []
updated_at: "2026-10-10"
stage: "06"
---

# Tracker — prom-draft-sync

Тут записано статус кожної задачі; один рядок відповідає одному PR. Легенда розмірів, розріз по
поставках і граф залежностей — у [_epic.md](_epic.md).

**Статуси:** `Todo` · `Blocked` (чекає на deps) · `In progress` · `In review` · `Done` ·
`Deferred` (відкладено рішенням власника; нічого не блокує й у план не входить) ·
`Dropped` (скасовано рішенням власника; номер не перевикористовується).

## Зараз

**Готові до старту:** T121, T122, T123, T124, T125.
T121–T143 заведено 2026-10-10.

## Задачі

| ID | Задача | Статус | blocked_by | Est | Закрито |
|----|--------|--------|------------|-----|---------|
| T121 | [Розібрати «невірні дані» імпорту й закрити питання токена](resolve-prom-import-questions.md) | Todo | — | XS | |
| T122 | [Узгодити PRD з ADR 0032](align-prd-with-control-submission.md) | Todo | — | XS | |
| T123 | [Коди, межі Prom і DTO відправки](add-prom-sync-codes-and-limits.md) | Todo | — | S | |
| T124 | [Конфігурація Prom, токен і черга](add-prom-config-and-queue.md) | Todo | — | XS | |
| T125 | [Фронт без «Категорії»](remove-category-from-web.md) | Todo | — | S | |
| T126 | [Видалити `products.category`](drop-product-category.md) | Blocked | T125 | S | |
| T127 | [Назва для Prom ≤ 130 при збереженні](limit-prom-title-on-save.md) | Blocked | T123, T126 | XS | |
| T128 | [`marketplace` і `PromAdapter`](add-prom-adapter.md) | Blocked | T124 | S | |
| T129 | [`buildPromImportFile`](build-prom-import-file.md) | Blocked | T121, T128 | S | |
| T130 | [`promReadiness`](add-prom-readiness.md) | Blocked | T123 | XS | |
| T131 | [`PromSyncRepository`](add-prom-sync-repository.md) | Blocked | T123 | S | |
| T132 | [Старт і стан відправки](start-prom-sync-run.md) | Blocked | T124, T130, T131 | S | |
| T133 | [«Перевірити ще раз»](recheck-prom-sync-run.md) | Blocked | T132 | XS | |
| T134 | [Стан Prom у читанні картки](show-prom-state-on-card-read.md) | Blocked | T124, T126, T131 | S | |
| T135 | [Крок «подати»](submit-prom-import.md) | Blocked | T129, T132 | S | |
| T136 | [Крок «перевірити»](check-prom-import-status.md) | Blocked | T135 | S | |
| T137 | [Крок «довершити»](finish-prom-draft.md) | Blocked | T136 | S | |
| T138 | [`worker` і свіп завислих](close-stuck-prom-sync-runs.md) | Blocked | T137 | XS | |
| T139 | [Кнопка й підказки меж](add-prom-sync-button.md) | Blocked | T127, T132, T134 | S | |
| T140 | [Стан відправки на картці](show-prom-sync-result.md) | Blocked | T133, T139 | S | |
| T141 | [AI-назва для Prom ≤ 130](keep-ai-title-within-prom-limit.md) | Blocked | T123 | XS | |
| T142 | [`ARCHITECTURE.md`, `SPEC.md`, PRD product-creation-flow](update-architecture-for-prom.md) | Blocked | T126, T138 | XS | |
| T143 | [Приймання: QG-1–QG-3](verify-prom-draft-sync.md) | Blocked | T121, T122, T138, T140, T141, T142 | S | |
