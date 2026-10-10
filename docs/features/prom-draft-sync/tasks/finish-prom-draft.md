---
id: T137
title: "Крок «довершити»: чернетка, наявність і лічильник фото"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1600
blocked_by: [T136]
blocks: [T138]
updated_at: "2026-10-10"
---

# T137 — Крок «довершити»: чернетка, наявність і лічильник фото

## Context

`PromSyncService.finish(runId)` доводить до кінця те, що вже сталося на Prom. Кожен виклик
ідемпотентний, тож `retryLimit` > 0.

1. Знайти товар за зовнішнім id. Немає попри звіт → `failed`, `prom_rejected`.
2. Записати `prom_product_id` — відтепер повтор знає, з яким товаром працює.
3. `makeDraft`: `status: draft` і `presence: available` **одним викликом**, тож або обидва, або
   жоден. Невдача → `failed`, `prom_not_draft`; товар лишається видимим, але «немає в наявності»
   (AC-11). Після повтору для фото Prom повертає товар на вітрину (`on_display`), тож чернетку
   ставить саме цей крок ([ADR 0030](../adr/0030-identify-the-prom-product-by-the-card-id.md)).
4. K = `images.length` товару: головне фото входить у `images` (звірено 2026-10-10). K < N →
   `failed`, `prom_photos_incomplete`, `images_on_prom` = K. Інакше — `succeedRun`: одна
   транзакція пише `products.prom_id` і `succeeded` ([T131](add-prom-sync-repository.md)).
   `succeedRun` повернув `false` (id товару вже записано іншій картці) → `failed`,
   `prom_sync_failed`, `error` у лог: повтор кроку дав би той самий конфлікт.

Доступ недійсний на будь-якому виклику → `failed`, `prom_access_denied`.

Нескачане фото Prom показує в `errors[].download_images` (код 2004), але рахувати K за звітом не
можна: Prom дочитує фото пізніше за статус. K береться з товару.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарії 1 і 4:

> `worker->>prom: товар за зовнішнім id`
> `worker->>prom: статус «чернетка»`
> `worker->>prom: наявність «в наявності»`
> `worker->>prom: читає фото товару — K`
> `worker->>pg: фото N з N, пише products.prom_id, відправка succeeded`
> `worker->>prom: статус «чернетка», наявність «в наявності»`

## Data delta

`product_prom_sync_runs`: `prom_product_id`, `images_on_prom`, `status`, `error_code`,
`finished_at`. На `succeeded` — ще `products.prom_id` в тій самій транзакції, під
`products_prom_id_key`. Схема не змінюється.

## API contract excerpt

```yaml
        | `prom_photos_incomplete` | чернетка є, фото K < N (AC-12) | є, `promProductId` | «Повторити» без другої чернетки |
        | `prom_not_draft` | товар створено, переведення в чернетку не вдалося (AC-11) | є, «немає в наявності» | «Повторити» — лише переведення |
        imagesOnProm:
          type: [integer, "null"]
```

## Acceptance criteria

**AC-01** (US-01) — happy path, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** Prom створив товар з усіма 4 фото
**When** виконується «довершити»
**Then** товар — чернетка «в наявності», відправка `succeeded` з `imagesOnProm` = 4, `products.prom_id` записано; `published_prom` не змінено (AC-15)

**AC-11** (US-03) — без чернетки
**Given** `edit_by_external_id` повертає помилку
**When** виконується «довершити»
**Then** відправка `failed` з `prom_not_draft`, `prom_product_id` записано, `products.prom_id` — `null`

**AC-12** (US-04) — частина фото
**Given** у товару 3 фото з 4
**When** виконується «довершити»
**Then** товар уже чернетка, відправка `failed` з `prom_photos_incomplete` і `imagesOnProm` = 3

## Checklist

1. `PromSyncService.finish(runId)` за кроками вище; spec на кожну гілку з адаптером-двійником.
2. Порядок: чернетка ставиться **до** підрахунку фото, щоб частковий результат не лишав товар на вітрині.
3. `succeedRun` повернув `false` (конфлікт `products_prom_id_key`) → `prom_sync_failed` без throw; spec. Інші збої БД кидаються, і `pg-boss` повторює крок.
4. Лог: `runId`, `prom_product_id`, K і N.
5. Відправка вже не `running` (її закрив свіп, поки задача чекала) — крок нічого не робить, лише пише лог; spec.

## Out of scope

- Свіп завислих і підписка `worker` ([T138](close-stuck-prom-sync-runs.md)).
- Тексти станів на картці ([T140](show-prom-sync-result.md)).

## DoD

- [ ] `published_prom` цим кроком не пишеться.
- [ ] Тести зелені.
- [ ] Прохід `critical-path-review`: запис `prom_id` з транзакцією.
- [ ] Коміт: `feat(marketplace): finish the Prom draft and count its photos`.

## Links

- [events.md](../contracts/events.md), `finish` · [ADR 0029](../adr/0029-record-each-prom-sync-as-its-own-run.md) · [ADR 0030](../adr/0030-identify-the-prom-product-by-the-card-id.md)
