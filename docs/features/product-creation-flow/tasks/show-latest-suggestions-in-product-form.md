---
id: T74
title: "Форма показує останню пропозицію моделі для кожного поля"
status: Blocked
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2400
blocked_by: [T73]
blocks: []
updated_at: "2026-09-23"
---

# T74 — Форма показує останню пропозицію моделі для кожного поля

## Context

Запит 2026-09-23, пункт 6: «останні збережені пропозиції від AI мають виводитися у відповідні
поля карточки товару, щоб юзер бачив, що йому пропонував AI (поля для AI — праворуч)».

**Що є зараз.** Читання картки віддає лише `pendingSuggestions`, тобто пропозиції, які звірка
([T53](expose-pending-suggestions.md)) лишила людині. Прийнята пропозиція (зокрема застосована
самим `api` в недоторкане поле, [T55](show-applied-suggestions-in-product-form.md)) і відхилена
зникають з правого боку, хоча рядки лишаються в `product_field_suggestions` з `resolution` і
`resolvedAt`. Жоден ендпоінт їх не віддає. Відкривши картку наступного дня, людина не бачить, що
пропонувала модель.

**Рішення — похідний список замість двох.** `ProductCardRead.pendingSuggestions` замінює
`latestSuggestions`: для кожного поля остання пропозиція за `createdAt` з будь-якою
`resolution`, з `resolution` і `resolvedAt`. Непідтверджені виводяться з нього як
`resolution === null`, тож другого поля не потрібно. Звірка AC-11 не змінюється: вона так само
застосовує нову пропозицію лише до недоторканого поля.

**Одна story на `api` і `web` — виняток, названий вголос.** Перейменування поля відповіді
нероздільне за деплоєм: `api` без фронту зламає форму, а фронт без `api` не побачить жодної
пропозиції. Тому контракт, сервіс, мапінг і форма йдуть однією зміною.

**Форма.** Праворуч від поля — остання пропозиція. Розв'язана має позначку «застосовано» чи
«відхилено». Кнопка «Застосувати для поля ліворуч» активна лише при `resolution === null`: повторне
прийняття вже розв'язаної пропозиції `api` відхиляє як `suggestion_already_resolved`.

## Sequence

> `web->>api: перечитує картку`
> `api->>pg: звіряє поточне значення з останньою прийнятою пропозицією`

[sad.md §6](../sad.md#6-runtime-view), сценарій 9: звірка та сама, змінюється лише те, що
відповідь несе поруч зі значеннями.

## Data delta

**Немає.** Читаються наявні колонки `product_field_suggestions` (`field`, `created_at`,
`resolution`, `resolved_at`). Чи потрібен індекс під «останню на поле», вирішує `EXPLAIN` на
копії бази: на 50–100 карток на місяць і кілька пропозицій на картку наявного індексу за
карткою, найімовірніше, досить.

## API contract excerpt

```yaml
    ProductCardRead:
    FieldSuggestion:
        resolution: { type: [string, null], enum: [accepted, rejected, null] }
        resolvedAt: { type: [string, null], format: date-time }
        createdAt: { type: string, format: date-time }
```

Рядки `pendingSuggestions` тут навмисно не цитуються: крок 6 їх прибирає.

## Acceptance criteria

AC-69 нове. До [PRD §5](../PRD.md#5-acceptance-criteria) його вносить крок 7 чекліста разом з
уточненням абзацу під AC-11.

**AC-69 (US-05) — happy path**
**Given** «Згенерувати все» застосувало опис для OLX у порожнє поле
**When** `user` відкриває картку наступного разу
**Then** праворуч від поля стоїть той самий опис з позначкою «застосовано», а кнопка «Застосувати для поля ліворуч» вимкнена

**AC-69 — edge case**
**Given** для поля є відхилена пропозиція, а новіша непідтверджена
**When** `user` відкриває картку
**Then** праворуч стоїть новіша, без позначки, і її можна застосувати

**AC-69 — domain invariant**
**Given** людина виправила поле вручну, а повторний запуск приніс нову пропозицію
**When** `user` відкриває картку
**Then** поле лишається його, а пропозиція стоїть праворуч непідтвердженою (AC-11 не змінюється)

## Checklist

1. `products.contract.spec.ts`, `ProductController.spec.ts`: `latestSuggestions` замість `pendingSuggestions`, з `resolution` і `resolvedAt`. Тести T53 переписати на нове поле, а не видаляти.
2. `ProductService.spec.ts` / `PreparationRepository.spec.ts`: одна пропозиція на поле — найновіша за `createdAt`; прийняті й відхилені потрапляють у список; звірка AC-11 поводиться як раніше.
3. `product-form.spec.ts`: позначки «застосовано» / «відхилено»; «<- AI» активна лише при `resolution === null`. Тести T55 на `pendingSuggestions` переписати на `latestSuggestions`.
4. `PreparationRepository.ts`, `ProductService.ts`, `ProductController.ts`, `products.contract.ts`: читання й мапінг останньої пропозиції на поле.
5. `product-form.ts` / `.html`, `suggestion-field.*`: `suggestionFor` читає `latestSuggestions`; позначка й умова `canAccept`.
6. `openapi.yaml`: у `ProductCardRead` поле `latestSuggestions` замість `pendingSuggestions`, `required` і опис оновлено. Закриті T53 і T55 цитують рядки `pendingSuggestions` у своїх excerpt, тож після правки gate-check на них впаде. У їхніх excerpt ці рядки замінити на ті, що пережили заміну, і дописати під блоком, що поле перейменовано в T74.
7. `PRD.md`: абзац під AC-11 («Непідтверджені пропозиції віддає читання картки…») — про останню пропозицію на поле; AC-69 з посиланням на цю story. `sad.md §6`, сценарій 9: `Note` після відповіді `api-->>web` про останню пропозицію на поле. Сам рядок відповіді не переписувати: його дослівно цитують T53 і T55.
8. `pw` на живому стеку без платних викликів: картка з уже прийнятою й відхиленою пропозиціями показує обидві позначки, «<- AI» вимкнена.

## Out of scope

- Історія всіх пропозицій поля: власник просить останню.
- Скасування прийняття чи відхилення.

## DoD

- [ ] AC-69: праворуч остання пропозиція з її станом.
- [ ] Тести `api` і `web` зелені, `typecheck`, `lint`, `deps:check` зелені, `pw` пройдено, gate-check теки `tasks/` зелений.
- [ ] Коміт: `feat(products): show the latest suggestion for every field of the card`.

## Links

- [T53](expose-pending-suggestions.md) — непідтверджені пропозиції · [T55](show-applied-suggestions-in-product-form.md) — застосування в недоторкані поля · [T30](add-suggestion-resolution-endpoints.md) — прийняття й відхилення
- [ADR 0006](../adr/0006-store-generated-values-as-separate-suggestions.md) — пропозиції окремою таблицею
- [sad.md §6](../sad.md#6-runtime-view), сценарій 9 · [openapi.yaml](../contracts/openapi.yaml) — `ProductCardRead`, `FieldSuggestion`
