# Audit — data-model, price-range-search, 2026-10-08

**Результат:** прохід не змінює схему. Він лише фіксує нову форму `jsonb` пропозиції `price` і
нові значення наявних колонок `product_preparation_runs`.

## Generated / changed files

| File | Change |
|---|---|
| `docs/features/price-range-search/data-model.md` | новий |
| `docs/features/price-range-search/_audit/data-model-2026-10-08.md` | новий (цей звіт) |

Міграцій, entity-класів, змін у `-limits.ts`, `.dependency-cruiser.cjs` і `schema.spec.ts` немає.

## Decisions made this pass

- **Старі рядки `price` без `listings` (ADR 0022 №4):** ні міграції даних, ні гілки «читати як
  відсутні». Власник підтвердив, що на проді таких рядків немає; у dev-базі `mouse_trading`
  пропозицій `price` 0 і запусків `price`/`both` теж 0 (запит 2026-10-08). Якщо припущення хибне,
  рядок без `listings` не пройде контракт з обов'язковими `listings`. Тоді лікує одноразова
  міграція-видалення з `down` = no-op, як у `1791042544223`.
- **`error_code` без CHECK:** нові коди йдуть лише в union `PreparationErrorCode`. Колонка була
  без CHECK від створення; додати CHECK зараз означало б міграцію заради переліку, який тримає
  код, і ще одну на кожен майбутній код.
- **Дата пошуку = `created_at` пропозиції.** Твердження ADR 0022 перевірено в коді:
  `PreparationRepository.ts:188` переписує `created_at` на upsert.
- **`model` запуску `both` — модель текстів.** Колонка не дублює модель Gemini: запуск `both`
  має одну `model`, і ADR 0025 віддає її Claude. Коментар у `PreparationRun.ts` про це — частина
  story обліку, не цього проходу.
- **`maxPriceListings: 5` у `products-limits.ts` не додано.** Крок 10 скіла велить додавати
  нову межу в `-limits.ts`. Тут її ще нікому читати: контракт і `PreparationService` змінюються
  після go на гейті заміру. Константа з'явиться в тій самій story, що й перший її читач, інакше
  до no-go в коді лежала б мертва константа.
- **Розміри наявних колонок вміщують нові значення:** `gemini-2.5-flash-lite` — 21 символ із
  `varchar(64)`; `price_quota_exhausted` — 21 символ із `varchar(64)`.

## Registration checklist

| Point | Status |
|---|---|
| `.dependency-cruiser.cjs` `ENTITIES` | не потрібно: нових entity немає |
| `contracts/products-limits.ts` | не змінено свідомо (див. вище) |
| `db:migrate:new` | не запускався: міграцій немає |
| `schema.spec.ts` | не змінено: нових CHECK / partial unique немає |

## Gates

`typecheck`, `lint`, `deps:check`, `test` і up→revert не запускались. Прохід не змінює жодного
`.ts` і жодної міграції, тож ці гейти не мають що перевіряти.

## Drift findings

Дрейфу немає. Звірено `@Column` entity з `create table` / `alter table` міграцій:

- `PreparationRun` ↔ `1789736913481` + `1790004050193` (`error_detail`) — збіг.
- `FieldSuggestion` ↔ `1789736913481` + `1791042544223` (+ `product_id`, − `resolution`,
  − `resolved_at`) — збіг.
- `Product` ↔ `1787756956906` + `1789651109349` + `1789712541026` (`prom_id`, `olx_id`) — збіг.
- `ProductImage` ↔ `1787756956906` + `1789642335874` (− `url`) — збіг.
- `User` ↔ `1787734800000` — збіг.

## Deferred entities

Немає. Відкладеної на пізнішу поставку таблиці фіча не проектує: оголошення живуть у `jsonb`
(ADR 0022), облік викликів Gemini — прийнятий борг до платного рівня (ADR 0025).

## Default deviations

| Скіл каже | Тут | Чому |
|---|---|---|
| Нова межа → `-limits.ts` у цьому проході (крок 10) | `maxPriceListings` — у story контракту | читач з'являється лише після go на гейті |
| Self-check: typecheck/lint/deps/test, up→revert | не запускались | змін у коді й міграціях немає |

## TBDs

- `docs/features/price-range-search/data-model.md:123`, `:189` — максимальна довжина
  `listings[].url` (етап 10).
- `docs/features/price-range-search/data-model.md:191` — чи мусить `listings[].price` лежати в
  межах вилки (етап 10 + ADR 0023).

## Next stage

Етап 10 — `/feature-api-forge price-range-search`: тіло запуску `price` з чернетки, коди
`price_not_found` / `price_quota_exhausted`, форма `value` пропозиції `price` з `listings`.
