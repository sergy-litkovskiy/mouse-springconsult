---
id: T90
title: "Стрілка «<- AI» копіює пропозицію в поле форми"
status: Todo
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2600
blocked_by: [T74, T83]
blocks: [T66, T81, T91]
updated_at: "2026-10-02"
---

# T90 — Стрілка «<- AI» копіює пропозицію в поле форми

## Context

Рішення власника 2026-10-02 ([ADR 0017](../adr/0017-keep-one-latest-suggestion-per-field.md)):
у пропозицій немає ні статусів, ні історії, а генерація нічого не пише в картку. Ця задача —
перша з трьох і стосується лише `web`. Форма перестає читати `resolution` і кликати
`POST .../accept`, тож [T91](drop-server-side-suggestion-accept.md) може прибрати маршрути,
не зламавши фронт. Вона ж заміняє [T84](add-reject-suggestion-button.md), яку скасовано: кнопка
«Відхилити» не потрібна, бо ігнорувати пропозицію можна й без кліку.

**Що є зараз.** `acceptSuggestion` у `product-form.ts` шле `POST .../suggestions/{id}/accept`,
`api` пише значення в картку, а форма кладе в контрол те, що повернула картка.
`suggestion-field` показує позначку «застосовано» / «відхилено», а `canAccept` вимикає стрілку
для вирішеної пропозиції. `reread()` після запуску сам заповнює контроли, яких людина не
чіпала ([T55](show-applied-suggestions-in-product-form.md)), бо `api` писав пропозицію в
порожнє поле.

**Що робимо.**

- **Стрілка копіює локально.** `acceptSuggestion(field)` кладе `suggestion.value` у контрол без
  запиту. Форма стає зміненою, і картка закривається лише через запитання
  [T83](confirm-discarding-unsaved-card-edits.md) або після «Зберегти». Тому задача стоїть
  після T83.
- **Перетворення значень.** `descriptionProm`: чиста функція plain text → HTML за правилом
  ADR 0016 №7, як `promDescription` у `ProductService.ts`. Вона екранує `&`, `<`, `>`, обгортає
  в `<p>` кожен блок між `\n\n`, міняє одиночний `\n` на `<br>`, а результат пропускає через
  `promDescriptionCleanup`. `seoKeywords`: список обрізається до
  `productConstraints.maxKeywords` з `products-limits.ts`. Решта полів копіюється як є.
- **Без позначок.** `suggestion-field` не показує `resolution`. `canAccept` =
  `acceptable && suggestion !== null && !busy`.
- **`reread()` не чіпає контролів.** Після запуску він оновлює лише `card` і пропозиції. Поведінка
  T55 знімається, бо `api` більше не заповнює поля, а з [T92](keep-one-suggestion-per-field.md)
  не заповнюватиме й тимчасово.
- **`products-api.ts`.** `acceptSuggestion` і `rejectSuggestion` зникають.

**Між мержем T90 і T91** сервер ще автозастосовує пропозиції на читанні, тож у релізі обидві
задачі йдуть разом.

## Sequence

> `user->>web: тисне «<- AI»`
> `web->>web: копіює пропозицію в поле форми — опис Prom перетворює на HTML, слова обрізає до 30`
> `user->>web: тисне «Зберегти»`
> `web->>api: зберігає картку`

Сценарій 9 [sad.md §6](../sad.md#6-runtime-view), гілка «user переносить пропозицію».

## Data delta

**Немає.** Читаються наявні `latestSuggestions`; поле `resolution` форма просто перестає читати.

## API contract excerpt

Запиту в стрілки немає. Картку пише наявний `updateProduct`, а читає форма лише ці поля
пропозиції:

```yaml
      operationId: updateProduct
            latestSuggestions:
    FieldSuggestion:
      required: [id, runId, field, value, createdAt]
```

## Acceptance criteria

AC-81 і переписане AC-69 уже в [PRD §5](../PRD.md#5-acceptance-criteria).

**AC-81 (US-05) — happy path**
**Given** праворуч від «Опису для OLX» стоїть пропозиція моделі
**When** `user` тисне «Застосувати для поля ліворуч»
**Then** текст пропозиції з'являється в полі ліворуч, а запиту до `api` немає; картка в базі не змінилася, доки `user` не натиснув «Зберегти»

**AC-81 — edge case (опис для Prom і ключові слова)**
**Given** пропозиція опису для Prom — plain text з абзацами через `\n\n`, а пропозиція ключових слів довша за тридцять слів
**When** `user` переносить кожну стрілкою
**Then** опис потрапляє в редактор абзацами (`<p>` на абзац), а в chips — не більше тридцяти слів

**AC-69 (US-05) — edge case**
**Given** для поля пропозиції немає, або йде запуск підготовки
**When** `user` дивиться на поле
**Then** кнопка «Застосувати для поля ліворуч» вимкнена

## Checklist

1. Окремим комітом **до** `/tdd`: прибрати spec-и старої поведінки — позначки `resolution` у `suggestion-field.spec.ts`, `POST .../accept` і `.../reject` у `product-form.spec.ts` і `products-api.spec.ts`, заповнення недоторканих полів після запуску (T55). Коміт `test(web): drop specs of server-side accept`, щоб базова лінія Gate 1 була без них.
2. `product-form.spec.ts`: стрілка кладе пропозицію в контрол без HTTP-запиту; `descriptionProm` — `<p>` на абзац і `<br>`, `<script>` екранований; `seoKeywords` обрізано до 30; форма змінена; після завершення запуску контроли не змінились.
3. `suggestion-field.spec.ts`: стрілка ввімкнена з пропозицією без `resolution` і вимкнена без пропозиції чи під час запуску; позначки немає.
4. `product-form.ts`: `acceptSuggestion` локально, функція plain text → HTML поруч з `prom-description-cleanup.ts`, обрізання ключових слів через `productConstraints`; `reread()` без запису в контроли.
5. `suggestion-field.ts` / `.html`: без `resolution`, нова умова `canAccept`; doc-коментар класу більше не посилається на серверне прийняття.
6. `products-api.ts` (+ spec): прибрати `acceptSuggestion` і `rejectSuggestion`. Перед комітом `rg -n "resolution|acceptSuggestion\(|rejectSuggestion" apps/web/src` знаходить лише локальний `acceptSuggestion` форми.
7. `pw` на живому стеку без платних викликів, картка «Методика музичного виховання в школі»: стрілка кладе пропозицію в поле; закриття без «Зберегти» питає й не змінює картку; після «Зберегти» картка змінена; позначок немає.

## Out of scope

- Прибрати маршрути й автозастосування в `api` — [T91](drop-server-side-suggestion-accept.md).
- Схема таблиці й повтор генерації — [T92](keep-one-suggestion-per-field.md).
- Стрілка біля ціни: її немає й не буде (AC-25).

## DoD

- [ ] AC-81 і AC-69: стрілка копіює у форму, картку пише лише «Зберегти».
- [ ] Тести `web` зелені, `lint` зелений, `pw` пройдено.
- [ ] Коміт: `feat(web): copy a field suggestion into the form`.

## Links

- [ADR 0017](../adr/0017-keep-one-latest-suggestion-per-field.md) · [ADR 0016](../adr/0016-store-the-prom-description-as-html.md) №7
- [T74](show-latest-suggestions-in-product-form.md) — остання пропозиція на поле · [T83](confirm-discarding-unsaved-card-edits.md) — незбережені правки · [T84](add-reject-suggestion-button.md) — Dropped
- [sad.md §6](../sad.md#6-runtime-view), сценарій 9 · [openapi.yaml](../contracts/openapi.yaml) — `FieldSuggestion`
