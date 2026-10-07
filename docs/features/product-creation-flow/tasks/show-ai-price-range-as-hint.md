---
id: T100
title: "«Згенерувати все» з ціною, вилка — підказкою під полем ціни"
status: Deferred
delivery: 4
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1800
blocked_by: [T95, T99]
blocks: []
updated_at: "2026-10-07"
---

# T100 — «Згенерувати все» з ціною, вилка — підказкою під полем ціни

> **Відкладено 2026-10-07 рішенням власника** ([ADR 0019](../adr/0019-keep-price-search-out-of-generate-all.md)).
> Замір [T96](decide-price-range-in-generate-all.md) дав no-go: вилку не знайдено в трьох викликах із
> чотирьох, а вартість одного «Згенерувати все» з ціною сягала $0,17–0,36 при стелі $0,15. Нижче —
> story на момент відкладення, без змін.

## Context

Остання задача доріжки ціни. Після [T99](find-price-from-generated-texts.md) `api` шукає ціну
в запуску `both`, а форма досі шле `scope: 'texts'` (`generateAll()` у `product-form.ts`).

**Підказка, а не пара полів.** Біля ціни немає кнопок AI і стрілки «<- AI»: вилка не
пишеться в скалярну ціну (AC-25). Під полем з'являється `mat-hint`:

| Пропозиція `price` | `mat-hint` |
|---|---|
| вилка `1200.00`–`1800.00` | «AI: від 1 200 до 1 800 ₴» |
| «не знайдено» (форма з ADR 0019) | «AI не знайшов цінову вилку» |
| немає | підказки немає |

Числа форматує `Intl.NumberFormat('uk-UA')` без копійок, коли вони нульові. Коли поле має
помилку формату (AC-09), показується `mat-error`, а підказка ховається: Material показує
одне з двох, і помилка важливіша.

**Що зникає з форми.** Прихована половина пари `app-suggestion-field data-field="price"`,
`priceLookupEnabled`, `lookUpPrice`, `canLookUpPrice` і гілка «Модель шукає ціну…» в
`preparingNotice`. Коментар про T54 біля них — теж. `generatingAll` порівнює `scope` з
`'both'` замість `'texts'`, інакше спінер «Згенерувати все» не з'явиться.

**Ребро від T95** — спільні `product-form.*`, а не смисл: обидві правлять ту саму смугу
під «Згенерувати все».

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 8. Кроки, які задача переписує на фронті:

> `web-->>user: показує діапазон у полі праворуч (AC-23) або видиму відмову`
> `Note over user,web: праворуч — лише текст-довідка; ані кліку, ані автозаповнення немає.<br/>user сам вписує число в поле ціни ліворуч — сценарієм 6, як за ручного введення (AC-09, AC-12, AC-25)`

Після T99 «праворуч» стає «під полем», а принцип «лише текст-довідка» лишається.

## Data delta

**Немає.** Правка лише `product-form.*` у `web`; форму пропозиції `price` дає контракт після T99.

## API contract excerpt

```yaml
    PreparationRunCreateRequest:
      required: [scope]
      example: { scope: both }
    FieldSuggestion:
        Пропозицію з `field: price` форма в поле не копіює — діапазон не
        пишеться в скалярну `price` (PRD AC-25, sad.md §4/§6 сценарій 8).
```

## Acceptance criteria

AC-86 і AC-87 пише [T96](decide-price-range-in-generate-all.md) у [PRD §5](../PRD.md#5-acceptance-criteria).

**AC-86 (US-04) — happy path**
**Given** пропозиція ціни картки несе вилку 1200.00–1800.00
**When** `user` відкриває картку
**Then** під полем ціни підказка «AI: від 1 200 до 1 800 ₴», а саме поле не змінюється

**AC-87 (US-04) — edge case**
**Given** пропозиція ціни каже «не знайдено»
**When** `user` відкриває картку
**Then** під полем ціни підказка «AI не знайшов цінову вилку»; помилка формату ціни (AC-09) має перевагу над підказкою

**AC-08 — з боку форми**
**Given** у картці є кадр
**When** `user` натискає «Згенерувати все»
**Then** форма шле `scope: both`, а спінер кнопки видно до кінця запуску

## Checklist

1. `product-form.spec.ts`: три рядки таблиці Context; `mat-error` замість підказки при хибній ціні; `generateAll()` шле `both`; спінер на запуску `both`. Тести прихованої кнопки ціни RED видаляє як застарілі, а не переписує.
2. `product-form.ts`: `scope: 'both'`; `generatingAll` на `'both'`; обчислення тексту підказки; прибрати `priceLookupEnabled`, `lookUpPrice`, `canLookUpPrice` і гілку `preparingNotice`.
3. `product-form.html`: `mat-hint` під ціною; прибрати приховану половину пари й коментар.
4. `pw` на живому стеку: одне «Згенерувати все» на новій картці. Очікувану суму з ADR 0019 назвати до виклику, виміряну — після, лише з дозволу. Стан «не знайдено» — через `page.route` на `GET /api/products/<id>`, без другого платного виклику.

## Out of scope

- Показ `sources` вилки.
- Окрема кнопка ціни чи повтор лише ціни: повтор — новий «Згенерувати все».
- Підказка в рядку каталогу.

## DoD

- [ ] AC-86, AC-87 і бік форми AC-08 покрито тестами.
- [ ] Тести `web` і `lint` зелені, `pw` пройдено.
- [ ] Коміт: `feat(web): generate all with the price and show the AI range as a hint`.

## Links

- [T99](find-price-from-generated-texts.md) — ціна в запуску `both` · [T95](show-card-cost-in-usd.md) — спільні `product-form.*`
- [T96](decide-price-range-in-generate-all.md) — ADR 0019 · [T32](add-preparation-ui.md) — прихована кнопка ціни
