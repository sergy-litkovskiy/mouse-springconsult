---
id: T99
title: "«Згенерувати все» шукає ціну за щойно згенерованими текстами"
status: Deferred
delivery: 4
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2400
blocked_by: [T98]
blocks: [T100]
updated_at: "2026-10-07"
---

# T99 — «Згенерувати все» шукає ціну за щойно згенерованими текстами

> **Відкладено 2026-10-07 рішенням власника** ([ADR 0019](../adr/0019-keep-price-search-out-of-generate-all.md)).
> Замір [T96](decide-price-range-in-generate-all.md) дав no-go: вилку не знайдено в трьох викликах із
> чотирьох, а вартість одного «Згенерувати все» з ціною сягала $0,17–0,36 при стелі $0,15. Нижче —
> story на момент відкладення, без змін.

## Context

`scope: 'both'` уже робить тексти, а потім ціну, в одному запуску (`PreparationService.ts`).
Але запит ціни (`priceQuery`) складається з полів **картки**, а на новій картці вони порожні:
пропозиції не пишуться в поля (ADR 0017). Пошук ішов би за порожнім рядком. Тож запит
складається з результату текстів того самого запуску, за формулою з ADR 0019
([T96](decide-price-range-in-generate-all.md)): назва Prom, `recognizedItem` і опис.

**Збій ціни не робить запуск `failed`.** Тексти вже оплачені й записані, а ціна — орієнтир.
Тому будь-яка відмова пошуку (`ModelAnswerUnavailable`, помилка SDK, таймаут T98) дає:
- запуск `succeeded`;
- пропозицію `price` у формі «не знайдено» з ADR 0019, яка upsert-ом замінює стару вилку;
- подробиці в `errorDetail`;
- `usage` відхиленої відповіді в запуску, бо T98 кладе його в помилку.

Код `price_unavailable` для нових запусків більше не пишеться. З `error-codes.ts` він не
зникає: його несуть рядки вересня, і каталог (T50) показує їх текстом.

**Окремого запуску ціни немає.** `price` зникає з enum запиту (`ai.contract.ts`), а з ним —
гейт AC-27 у `PreparationRunService` і приклад `title` відповіді 409. CHECK у БД і enum
`PreparationRun.scope` лишаються: історичні рядки мають `scope: price`.

**Ключ ідемпотентності `both` = вхід текстів.** Зараз версія входу `both` містить і `priceQuery`
з полів картки. Після правки ціна виводиться з текстів, тож ключ `both` рахується так само, як
у `texts`: хеш кадрів.

Нову редакцію сценаріїв 5 і 8 `sad.md` пише ця story, бо саме вона змінює поведінку, як T67
переписала сценарій 7.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 5 — у чинній редакції:

> `web->>api: просить тексти й діапазон ціни`
> `worker->>pg: пише пропозиції текстів і usage виклику`
> `worker->>anthropic: просить діапазон ринкових цін`
> `anthropic--xworker: сервіс відповів помилкою`
> `worker->>pg: позначає цінову частину невиконаною`

Сценарій 8 — гейт, який зникає:

> `api->>pg: перевіряє titleProm/titleOlx картки`
> `worker->>pg: читає titleProm/titleOlx і descriptionProm/descriptionOlx картки`

## Data delta

| Що | Зміна |
|---|---|
| схема | **не змінюється**: CHECK `scope` і `field` уже приймають `price` |
| `product_field_suggestions` (`field = price`) | форма «не знайдено» з ADR 0019; upsert за `(product_id, field)` замінює стару вилку |
| `product_preparation_runs.error_code` | нові запуски `both` більше не пишуть `price_unavailable` |

## API contract excerpt

```yaml
        scope:
          type: string
          enum: [texts, price, both, field]
            "ціна" без перезапуску текстів — AC-10b має предмет саме завдяки цій
            області (data-model.md, product_preparation_runs.scope). "texts"/"both"
            `price_unavailable` — часткова відмова `scope: both`: пропозиції текстів
            записані, пропозиції `price` немає, ціну просить окремий `scope: price` (AC-10b).
                title:
```

Усі п'ять фрагментів переписує крок 7 чекліста: enum запиту — без `price`, опис `errorCode`,
приклад `title` прибрано, опис `FieldSuggestion.value` — з формою «не знайдено».

## Acceptance criteria

AC-08 і AC-10b у редакції [T96](decide-price-range-in-generate-all.md); AC-91 нове, його
вносить крок 8 чекліста. Джерело — [PRD §5](../PRD.md#5-acceptance-criteria).

**AC-08 (US-04) — happy path**
**Given** у картці є кадр, поля картки порожні
**When** `user` натискає «Згенерувати все»
**Then** запит ціни складено зі щойно згенерованих назви й опису, а вилка лежить пропозицією `price`

**AC-10b (US-03, US-04) — часткова відмова**
**Given** тексти згенеровано, а пошук ціни відмовив, у картці лежить стара вилка
**When** запуск завершується
**Then** запуск `succeeded`, п'ять пропозицій текстів записані, `price` каже «не знайдено», `errorDetail` пояснює чому, а `usage` пошуку записано

**AC-91 — error**
**Given** клієнт шле `POST …/preparation-runs` з `scope: price`
**When** контролер валідує тіло
**Then** відповідь 400 `validation_failed`, задача не ставиться

## Checklist

1. `PreparationService.spec.ts`: запит ціни з результату текстів за формулою ADR 0019; відмова пошуку — `succeeded`, «не знайдено», `errorDetail`, `usage`; стара вилка замінена.
2. `PreparationService.ts`: `priceQuery` з результату текстів; гілка `scope === 'price'` зникає.
3. `PreparationRunService.spec.ts` і `.ts`: ключ `both` = вхід текстів; гейт `title` прибрано.
4. `ai.contract.ts`: `price` прибрано з enum запиту; тест контролера на 400.
5. `products.contract.ts`: форма «не знайдено» в схемі читання пропозиції `price`.
6. `sad.md §6`: сценарій 5 (успіх з «не знайдено» замість `failed`) і сценарій 8 (ціна — крок «Згенерувати все», без кнопки й гейту).
7. `openapi.yaml`: enum запиту, `errorCode`, приклад `title`, `FieldSuggestion.value`.
8. `PRD.md §5`: AC-91.
9. `pw` на живому стеку: нова картка з одним кадром, одне «Згенерувати все». Очікувану суму з ADR 0019 назвати до виклику, виміряну — після, лише з дозволу.

## Out of scope

- Підказка під ціною у формі — [T100](show-ai-price-range-as-hint.md).
- Окремий повтор лише ціни: повтор — новий «Згенерувати все».
- Видалення `price_unavailable` з `error-codes.ts` і `scope: price` з CHECK.

## DoD

- [ ] AC-08, AC-10b, AC-91 покрито тестами.
- [ ] Тести `api` зелені, `typecheck`, `lint`, `deps:check` зелені; `pw` пройдено.
- [ ] Коміт: `feat(ai): look up the price from the texts just generated`.

## Links

- [T96](decide-price-range-in-generate-all.md) — ADR 0019 · [T98](make-price-lookup-fail-loudly.md) — відмова з `usage`
- [T67](generate-titles-with-texts.md) — назви в тому самому запуску · [T50](show-preparation-failures-in-catalog.md) — тексти помилок у каталозі
- [ADR 0017](../adr/0017-keep-one-latest-suggestion-per-field.md) — upsert пропозиції
