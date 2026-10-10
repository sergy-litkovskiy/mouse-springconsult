---
id: T140
title: "Стан відправки на картці: лоадер, підсумок, «Повторити», «Перевірити ще раз»"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1800
blocked_by: [T133, T139]
blocks: [T143]
updated_at: "2026-10-10"
---

# T140 — Стан відправки на картці: лоадер, підсумок, «Повторити», «Перевірити ще раз»

## Context

Після натискання ([T139](add-prom-sync-button.md)) картка показує, що відбувається з відправкою і
чим вона закінчилась (US-03). Стан береться з відповіді старту, далі з поллера, а після
перезавантаження — з `latestPromSyncRun` картки.

- **Поллер** — як `preparation-run-poller.ts`: `GET …/prom-sync-runs/{runId}`, поки `queued` чи
  `running`. Інтервал — константа фронту в кілька секунд: стан у БД `worker` оновлює не частіше
  разу на 30 с, тож питати частіше немає сенсу.
- **`queued`/`running`** — лоадер «Prom ще обробляє картку» (AC-10). Ні помилки, ні успіху.
- **`succeeded`** — «Чернетку створено, фото N з N» і посилання на кабінет; published-prom не
  змінюється (AC-01, AC-15). Далі кнопки немає (AC-14).
- **`failed`** — текст українською за кодом з одного місця (`prom-sync-failure-messages.ts`), а не
  сирий текст Prom (AC-07). Дія за кодом:
  - «Перевірити ще раз» — лише для `prom_timeout` (`POST …/recheck`);
  - «Повторити» — для решти, з поясненням для `prom_photos_incomplete` і `prom_not_draft`, що
    другої чернетки не буде; посилання на товар — якщо є `promCabinetUrl` (AC-11, AC-12).

Друга вкладка, що натиснула під час активної відправки, отримує `200` з поточною і показує її
(AC-13).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарії 1–4:

> `web-->>user: «Чернетку створено, фото N з N», посилання; published-prom не змінюється`
> `web-->>user: «доступ до Prom треба поновити» або «Prom зайнятий іншим імпортом, спробуйте пізніше»; кнопка доступна`
> `api-->>web: running — лоадер «Prom ще обробляє картку»`
> `web-->>user: «Prom не завершив обробку», кнопка «Перевірити ще раз»`
> `user->>web: «Повторити»`

## Data delta

**Немає.** Фронт читає `PromSyncRun` і пише лише через `POST …/prom-sync-runs` і `…/recheck`.

## API contract excerpt

```yaml
        | Код | Що сталося | Товар на Prom | Що пропонує картка |
        | `prom_busy` | у Prom уже йде інший імпорт (AC-09) | немає | «Повторити» пізніше |
        | `prom_timeout` | імпорт подано, остаточного звіту за 30 хв немає (AC-10); або свіп закрив завислу відправку з `prom_import_id` | невідомо | «Перевірити ще раз» |
        | `prom_photos_incomplete` | чернетка є, фото K < N (AC-12) | є, `promProductId` | «Повторити» без другої чернетки |
      summary: Prom ще обробляє імпорт — лоадер, а не помилка й не успіх (AC-10)
```

## Acceptance criteria

**AC-12** (US-04) — частина фото, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** відправка `failed` з `prom_photos_incomplete`, фото 2 з 4
**When** user відкриває картку
**Then** видно «частково: фото 2 з 4», посилання на товар і «Повторити» з поясненням, що другої чернетки не буде

**AC-10** (US-03) — довга обробка
**Given** відправка `running`
**When** перший звіт Prom з нулями
**Then** лоадер «Prom ще обробляє картку» не зникає; після `prom_timeout` — «Prom не завершив обробку» і «Перевірити ще раз»

**AC-07** (US-03) — відмова
**Given** відправка `failed` з `prom_unavailable`
**When** картка показує результат
**Then** текст українською без подробиць Prom, значення полів картки не змінено, «Повторити» доступна

## Checklist

1. `prom-sync-run-poller.ts` за зразком `preparation-run-poller.ts`; spec з фейковим часом.
2. Компонент стану в `products/prom-sync/`; тексти за кодом — `Record` над `PromSyncRunDto['errorCode']`, щоб новий код ламав typecheck.
3. «Повторити» → `startPromSync`; «Перевірити ще раз» → `recheckPromSync` у `products-api.ts`.
4. Специ на кожен стан і кожен із восьми кодів.
5. Playwright з підміною відповідей API: лоадер → «Чернетку створено, фото 4 з 4»; `prom_photos_incomplete` → «Повторити»; `prom_timeout` → «Перевірити ще раз».

## Out of scope

- Живий прогін ([T143](verify-prom-draft-sync.md)).

## DoD

- [ ] Сирий текст Prom ніде не показується: код → текст лише на фронті.
- [ ] Тести й typecheck `web` зелені; Playwright-перевірка пройдена.
- [ ] Коміт: `feat(web): show the Prom sync state on the card`.

## Links

- [openapi.yaml](../contracts/openapi.yaml) `PromSyncErrorCode`, приклади `PromSyncRun*` · [PRD §5](../PRD.md#5-acceptance-criteria) AC-07–AC-15
