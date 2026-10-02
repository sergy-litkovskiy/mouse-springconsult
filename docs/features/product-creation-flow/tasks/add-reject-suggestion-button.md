---
id: T84
title: "Кнопка «Відхилити пропозицію» біля поля картки"
status: Blocked
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2000
blocked_by: [T74]
blocks: [T66, T81]
updated_at: "2026-10-02"
---

# T84 — Кнопка «Відхилити пропозицію» біля поля картки

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

> `web->>api: відхиляє пропозицію`
> `api->>pg: позначає пропозицію відхиленою, поле не змінюється`

Сценарій 9 [sad.md §6](../sad.md#6-runtime-view), гілка «user відхиляє».

## Data delta

**Немає.** `product_field_suggestions.resolution` уже приймає `rejected` з
[T26](add-preparation-tables-migration.md); маршрут і сервіс — з T30.

## API contract excerpt

```yaml
  /products/{productId}/suggestions/{suggestionId}/reject:
      summary: Відхилити пропозицію поля
      operationId: rejectFieldSuggestion
          description: Пропозицію відхилено
              schema: { $ref: "#/components/schemas/ProductCardRead" }
        "409": { $ref: "#/components/responses/SuggestionAlreadyResolved" }
```

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
