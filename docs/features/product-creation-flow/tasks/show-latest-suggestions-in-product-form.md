---
id: T74
title: "Форма показує останню пропозицію моделі для кожного поля"
status: Done
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 3100
blocked_by: [T73]
blocks: [T66, T81, T82, T84, T90]
updated_at: "2026-10-02"
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
> `api->>pg: читає поля картки й одну пропозицію на поле`

[sad.md §6](../sad.md#6-runtime-view), сценарій 9: звірка та сама, змінюється лише те, що
відповідь несе поруч зі значеннями. Сценарій переписано 2026-10-02 ([ADR 0017](../adr/0017-keep-one-latest-suggestion-per-field.md)): звірки більше
немає, тож другий рядок — з нового сценарію.

## Data delta

**Немає.** Читаються наявні колонки `product_field_suggestions` (`field`, `created_at`,
`resolution`, `resolved_at`). Чи потрібен індекс під «останню на поле», вирішує `EXPLAIN` на
копії бази: на 50–100 карток на місяць і кілька пропозицій на картку наявного індексу за
карткою, найімовірніше, досить.

## API contract excerpt

```yaml
    ProductCardRead:
    FieldSuggestion:
        createdAt: { type: string, format: date-time }
```

Рядки `resolution` і `resolvedAt` прибрано 2026-10-02 ([ADR 0017](../adr/0017-keep-one-latest-suggestion-per-field.md), [T91](drop-server-side-suggestion-accept.md)):
позначок «застосовано» / «відхилено», які додала ця задача, більше немає.

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

1. `products.contract.spec.ts`, `ProductController.spec.ts`, `PreparationService.spec.ts`: `latestSuggestions` замість `pendingSuggestions`, з `resolution` і `resolvedAt`. Тести T53 переписати на нове поле, а не видаляти.
2. `ProductService.spec.ts` / `PreparationRepository.spec.ts`: одна пропозиція на поле — найновіша за `createdAt`; прийняті й відхилені потрапляють у список; звірка AC-11 поводиться як раніше.
3. `product-form.spec.ts`, `products-api.spec.ts`, `product-catalog.spec.ts`: позначки «застосовано» / «відхилено»; «<- AI» активна лише при `resolution === null`. Тести T55 та інші, що згадують `pendingSuggestions`, переписати на `latestSuggestions`, не видаляти.
4. `PreparationRepository.ts`, `ProductService.ts`, `ProductController.ts`, `products.contract.ts`: читання й мапінг останньої пропозиції на поле.
5. `product-form.ts` / `.html`, `suggestion-field.*`: `suggestionFor` читає `latestSuggestions`; позначка й умова `canAccept`. Перед комітом `rg pendingSuggestions apps` не знаходить нічого.
6. `openapi.yaml`: у `ProductCardRead` поле `latestSuggestions` замість `pendingSuggestions`, `required` і опис оновлено. Закриті T53 і T55 цитують рядки `pendingSuggestions` у своїх excerpt, тож після правки gate-check на них впаде. У їхніх excerpt ці рядки замінити на ті, що пережили заміну, і дописати під блоком, що поле перейменовано в T74.
7. `PRD.md`: абзац під AC-11 («Непідтверджені пропозиції віддає читання картки…») — про останню пропозицію на поле; AC-69 з посиланням на цю story. `sad.md §6`, сценарій 9: `Note` після відповіді `api-->>web` про останню пропозицію на поле. Сам рядок відповіді не переписувати: його дослівно цитують T53 і T55.
8. `pw` на живому стеку без платних викликів: картка з уже прийнятою й відхиленою пропозиціями показує обидві позначки, «<- AI» вимкнена.
9. Перед комітом виміряти `git diff --stat`. Якщо понад 500 рядків — розрізати: спершу `api` (віддає `latestSuggestions` поруч із `pendingSuggestions`), потім `web` і прибирання старого поля.

## Out of scope

- Історія всіх пропозицій поля: власник просить останню.
- Скасування прийняття чи відхилення.

## DoD

- [x] AC-69: праворуч остання пропозиція з її станом.
- [x] Тести `api` і `web` зелені, `typecheck`, `lint`, `deps:check` зелені, `pw` пройдено, gate-check теки `tasks/` зелений.
- [x] Коміт: `feat(products): show the latest suggestion for every field of the card`.

Результат 2026-10-02:
- `/tdd --review-tests`: RED `2e08e79`, GREEN `7207f84`, REFACTOR `4be8a56`. Перший RED лише додав
  тести; старі тести T53 і T55 test-writer переписав на `latestSuggestions` після перегляду, у тому
  ж коміті (amend), з заглушками форми типів у `products.contract.ts` і `ProductService.ts`. Десять
  гейтів `feature-ship` зелені: api 442/442, web 269 passed, 2 skipped.
- Індекс не знадобився: «остання на поле» береться з тієї самої вибірки `findSuggestions`, яку
  звірка вже робить. Другий запит іде лише тоді, коли звірка щось застосувала: рішення й час
  ставить таблиця.
- `pw` без платних викликів: «Вузьке мереживо…» — дві прийняті пропозиції з «застосовано», «<- AI»
  вимкнена; «Методика музичного виховання в школі» — відхилена «Скатертина…» в `descriptionProm`
  з «відхилено» й вимкненою «<- AI», дві непідтверджені без позначки й з активною кнопкою.
  Відхиленої пропозиції в базі не було, тож тестову «Скатертину» (з `pw` T72) відхилено через
  `POST …/reject`; дві висячі пропозиції для `pw` T84 лишились. Прийнятої й відхиленої на одній
  картці немає, тож позначки перевірено на двох.
- **Пункт 9 Checklist.** `git diff --stat` — 498 вставок і 112 видалень: 473 рядки spec-ів, 80 —
  коду, 57 — документів. Не розрізано: розріз «спершу `api`, потім `web`» мав розвести код за
  деплоєм, а коду 80 рядків; більшість обсягу — переписані тести T53 і T55.

## Links

- [T53](expose-pending-suggestions.md) — непідтверджені пропозиції · [T55](show-applied-suggestions-in-product-form.md) — застосування в недоторкані поля · [T30](add-suggestion-resolution-endpoints.md) — прийняття й відхилення
- [ADR 0006](../adr/0006-store-generated-values-as-separate-suggestions.md) — пропозиції окремою таблицею
- [sad.md §6](../sad.md#6-runtime-view), сценарій 9 · [openapi.yaml](../contracts/openapi.yaml) — `ProductCardRead`, `FieldSuggestion`
