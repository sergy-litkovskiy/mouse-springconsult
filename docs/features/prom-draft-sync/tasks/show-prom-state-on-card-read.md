---
id: T134
title: "Картка віддає promId, посилання на кабінет і останню відправку"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1600
blocked_by: [T124, T126, T131]
blocks: [T139]
updated_at: "2026-10-10"
---

# T134 — Картка віддає promId, посилання на кабінет і останню відправку

## Context

Читання картки отримує стан на Prom. Без нього фронт не сховає кнопку (AC-14) і після
перезавантаження сторінки не покаже підсумок відправки (AC-07…AC-12):

- **`Product`** (і в списку, і в одній картці): `promId` — вже є колонка `products.prom_id`;
  `promCabinetUrl` — похідне поле з шаблону `config.prom.cabinetProductUrlTemplate`, `null` разом з
  `promId`. Так само, як `ProductImage.url` складається з `r2Key`
  ([ADR 0007](../../product-creation-flow/adr/0007-serve-images-from-a-public-bucket.md)).
- **`ProductCardRead`**: `latestPromSyncRun` — остання відправка за `created_at`, зокрема
  завершена, або `null`. Дотягується другим запитом через `findLatestRun`
  ([T131](add-prom-sync-repository.md)), як пропозиції.

Мапінг DTO відправки — той самий, що в контролері відправки ([T132](start-prom-sync-run.md)).
Якщо T132 змержено раніше, його варто винести в спільну функцію `products/prom-sync/`, а не
копіювати. Блокер T126 — файловий: обидві story правлять `Product` у контракті й мапінг у
`ProductController`.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 1 — читання, з якого фронт бере стан:

> `web->>api: стан відправки`
> `api-->>web: етап, лічильник фото, посилання на товар у кабінеті`
> `web-->>user: одна чернетка з усіма фото; кнопки більше немає (AC-14)`

## Data delta

**Немає запису.** Читання `products.prom_id` і `product_prom_sync_runs` через
`product_prom_sync_runs_product_id_idx` ([data-model.md](../data-model.md), access patterns).

## API contract excerpt

```yaml
        promId:
            `products.prom_id` — єдина ознака «товар уже на Prom» і для 557 імпортованих карток, і
            для відправлених кнопкою. Не `null` — кнопки «Синхронізувати з Prom» немає (AC-14).
        promCabinetUrl:
          description: Посилання на товар у кабінеті Prom; `null` разом з `promId`.
            latestPromSyncRun:
                Остання відправка картки за `created_at`, зокрема завершена; `null`, якщо картку
                ще не відправляли. Читається через `product_prom_sync_runs_product_id_idx`
```

## Acceptance criteria

**AC-14** (US-01) — domain invariant, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** картка, імпортована з експорту Prom, з `prom_id` 2000000002
**When** фронт читає картку
**Then** `promId` = `"2000000002"`, `promCabinetUrl` = `https://my.prom.ua/cms/product/edit/2000000002`, `latestPromSyncRun` = `null`

**AC-12** (US-04) — після перезавантаження
**Given** остання відправка картки `failed` з `prom_photos_incomplete`, фото 2 з 4
**When** user перезавантажує сторінку картки
**Then** `latestPromSyncRun` несе код, `imagesOnProm` 2 з `imagesTotal` 4 і посилання на товар

## Checklist

1. `products.contract.ts`: `promId`, `promCabinetUrl` у `Product`; `latestPromSyncRun` у читанні картки — через `promSyncRunSchema` з `prom-sync.contract.ts`.
2. `ProductController` / `ProductService`: мапінг `promId` і `promCabinetUrl` у картці й списку; `latestPromSyncRun` — другим запитом в одній картці. Spec маршрутів.
3. Спільний мапінг DTO відправки з `promCabinetUrl` у `products/prom-sync/`, якщо його ще немає.
4. Фронт: типи приходять з `@contracts`; typecheck `web` зелений без змін коду.

## Out of scope

- Що фронт робить з цими полями ([T139](add-prom-sync-button.md), [T140](show-prom-sync-result.md)).

## DoD

- [ ] Шаблон адреси кабінету знає лише бекенд.
- [ ] Тести обох застосунків зелені.
- [ ] Коміт: `feat(products): read the Prom state with the card`.

## Links

- [openapi.yaml](../contracts/openapi.yaml) `Product`, `ProductCardRead`, `ProductCardReadOnProm`
- [api-sync-report.md](../contracts/api-sync-report.md), рішення №2
