---
id: T63
title: "Живий пошук за назвою й описом від трьох символів"
status: Done
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2000
blocked_by: []
blocks: []
updated_at: "2026-09-24"
---

# T63 — Живий пошук за назвою й описом від трьох символів

## Context

Запит 2026-09-21, пункт 7. Поля «Назва» й «Опис» у панелі фільтрів застосовуються лише
кнопкою «Застосувати». Власник просить живий пошук: фільтр застосовується сам, щойно в полі
три символи чи більше, без урахування регістру, по назвах і описах.

**Що вже є.** `api` шукає підрядком через `ILIKE` по обох заголовках і обох описах
(`ProductRepository.ts`), схема приймає рядок від одного символу (`trimmedFilter` у
`products.contract.ts`).

**Що змінюється.**

- `api`: `title` і `description` у `productListQuerySchema` — `.min(3)` після `trim`. Коротший
  запит нічого корисного не знаходить, а на кожне натискання клавіші дає повний прохід таблиці.
- **Регістр кирилиці — довести тестом, а не з пам'яті.** `ILIKE` порівнює без регістру за
  правилами `LC_CTYPE` бази. Образ `postgres:18-alpine` може мати `C`/`POSIX` ctype, і тоді
  `ILIKE 'миш%'` не знайде «Миша». Тест `ProductRepository` на живій базі: картка «Миша
  Logitech», пошук `мИШ` її знаходить. Якщо тест червоний — розв'язання (`lower()` з явним
  `COLLATE`, ICU-колація чи зміна локалі бази) вирішується в задачі й описується в PR, а не
  обирається наперед.
- `web`: `valueChanges` полів «Назва» й «Опис» з `debounceTime(300)` і
  `distinctUntilChanged()` застосовує фільтр сам. 1–2 символи фільтр не застосовують і не
  змінюють URL; очищене поле знімає фільтр. «Застосувати» лишається для решти полів панелі.
  Збережена адреса з `title=ab` не має ламати сторінку: `textFilter` на вході компонента
  відкидає значення коротші за три символи, тож запит іде без них, а не з `400`.

## Sequence

Власного сценарію немає: живий пошук — частіший виклик того самого `listProducts`. Так само
[sad.md §6](../sad.md#6-runtime-view) описує стан форми:

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Схема бази не змінюється.** Контракт звужується: `title`/`description` — від 3 символів після
`trim` (було від 1). Якщо тест регістру вимагатиме зміни колації чи індексу, це міграція, і її
треба винести окремим комітом до `/tdd`.

## API contract excerpt

```yaml
    TitleFilter:
      name: title
      in: query
      description: Підрядок, без урахування регістру, по обох заголовках; від 3 символів після trim
      schema: { type: string, minLength: 3, maxLength: 200 }
    DescriptionFilter:
      name: description
      in: query
      description: Підрядок, без урахування регістру, по обох описах; від 3 символів після trim
      schema: { type: string, minLength: 3, maxLength: 200 }
```

## Acceptance criteria

Нове AC із запиту 2026-09-21; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 6 чекліста.

**AC-57 (нове) — happy path**
**Given** у базі картки «Миша Logitech» і «Клавіатура Logitech»
**When** `user` вводить у поле «Назва» `мИШ` і не тисне «Застосувати»
**Then** через ~300 мс таблиця показує лише «Миша Logitech», а URL містить `title=мИШ`

**AC-57 — edge case**
**Given** у полі «Назва» був фільтр `миш`
**When** `user` стирає поле до `ми`, а потім повністю
**Then** на `ми` таблиця й URL не змінюються, на порожньому полі фільтр знято; збережена адреса `/products?title=ми` відкривається без помилки й без фільтра за назвою

**AC-57 — error**
**Given** запит до `api` в обхід форми
**When** `GET /products?title=ab` або `GET /products?description=%20ab%20`
**Then** відповідь `400` з полем `title` чи `description` у `details`

## Checklist

1. `products.contract.ts`: `.min(3)` після `trim` для `title` і `description`; тест схеми на 2 і 3 символи, з пробілами по краях.
2. `ProductRepository.spec.ts`: тест на живій базі — пошук `мИШ` знаходить «Миша Logitech» у заголовку й в описі. Якщо червоний — виправлення в репозиторії чи міграції, рішення описати в PR.
3. `product-catalog.spec.ts`: живий пошук з фейковим часом — 3+ символи застосовують фільтр після debounce, 1–2 не змінюють запиту, порожнє знімає, адреса з 2 символами дає запит без `title`.
4. `product-catalog.ts`: підписка на `valueChanges` двох полів з `takeUntilDestroyed`; `textFilter` відкидає короткі значення.
5. `contracts/openapi.yaml`: `minLength: 3` у `TitleFilter` і `DescriptionFilter`.
6. `PRD.md §5`: AC-57 з посиланням на цю story.
7. `pw`: введення `мИШ` без кнопки фільтрує таблицю; `ми` — ні.

## Out of scope

- Повнотекстовий пошук (`tsvector`), нечіткий пошук, підсвітка збігу.
- Живе застосування інших фільтрів панелі.

## DoD

- [x] AC-57: живий пошук від трьох символів, кирилиця без регістру доведена тестом.
- [x] `api` і `web`: тести, `typecheck`, `lint` зелені.
- [x] `openapi.yaml` і `PRD.md §5` оновлено.
- [x] Коміт: `feat(products): search titles and descriptions live from three characters`.

## Links

- [T61](add-category-list-and-multi-filter.md) — править ту саму `productListQuerySchema`, іде першою
- [apps/api/CLAUDE.md](../../../../apps/api/CLAUDE.md) · [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) · [openapi.yaml](../contracts/openapi.yaml) — `listProducts`
