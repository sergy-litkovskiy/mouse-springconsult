---
id: T35
title: "Фільтр «Картка готова» в каталозі"
status: Done
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1900
blocked_by: [T34, T36]
blocks: [T37]
updated_at: "2026-09-17"
---

# T35 — Фільтр «Картка готова» в каталозі

## Context

Запит 2026-09-16: у панелі фільтрів `/products` зʼявляється `mat-select` «Картка готова»
з варіантами «Всі», «Так», «Ні». Бекенд уже приймає `ready` після
[T34](add-readiness-list-filter.md). Порядок варіантів — як у двох фільтрах публікації
після [T36](relabel-published-filter-options.md): «Всі» першим, бо це стан за
замовчуванням. Тому T35 стоїть після T36 — третій select копіює вже виправлений шаблон.

Фільтр влаштований так само, як `publishedProm`: стан — у URL, форма його дзеркалить,
запит іде за inputs. `products-api.ts` не змінюється: `toParams` перетворює на параметр
кожне поле `ProductListQuery`, тож `ready` з контракту потрапить у запит без жодної правки.

Функції `toPublishedFilter` і `publishedControlValue` у `product-catalog-query.ts` нічого
не знають про публікацію — вони читають будь-який тризначний булевий фільтр. Із третім
споживачем їх варто перейменувати на `toFlagFilter` і `flagControlValue`, інакше назва
почне вводити в оману.

## Sequence

Власного сценарію фільтр не має: це стан форми й адресного рядка. [sad.md §6](../sad.md#6-runtime-view),
абзац «**Маркування в таблиці каталогу**», фіксує те саме для сусідньої ознаки:

> «Перелік прогалин рахується **на фронті** з полів, які й так приїхали в `Product` … а
> не окремим полем відповіді»

Фільтр, на відміну від бейджа, окремий запит **робить**: вибір значення →
`router.navigate` → input `ready` → новий `httpResource` з `ready=true|false`.

## Data delta

**Немає.** Задача не чіпає ні схеми, ні контракту — лише шаблон, компонент і його тест.
Значення фільтра — `'' | 'true' | 'false'` у формі й `boolean | undefined` у запиті, як у
`publishedProm`.

## API contract excerpt

Після T34 параметр `ready` має ту саму форму, що й сусідній:

```yaml
      operationId: listProducts
        - { $ref: "#/components/parameters/PublishedOlx" }
    PublishedOlx:
      name: publishedOlx
      in: query
      schema: { type: boolean }
```

## Acceptance criteria

AC-29 вносить у [PRD §5](../PRD.md#5-acceptance-criteria) [T34](add-readiness-list-filter.md);
AC-31 вносить ця story, кроком 5 чекліста.

**AC-29 (нове, UI) — happy path**
**Given** `user` відкрив `/products`
**When** він обирає «Картка готова: Так» (або «Ні») і натискає «Застосувати»
**Then** адреса отримує `ready=true` (або `ready=false`), запит іде з тим самим параметром, а пагінатор повертається на першу сторінку

**AC-31 (нове) — domain invariant**
**Given** адреса без параметра `ready` (або з недійсним `ready=yes`)
**When** каталог відкривається
**Then** select показує «Всі», у запиті параметра `ready` немає, а «Скинути» повертає фільтр у цей самий стан

## Checklist

1. `product-catalog-query.ts`: перейменувати `toPublishedFilter` → `toFlagFilter`, `publishedControlValue` → `flagControlValue`, оновити два наявні виклики.
2. `product-catalog.ts`: `readonly ready = input(…, { transform: toFlagFilter })`; `ready` в `appliedFilters`, в контролах форми (`'' | 'true' | 'false'`), в `effect`-синхронізації і в `applyFilters` (`''` → `null`).
3. `product-catalog.html`: `mat-form-field` «Картка готова» після двох фільтрів публікації — варіанти `''` «Всі», `true` «Так», `false` «Ні».
4. `product-catalog.spec.ts`: адреса `?ready=false` доходить до запиту; вибір у формі пише параметр і скидає `page`; відсутній і недійсний `ready` дають «Всі» без параметра.
5. `PRD.md §5`: AC-31 у формі Given/When/Then з лінком на цю story; до AC-29 дописати UI-частину.

## Out of scope

- Бейдж готовності в рядку й підказка з прогалинами — [T22](integrate-catalog-with-form-and-delete.md).
- Ширина поля — [T37](resize-catalog-filter-fields.md) ставить його у вузький ряд разом із фільтрами публікації.

## DoD

- [x] AC-29 (UI): «Так» і «Ні» доходять до запиту як `ready=true|false`; сторінка скидається на першу.
- [x] AC-31: без `ready` в адресі — «Всі» і жодного параметра в запиті; «Скинути» прибирає `ready`.
- [x] F5 і «Назад» відновлюють вибране значення з адреси.
- [x] Наявні тести `product-catalog.spec.ts` лишаються зеленими; нові випадки додано до них.
- [x] Коміт: `feat(web): filter the catalog by card readiness`.

## Links

- [T34](add-readiness-list-filter.md) — параметр `ready` · [openapi.yaml](../contracts/openapi.yaml) — `listProducts`
- [ADR 0009](../adr/0009-derive-card-readiness-instead-of-storing-it.md) · [CONTEXT.md](../CONTEXT.md) — «готова картка»
- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 10–15
