---
id: T84
title: "Кнопка «Відхилити пропозицію» біля поля картки"
status: Dropped
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2200
blocked_by: [T74]
blocks: []
updated_at: "2026-10-02"
---

# T84 — Кнопка «Відхилити пропозицію» біля поля картки

> **Dropped 2026-10-02.** Власник вирішив, що пропозиції не мають статусів:
> [ADR 0017](../adr/0017-keep-one-latest-suggestion-per-field.md). Пропозицію, яку людина не
> хоче, вона просто ігнорує або запускає нову генерацію. Маршрут відхилення прибирає
> [T91](drop-server-side-suggestion-accept.md), а місце T84 у графі займає
> [T90](copy-suggestion-into-form-field.md). Номер AC-77 у PRD так і не з'явився й не
> перевикористовується. Гілку `feat-t84-reject-suggestion-button` не пушили. Нижче — текст
> story на момент скасування.

## Context

Знахідка UX-аудиту 2026-10-02. Пропозицію моделі можна лише прийняти («Застосувати для поля
ліворуч»), відхилити її з форми не можна. При цьому відхилення вже є всюди, крім UI: маршрут
`POST .../suggestions/:id/reject` ([T30](add-suggestion-resolution-endpoints.md)), метод
`rejectSuggestion` у `products-api.ts` ([T32](add-preparation-ui.md)) і гілка «user відхиляє» в
сценарії 9 [sad.md §6](../sad.md#6-runtime-view). [T53](expose-pending-suggestions.md) віддає
непідтверджені пропозиції, «щоб фронт показав її поруч із полем і дав прийняти чи відхилити».
Кнопки так і не з'явилось: `rejectSuggestion` у `apps/web/src` викликає лише його тест.

**Наслідок, видимий сьогодні.** Від 2026-10-01 на картці книги «Методика музичного виховання в
школі» висять пропозиції «Бездротова оптична миша Logitech MX Master 3» для назви OLX і
«Скатертина з льону» для опису Prom. Схоже, це сліди тестових промптів. Прибрати їх можна хіба
новим запуском, тобто платним викликом моделі.

**Що робимо.** У `app-suggestion-field` з'являється четверта кнопка, `matIconButton` з іконкою
`close`, тултіпом і `aria-label` «Відхилити пропозицію». Вона стоїть після стрілки й має ту саму
умову, що й стрілка: поле приймає пропозиції (`acceptable`), пропозиція є й не вирішена
([T74](show-latest-suggestions-in-product-form.md) показує й вирішені), і не йде жоден запуск
(`busy`). Тому задача стоїть після T74. Форма викликає `rejectSuggestion`, бере з відповіді
`card` і пропозиції, як після прийняття, але **значення поля ліворуч не чіпає**. Помилка
`suggestion_already_resolved` іде в `formError` тим самим шляхом, що й при прийнятті.
Запитання-підтвердження не потрібне: відхилення нічого не стирає, рядок лишається в історії.

[T66](show-local-ai-progress.md) далі замінює спінером кнопки запуску в тому самому компоненті,
а стрілку й «Відхилити» лише вимикає. Тому T66 стоїть після цієї задачі.

## Sequence

> `web-->>user: поля лишились як були, нові пропозиції стоять праворуч`

Сценарій 9 [sad.md §6](../sad.md#6-runtime-view). Гілку «user відхиляє», яку задача мала
реалізувати, прибрано разом з T84; рядок вище — з переписаного сценарію.

## Data delta

**Немає.** `product_field_suggestions.resolution` уже приймає `rejected` з
[T26](add-preparation-tables-migration.md); маршрут і сервіс — з T30.

## API contract excerpt

```yaml
    FieldSuggestion:
      required: [id, runId, field, value, createdAt]
```

Маршрут `rejectFieldSuggestion`, на якому стояла задача, з контракту прибрано.

## Acceptance criteria

Нове AC із UX-аудиту 2026-10-02; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 5 чекліста.

**AC-77 (нове) — happy path**
**Given** біля поля стоїть невирішена пропозиція моделі
**When** `user` тисне «Відхилити пропозицію»
**Then** пропозицію позначено відхиленою, значення поля ліворуч не змінилось, а «Застосувати для поля ліворуч» і «Відхилити пропозицію» вимкнені

**AC-77 — edge case**
**Given** пропозицію вже вирішено (в іншій вкладці), або йде запуск підготовки, або пропозиції немає
**When** `user` дивиться на поле або тисне «Відхилити пропозицію» у вкладці зі старим станом
**Then** кнопка вимкнена; на застарілий клік форма показує повідомлення `suggestion_already_resolved` і перечитаний стан, а поле не змінює

## Checklist

1. `suggestion-field.spec.ts`: кнопка «Відхилити пропозицію» є лише там, де є стрілка; вимкнена без пропозиції, з вирішеною пропозицією і під час запуску; клік емітить `reject`.
2. `suggestion-field.ts` і `.html`: `output()` `reject`, кнопка з тією ж умовою, що й `canAccept`.
3. `product-form.spec.ts`: `rejectSuggestion` шле `POST .../reject`, оновлює `card` і пропозиції, не змінює значення поля; `409` іде в `formError`.
4. `product-form.ts` і `.html`: `rejectSuggestion(field)` за зразком `acceptSuggestion`, без запису в поле; `(reject)` на кожному `app-suggestion-field` зі стрілкою.
5. `PRD.md §5`: AC-77 з посиланням на цю story.
6. `pw` на живому стеку без платних викликів: картка книги «Методика музичного виховання в школі» — відхилити дві висячі пропозиції, перевідкрити картку.

## Out of scope

- Відхилення пропозиції ціни: кнопку ціни сховано до [T54](bound-the-model-call-timeout.md).
- Скасування прийняття чи відхилення: так само поза обсягом T74.

## DoD

- [ ] AC-77: пропозицію можна відхилити, поле лишається незмінним.
- [ ] Тести `web` зелені, `lint` зелений, `pw` пройдено.
- [ ] Коміт: `feat(web): let the admin reject a field suggestion`.

## Links

- [T30](add-suggestion-resolution-endpoints.md) — маршрут відхилення · [T73](add-improve-button-and-tonal-ai-actions.md) — кнопки біля поля · [T74](show-latest-suggestions-in-product-form.md) — стан пропозиції
- [sad.md §6](../sad.md#6-runtime-view), сценарій 9 · [openapi.yaml](../contracts/openapi.yaml) — `rejectFieldSuggestion`
