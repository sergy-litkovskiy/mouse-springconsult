---
id: T87
title: "Назва OLX другим рядком під назвою Prom, лише коли вона інша"
status: Done
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1700
blocked_by: [T80]
blocks: [T81]
updated_at: "2026-10-03"
---

# T87 — Назва OLX другим рядком під назвою Prom, лише коли вона інша

## Context

Знахідка UX-аудиту 2026-10-02. У каталозі поруч стоять колонки «Назва Prom» і «Назва OLX», і на
живих даних друга повністю дублює першу: `title_olx = title_prom` у 557 з 557 карток, бо всі вони
прийшли імпортом з Prom. Дві однакові колонки по ~190 px з'їдають ширину, тож решта колонок
вужчає, а рядки ростуть у висоту.

**Рішення власника 2026-10-02.** Колонку «Назва OLX» прибрати. Назва OLX показується в комірці
«Назва Prom» другим рядком, дрібніше й кольором `--mat-sys-on-surface-variant`, з префіксом
«OLX:». Лише тоді, коли вона непорожня й після `trim` відрізняється від назви Prom. Однакова чи
порожня назва другого рядка не дає.

**Сортування.** Заголовок «Назва Prom» сортує, як і раніше. Сортування за `titleOlx` у контракті
лишається (`Sort`), але заголовка під нього більше немає. **Припущення:** збережена адреса з
`sort=titleOlx` відкривається без помилки й сортує за OLX, а стрілки сортування не показує жоден
заголовок. Клік по «Назва Prom» перемикає сортування на неї. Якщо власник хоче скидати такий
`sort` до типового, це одна правка в `toSortField`.

**Чому після T80.** [T79](pin-catalog-header-filters-and-paginator.md) і
[T80](shrink-app-bar-catalog-header-and-filters.md) перебудовують ті самі `product-catalog.*`, а
T80 міряє висоти вже після T79. Ширину колонок вони не чіпають, тож ця правка йде останньою в
доріжці каталогу і не збиває їхніх вимірів.

## Sequence

Власного сценарію немає: `titleOlx` уже є в кожному рядку списку. Так само
[sad.md §6](../sad.md#6-runtime-view) описує маркування каталогу:

> «`isReady` уже їде в кожному рядку `ProductList.items` (`contracts/openapi.yaml`) — новий запит бекенду не потрібен»

## Data delta

**Немає.** Правка торкається `product-catalog.ts`, `.html` і `.css`.

## API contract excerpt

```yaml
      operationId: listProducts
        titleProm: { type: string, maxLength: 200 }
        titleOlx: { type: string, maxLength: 200 }
      schema: { type: string, enum: [titleProm, titleOlx, price, createdAt], default: createdAt }
```

## Acceptance criteria

Нове AC із UX-аудиту 2026-10-02; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 4 чекліста.

**AC-80 (нове) — happy path**
**Given** у каталозі є картка з різними назвами Prom і OLX та картка з однаковими
**When** `user` відкриває `/products`
**Then** колонки «Назва OLX» немає; у першої картки під назвою Prom стоїть «OLX: <назва OLX>» дрібнішим сірим текстом, у другої другого рядка немає

**AC-80 — edge case**
**Given** назва OLX порожня або відрізняється від назви Prom лише пробілами по краях, або адреса каталогу несе `sort=titleOlx`
**When** каталог відмальований
**Then** другого рядка немає; адреса з `sort=titleOlx` відкривається без помилки, а клік по «Назва Prom» сортує за нею

## Checklist

1. `product-catalog.spec.ts`: колонки `titleOlx` немає; другий рядок «OLX: …» є лише для різних назв, немає для однакових, порожньої й такої, що різниться лише пробілами. Тести на сортування за OLX через заголовок, якщо вони є, RED переписує, а не видаляє.
2. `product-catalog.ts`: прибрати `titleOlx` з `columns`; похідна `olxTitle(product)` повертає назву або `null`.
3. `product-catalog.html` і `.css`: другий рядок у комірці `titleProm` з токенами кольору й шрифту Material, без літералів кольору.
4. `PRD.md §5`: AC-80 з посиланням на цю story.
5. `pw` на живому стеку на 1280 і 360 px: усі 557 карток мають однакові назви, тож картку з різною назвою дати через `page.route` на `GET /products`, а не правкою бази.

## Out of scope

- Назва OLX у формі картки й у фільтрі «Назва».
- Ширина решти колонок і висота рядка.

## DoD

- [x] AC-80: одна колонка назви, назва OLX — другим рядком лише коли вона інша.
- [x] Тести `web` зелені, `lint` зелений, `pw` пройдено.
- [x] Коміт: `feat(web): show the OLX title under the Prom title when it differs`.

## Links

- [T64](show-published-as-icons.md) — маркування рядка каталогу · [T80](shrink-app-bar-catalog-header-and-filters.md) — попередня правка тих самих файлів
- [sad.md §6](../sad.md#6-runtime-view) · [openapi.yaml](../contracts/openapi.yaml) — `listProducts`, `Product`, `Sort`
