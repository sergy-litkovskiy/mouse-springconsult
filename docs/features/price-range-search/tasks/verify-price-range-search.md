---
id: T118
title: "Приймання: QG-1–QG-3 на живому стеку, ліміт і кадри"
status: Blocked
delivery: 2
gate_profile: verification
owner: "Serhii"
estimate: S
context_budget: 1800
blocked_by: [T116, T117]
blocks: []
updated_at: "2026-10-08"
---

# T118 — Приймання: QG-1–QG-3 на живому стеку, ліміт і кадри

## Context

Закриває фічу. Прогони взято з «How verify» трьох quality goals
([sad.md §10](../sad.md#10-quality-requirements)) і з рядків PRD §6 без окремого QG. Spec-и
окремих story вже перевірили логіку з двійниками. Тут перевіряється зібрана система: `api`,
`worker`, черга, справжній Gemini і браузер.

Перед деплоєм ще одна перевірка з [events.md](../contracts/events.md) («Зворотна
сумісність»): у `pgboss.job` немає задач `price` у станах `created`/`retry`/`active`, бо payload
`price` отримав обов'язкові поля.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарії 3 і 4, які приймання проганяє наживо:

> `else мережа, 5xx, таймаут, недійсний ключ`
> `worker->>pg: finishRun failed price_unavailable + пропозиції текстів`
> `api->>pg: частковий UNIQUE на queued/running — знаходить той самий запуск`
> `api->>pg: попередній запуск завершено — новий запуск (ADR 0017 №6)`

## Data delta

Нічого не змінює, а **перевіряє** в схемі:

| Що | Де |
|---|---|
| попередня пропозиція `price` і її `created_at` не змінились після невдачі | `product_field_suggestions` |
| запуск `price` має `model` Gemini і 0 токенів, `both` — модель і токени Claude | `product_preparation_runs` |
| `error_code` кожної невдачі відповідає причині | `product_preparation_runs.error_code` |
| `products.price` не змінилась після пошуку | `products` |

## API contract excerpt

```yaml
        "429":
          description: >-
            20 запусків на картку за годину, спільних для всіх областей (PRD §1). Це ліміт
            частоти самого `api`, а не квота Gemini: вичерпану денну квоту запуск отримує
            вже у `worker` як `errorCode: price_quota_exhausted` (AC-09).
```

## Acceptance criteria

Quality goals [sad.md §10](../sad.md#10-quality-requirements):

**QG-1. Стійкість до відмови пошуку**
**Given** постачальник пошуку недоступний: недійсний ключ або вимкнена мережа `worker`
**When** запущено `price` і окремо `both`
**Then** тексти, поля картки й попередня вилка цілі, на запуск пішов 1 запит, повтору немає, код — `price_unavailable`

**QG-2. Без джерел вилки немає**
**Given** пошук знайшов вилку
**When** user дивиться на форму
**Then** поле ціни порожнє, кнопки прийняття немає, вилка має 1–5 оголошень, і ті відкриваються в новій вкладці

**QG-3. Незаблокований інтерфейс**
**Given** user натискає «Знайти ціну» чи «Згенерувати все»
**When** запуск прийнято
**Then** відгук ≤ 500 ms, `waitMs` до старту задачі ≤ 5 с, форма робоча, кнопки запусків вимкнені до кінця

## Checklist

1. QG-1, `price`: недійсний `GEMINI_API_KEY`, потім вимкнена мережа `worker`. Звірити код запуску, незмінну пропозицію `price` і кількість викликів у лозі.
2. QG-1, `both`: те саме. Тексти записано пропозиціями. Два запуски Claude коштують ≈ $0,2 ([ADR 0018](../../../adr/0018-use-sonnet-5-for-card-preparation.md)), тож лише з дозволу власника.
3. `worker` без ключа: стартує з warn, `price` закривається `price_unavailable` без запиту до Google ([sad.md §7](../sad.md#7-deployment-view)).
4. QG-2: Playwright-прохід форми після успішного пошуку. Звірити атрибути посилань і порожнє поле ціни; переглянути збережену пропозицію на картці з 10 кадрами (у запиті ≤ `maxFrames` кадрів, з логу).
5. QG-3: 10 повторів старту, тривалість з pino-логів; `waitMs` запису «job started».
6. Подвійний клік поки запуск іде повертає той самий запуск. Повтор після `failed` ставить новий.
7. 21-й запуск за годину дає `429 preparation_rate_limited`.
8. Запит до `pgboss.job` перед деплоєм (Context).
9. Обидва проходи `security-review` ([T105](add-gemini-adapter.md), [T114](show-price-range-and-listings.md)) виконано, а знахідки закрито ([PRD §6.1](../PRD.md#61-security--privacy)).

## Out of scope

- KPI першого місяця ([PRD §7](../PRD.md#7-metrics--kpis)) міряються після релізу, а не на прийманні.
- Тривалість самого виклику Gemini, бо порога на неї немає ([sad.md §10](../sad.md#10-quality-requirements), «Спостереження без порога»).

## DoD

- [ ] Кожен пункт чеклиста має результат у story: число, код або посилання на лог, а не «працює».
- [ ] Знайдені дефекти стали окремими story, а не правками в цій.
- [ ] Коміт: `docs(price-range-search): record the acceptance run`.

## Links

- [sad.md §10](../sad.md#10-quality-requirements) · [PRD §6](../PRD.md#6-non-functional-requirements) · [PRD §6.1](../PRD.md#61-security--privacy)
