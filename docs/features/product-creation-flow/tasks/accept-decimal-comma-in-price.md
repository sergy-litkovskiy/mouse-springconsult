---
id: T85
title: "Ціна приймає кому як десятковий роздільник"
status: Done
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1600
blocked_by: []
blocks: [T81]
updated_at: "2026-10-02"
---

# T85 — Ціна приймає кому як десятковий роздільник

## Context

Знахідка UX-аудиту 2026-10-02. Каталог показує ціну з комою («235,00 грн», `Intl.NumberFormat`
з `uk-UA`). Проте в полі редагування комірки стоїть «235.00», а введене «235,50» відхиляє кожне з
трьох полів ціни: комірка каталогу, фільтри «Ціна від/до» і поле «Ціна, ₴» у картці. Усі три
показують «Ціна виглядає як 2499 або 2499.00.». Українська розкладка ставить кому, і сам
[AC-09](../PRD.md#5-acceptance-criteria) каже «щонайбільше двома знаками після коми».

**Що робимо.** Контракт не змінюється: в `api` ціна далі їде рядком з крапкою
(`pricePattern`). Кому замінює на крапку фронт, в одному місці, до перевірки й до відправки.
Нова функція `normalizePrice(value)` у `product-catalog-query.ts` обрізає пробіли й міняє одну
`,` на `.`. Через неї проходять ті, хто вже читає ціну з поля: `priceBound`, `priceRange`,
`priceFromField` і рядок фільтра, який іде в адресу (`asQueryParam` для `priceMin`/`priceMax`).
Перевірка в `saveEdit` комірки вже бере значення з `priceFromField`, тож окремої правки не
потребує. Текст підказки стає «Ціна виглядає як 2499, 2499.00 або 2499,00.».

**Що не змінюється.** Поле редагування й далі показує ціну з крапкою (`priceFieldValue`), а
адреса каталогу несе крапку: це значення контракту, а не формат показу.

## Sequence

> `api->>api: zod-схема: ціна — невідʼємне число, ≤ 2 знаки (AC-09)`

Сценарій 6 [sad.md §6](../sad.md#6-runtime-view): межа в `api` та сама, а фронт перестає
відкидати введене до неї.

## Data delta

**Немає.** `products.price` лишається `decimal(12,2)`, а запит — десятковим рядком з крапкою.

## API contract excerpt

```yaml
    ProductUpdateRequest:
        price:
          type: string
          pattern: '^\d{1,10}(\.\d{1,2})?$'
    PriceMin:
      schema: { type: string, pattern: '^\d{1,10}(\.\d{1,2})?$' }
```

## Acceptance criteria

Нове AC із UX-аудиту 2026-10-02; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 4 чекліста. Межу AC-09 воно не змінює, лише роздільник.

**AC-78 (нове) — happy path**
**Given** `user` вписує «235,50» у ціну комірки каталогу, у «Ціна від» або в «Ціна, ₴» картки
**When** зберігає комірку, застосовує фільтри чи зберігає картку
**Then** помилки немає, а в `PATCH` чи в адресу каталогу йде `"235.50"`

**AC-78 — edge case**
**Given** `user` вписує «1,000.50», «2,5,0» або «235,505»
**When** поле перевіряється
**Then** система показує підказку формату й нічого не надсилає, як і для будь-якої іншої хибної ціни (AC-09)

## Checklist

1. `product-catalog-query.spec.ts`: `normalizePrice` міняє одну кому на крапку; `priceBound`, `priceRange` і `priceFromField` приймають «235,50», а відкидають «1,000.50», «2,5,0» і «235,505».
2. `product-catalog-query.ts`: `normalizePrice` і її виклик у `priceBound`, `priceRange`, `priceFromField`; рядки фільтрів ціни в адресу — теж через неї.
3. `product-catalog.spec.ts`: комірка зберігає «235,50» як `"235.50"`; фільтр з «100,5» пише в адресу `priceMin=100.5`. Новий текст підказки — у `product-catalog.ts` (`PRICE_FORMAT_MESSAGE`), `product-catalog.html`, `product-form.html` і `product-form.ts` (`invalidPrice`).
4. `PRD.md §5`: AC-78 з посиланням на цю story.
5. `pw` на живому стеку: фільтр «Ціна від» з комою; комірку й поле картки лише перевірити на відсутність помилки, нічого не зберігаючи.

## Out of scope

- Показ ціни з комою в полях редагування й в адресі.
- Розділювач тисяч і пробіли всередині числа.

## DoD

- [x] AC-78: кома приймається в усіх трьох полях ціни, у `api` йде крапка.
- [x] Тести `web` зелені, `lint` зелений, `pw` пройдено.
- [x] Коміт: `feat(web): accept a decimal comma in price fields`.

## Links

- [T65](edit-price-and-condition-inline.md) — ціна в комірці · [T41](fix-product-form-field-sizing.md) — поле ціни в картці
- [sad.md §6](../sad.md#6-runtime-view), сценарій 6 · [openapi.yaml](../contracts/openapi.yaml) — `ProductUpdateRequest`, `PriceMin`
