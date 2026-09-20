---
id: T30
title: "Прийняття й відхилення пропозицій, захист ручної правки"
status: Done
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2600
blocked_by: [T29]
blocks: [T32]
updated_at: "2026-09-20"
---

# T30 — Прийняття й відхилення пропозицій, захист ручної правки

## Context

Тут виконується QG-3 — **ручна правка остаточна** — і виконується вона структурно, а не
перевіркою: модель фізично не має куди перезаписати поле.

Ендпоінти generic-ові за `field` з одним винятком: `field: price`. Область запуску, з якої
з'явилась пропозиція (`texts`/`both`/`price`/`field`), для прийняття/відхилення значення не
має — прийняття/відхилення працює однаково і для пропозицій з фото-розпізнавання, і для
пропозицій з регенерації одного поля ([ADR 0015](../adr/0015-add-per-field-text-rewrite-scope.md)).
Але `value` пропозиції з `field: price` — діапазон `{priceFrom, priceTo}`
([data-model.md](../data-model.md)), а колонка `products.price` скалярна: писати діапазон у
скаляр `accept` не може фізично, не лише за домовленістю. Тому `accept` для `field: price`
відмовляє кодом `price_suggestion_readonly` (2026-09-13, PRD AC-26) — ціна потрапляє в поле
лише ручним введенням user-а на фронті (показаний діапазон — текст-довідка, не елемент
керування, AC-25, [T32](add-preparation-ui.md)) і звичайним збереженням картки, тим самим
маршрутом, що й ручне введення.

Тонкість, яка робить AC-11 придатним до життя: порожня картка не має вимагати підтверджень.
Поки поточне значення поля збігається з останньою **прийнятою** пропозицією, нова
застосовується сама; щойно розійшлося — діє AC-11. Окремого прапорця «редаговано вручну»
для цього не потрібно.

Наслідок цього вибору названий у [sad.md §6](../sad.md#6-runtime-view), сценарій 9: звірка
живе на читанні картки, тож **читання може писати**. Це вибір, а не недогляд.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 9** — обидві гілки:

> `api->>pg: звіряє поточне значення з останньою прийнятою пропозицією`
> гілка «збігається» → нова застосовується сама
> гілка «розійшлося» → пропозиція чекає на рішення людини (AC-11)

## Data delta

| Таблиця | Зміна |
|---|---|
| `product_field_suggestions.resolution` | `NULL` → `accepted` або `rejected`; `resolved_at` заповнюється |
| `products` | при `accepted` — поле картки оновлюється **тим самим запитом**, що й ручне збереження |
| `product_field_suggestions_run_field_key` | `(run_id, field)` UNIQUE — один запуск дає не більше однієї пропозиції на поле; той самий індекс обслуговує join у звірці ([data-model.md](../data-model.md)) |

Третього стану `resolution` немає: `pending` дублював би те, що вже несе `NULL`.

## API contract excerpt

```yaml
      description: >-
        прийнятою пропозицією) не проходить через цей ендпоінт — воно відбувається
        всередині читання картки ([ADR 0006](../adr/0006-store-generated-values-as-separate-suggestions.md)),
        цей маршрут — лише явна дія людини після розходження (AC-11).
      operationId: acceptFieldSuggestion
      responses:
        "409": { $ref: "#/components/responses/SuggestionAlreadyResolved" }
```

## Acceptance criteria

**AC-11** (US-05) — domain invariant
**Given** `user` виправив опис під OLX вручну
**When** `user` запускає підготовку текстів ще раз
**Then** система не перезаписує відредаговане поле, а пропонує нове значення окремо

**AC-12** (US-06) — happy path
**Given** `user` приймає пропозицію
**When** значення пишеться в поле картки
**Then** воно йде тим самим маршрутом, що й ручне збереження — окремої дії «прийняти картку як підготовлену» в системі немає

**AC-26** (US-04, US-10) — error / domain invariant
**Given** пропозиція має `field: price`
**When** `user` (чи клієнт) викликає `accept` для неї
**Then** ендпоінт відмовляє кодом `price_suggestion_readonly`, і поле `products.price` не змінюється цим маршрутом узагалі

## Checklist

1. `contracts/error-codes.ts` — `suggestion_not_found`, `suggestion_already_resolved`, `price_suggestion_readonly`.
2. Сервіс: правило звірки, автозастосування, `resolution` = `accepted` | `rejected`.
3. `POST /:productId/suggestions/:suggestionId/accept` і `.../reject` під `sessionGuard`.
4. Прийняття пише значення в поле картки тим самим запитом, що й ручне збереження — **крім** `field: price`, для якого `accept` відмовляє до будь-якого запису (AC-26).
5. **`descriptionProm` стає HTML під час прийняття** ([ADR 0016](../adr/0016-store-the-prom-description-as-html.md), рішення №7): екранувати `&`, `<`, `>`, блоки між `\n\n` обгорнути в `<p>`, одиночний `\n` замінити на `<br>`, далі та сама чистка, що й під час збереження (T47). Правило звірки порівнює поле картки з уже перетвореним значенням. `descriptionOlx` не перетворюється.
6. `*.spec.ts`: поле збігається з прийнятим → нова застосовується сама; поле виправлено руками → чекає рішення; повторне рішення → `suggestion_already_resolved`; `field: price` → `price_suggestion_readonly`, і жодного запису в `products`.

## Out of scope

- Інтерфейс, кнопка «? -> AI» біля ціни й ручне введення числа з поля-довідки — [T32](add-preparation-ui.md).
- Прапорець «редаговано вручну» — його свідомо немає.

## DoD

- [x] AC-11: після ручної правки повторний запуск **не** перезаписує поле, а лишає пропозицію окремо. Перевірено й на живому стеку: правлений вручну `titleProm` лишився, його пропозиція — `pending`, а незайманий `titleOlx` застосувався сам.
- [x] AC-26: `accept` для `field: price` повертає `price_suggestion_readonly` і не чіпає `products.price`. Відмова тепер іде за `field`, а не за «значення нікуди не лягає»: код помилки більше не відповідає за пропозицію, чий тип суперечить її полю (рев'ю 2026-09-20).
- [x] Порожня картка приймає першу пропозицію без підтвердження — інакше AC-11 зробив би роботу нестерпною.
- [x] `resolution` має рівно три стани, і `NULL` серед них — не четвертий рядок, а відсутність рішення.
- [x] Місце, де читання пише, позначене коментарем із посиланням на [sad.md §6](../sad.md#6-runtime-view), сценарій 9 — щоб на рев'ю це читалось як вибір, а не як помилка.
- [x] Коміт: `feat(products): add suggestion accept and reject endpoints`.

## Links

- [PRD §5](../PRD.md#5-acceptance-criteria) — AC-11, AC-12, AC-26 (пов'язані AC-23–AC-25 реалізує [T32](add-preparation-ui.md)) · [PRD §4](../PRD.md#4-user-stories) US-04, US-05, US-10
- [ADR 0006](../adr/0006-store-generated-values-as-separate-suggestions.md) · [openapi.yaml](../contracts/openapi.yaml)
- [sad.md §4](../sad.md#4-solution-strategy), уточнення 2026-09-13 · [CONTEXT.md](../CONTEXT.md) — «пропозиція», Invariants, `price_suggestion_readonly`
