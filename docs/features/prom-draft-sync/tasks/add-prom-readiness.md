---
id: T130
title: "promReadiness: чого бракує картці для Prom"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1500
blocked_by: [T123]
blocks: [T132]
updated_at: "2026-10-10"
---

# T130 — promReadiness: чого бракує картці для Prom

## Context

Чиста функція `products/prom-sync/promReadiness.ts`: збережена картка → `{missing, overLimit}`.
Обидва масиви порожні — картку можна відправляти. Готовність рахує бекенд на збереженій картці, а
фронт лише підказує за тими самими константами ([sad.md §5](../sad.md#5-building-block-view)).

- **`missing`** — той самий предикат, що `isReady` ([ADR 0009](../../product-creation-flow/adr/0009-derive-card-readiness-instead-of-storing-it.md)):
  обидві назви й обидва описи, ціна > 0, хоч одне фото. Предикат не дублюється: функція бере його
  з того місця, де живе `isReady`, і розкладає на поля.
- **`overLimit`** — межі Prom з `products-limits.ts` ([T123](add-prom-sync-codes-and-limits.md)):
  `titleProm` понад 130 (стара назва, збережена до появи межі, AC-05); `seoKeywords` — слово
  понад 50 або рядок, склеєний через `", "`, понад 1024 (AC-06). Фото понад 10 картка мати не
  може (`maxImagesPerProduct`), тож окремого пункту немає.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 1 — перевірка, яку виконує ця функція:

> `api->>pg: читає збережену картку, перевіряє готовність і межі Prom`

## Data delta

**Немає запису.** Функція читає поля `products` і кількість `product_images` картки.
`seo_keywords` на dev уже мають 9 карток зі словом понад 50 ([data-model.md](../data-model.md)), але
вони вже на Prom, тож відправлятись їм не треба.

## API contract excerpt

```yaml
                missing:
                  type: array
                  uniqueItems: true
                    enum: [titleProm, titleOlx, descriptionProm, descriptionOlx, price, gallery]
                overLimit:
                    Що виходить за межі Prom. `titleProm` — назва понад 130, збережена до появи
                    межі (AC-05). `seoKeywords` — слово понад 50 або всі разом понад 1024, рахуючи
                    рядок, склеєний через `", "`: у такій формі Prom їх і приймає (AC-06).
                    enum: [titleProm, seoKeywords]
```

## Acceptance criteria

**AC-02** (US-01) — domain invariant, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** картці бракує опису для OLX і фото
**When** рахується готовність
**Then** `missing` = `[descriptionOlx, gallery]`, `overLimit` = `[]`

**AC-06** (US-02) — error
**Given** 21 ключове слово по 49 знаків: кожне в межі, а разом з `", "` це 1069 знаків
**When** рахується готовність
**Then** `overLimit` = `[seoKeywords]`; на 1024 знаки рівно — порожній

**AC-05** (US-02) — стара назва
**Given** картка, збережена до появи межі, з назвою для Prom на 131 знак
**When** рахується готовність
**Then** `overLimit` містить `titleProm`

## Checklist

1. `promReadiness(card)` у `products/prom-sync/` з типом результату `{missing, overLimit}` за `PromSyncNotReadyError.details`.
2. `missing` — з наявного предиката готовності, без копії умов; якщо предикат зараз повертає лише bool, винести перевірку полів у спільну функцію, яку використовують обидва.
3. `overLimit` за `productConstraints.prom*`; довжина ключових слів — `join(', ').length`.
4. Spec: кожен пункт `missing`, межі 130/131, 50/51, 1024/1025, обидва масиви разом.

## Out of scope

- Кидання `PromSyncNotReady` ([T132](start-prom-sync-run.md)).
- Підказки у формі ([T139](add-prom-sync-button.md)).

## DoD

- [ ] Умови готовності існують в одному місці.
- [ ] Тести зелені.
- [ ] Коміт: `feat(products): compute Prom readiness of a saved card`.

## Links

- [openapi.yaml](../contracts/openapi.yaml) `PromSyncNotReadyError` · [PRD §6](../PRD.md#6-non-functional-requirements), межі вхідних даних
