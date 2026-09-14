---
status: Accepted
owner: "Serhii"
reviewers: ["Serhii"]
updated_at: "2026-09-12"
feature_size: M
stage: "04-05"
ticket: "TBD"
---

# 0015 — Регенерувати одне поле з його чернетки текстом — нова область запуску `field`

- **Status:** Accepted
- **Date:** 2026-09-12
- **Deciders:** Serhii (Architect / Tech Lead)

## Context

Макет картки товару (`docs/assets/add-edit-product-feature.pdf`) додає кнопку «? -> AI»
біля кожного текстового поля: запросити в AI новий варіант **тільки для цього поля** на
основі того, що людина вже написала в ньому — без фото, без перезапуску решти полів.

Наявна область запуску (`scope`: `texts`/`price`/`both`, [ADR 0006](0006-store-generated-values-as-separate-suggestions.md),
[data-model.md](../data-model.md)) завжди працює групою полів і читає вхід із бази — фото
галереї для текстів, `web_search` для ціни. Ця нова дія працює з чернеткою поля, яку
людина могла ще не зберегти (`Зберегти` картки — окрема, пізніша дія), тож вхід має їхати
в тілі запиту, а не читатися з `products`.

## Decision drivers

- `ai/CLAUDE.md`: «Виклики AI виконуються тільки у worker через чергу» — це правило не
  розрізняє фото-виклики й текстові, тож нова дія проходить той самий шлях
  запуск → пропозиція → прийняття, а не окремий синхронний ендпоінт в обхід черги.
  Пункт [ADR 0011](0011-store-only-the-original-frame.md), яким лишається фонова
  робота, тут не переглядається.
- `product_field_suggestions` уже зберігає результат по одному полю за раз
  ([ADR 0006](0006-store-generated-values-as-separate-suggestions.md)) — та сама форма
  підходить без зміни структури таблиці.
- «Версія входу» ідемпотентності (відкритий пункт [T24](../tasks/close-preparation-open-items.md))
  для цієї області рахується інакше, ніж для фото-областей: природний хеш — саме поле й
  чернетка, а не фото чи розпізнавання.
- Прийняття пропозиції (`acceptFieldSuggestion`, [T30](../tasks/add-suggestion-resolution-endpoints.md))
  уже написане generic-ом по полю — нова область не вимагає для нього жодної зміни.

## Considered options

1. **Новий окремий ендпоінт** (`POST /products/{id}/fields/{field}/rewrite`) поза
   `preparation-runs` — свій цикл полінгу, своя ідемпотентність, свій рейт-ліміт.
2. **Розширити `scope` значенням `field`** усередині наявного
   `POST /products/{id}/preparation-runs`: тіло запиту додатково несе `field` (яке саме
   поле) і `draftText` (чернетка, з якої регенерувати) лише для цієї області.

## Decision outcome

**Chosen: опція 2.** Той самий запуск/пропозиція/прийняття, інша область — полінг,
обмеження частоти й запис `usage` дістаються без додаткового коду, бо вже написані для
`texts`/`price`/`both`. Нова область не додає ні ендпоінту, ні таблиці, ні окремого шляху
прийняття в UI: «<- AI» на будь-якому полі викликає той самий `acceptFieldSuggestion`.

## Consequences

**Positive**

- Жодного нового ендпоінту чи таблиці; UI-патерн прийняття пропозиції лишається один на
  всі області.
- Полінг стану, рейт-ліміт і облік `usage` (AC-14) працюють для `field` так само, як для
  решти областей — без окремого коду.

**Negative**

- `PreparationRunCreateRequest` стає розрізненим за формою залежно від `scope`: для
  `field` `field` і `draftText` обов'язкові, для решти — відсутні. Контракт виражає це
  `z.discriminatedUnion`, а не єдиною плоскою схемою.
- Ціновий call (`web_search`) з-під `field` не викликається — регенерація «з тексту» не
  застосовна до `price`: значення `field` обмежене текстовими й масивними полями
  (`titleProm`, `titleOlx`, `descriptionProm`, `descriptionOlx`, `seoKeywords`).

**Neutral**

- Чернетка (`draftText`) не зберігається жодним стовпцем — вона живе лише в тілі запиту й
  у хеші `idempotency_key`; рядок `product_field_suggestions`, який виникає в результаті,
  не відрізняється від рядка, який дав фото-запуск.
- `product_field_suggestions.field` розширюється значеннями `title_prom` і `title_olx` —
  до цього рішення обидва заголовки не мали власної пропозиції взагалі; правка стосується
  переліку `CHECK`, не структури таблиці.

## Links

- [ADR 0006](0006-store-generated-values-as-separate-suggestions.md) · [ADR 0014](0014-let-ai-recognize-the-item-from-photos.md)
- `apps/api/src/modules/ai/CLAUDE.md`
- [data-model.md](../data-model.md), Open items («версія входу») · [T24](../tasks/close-preparation-open-items.md)
- Макет: `docs/assets/add-edit-product-feature.pdf`
