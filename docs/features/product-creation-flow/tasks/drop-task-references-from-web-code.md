---
id: T81
title: "Прибрати номери задач і AC з коду web"
status: Blocked
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2000
blocked_by: [T66, T68, T70, T74, T80]
blocks: []
updated_at: "2026-09-30"
---

# T81 — Прибрати номери задач і AC з коду `web`

## Context

Запит 2026-09-30, пункт 4. У коді розсипані посилання на номери задач (`T50`), критерії приймання
(`AC-56`), user stories (`US-07`), розділи документів (`PRD §6.1`, `sad.md §6`) і слово «story». У
живих проєктах так не роблять: `tracker.md` і PRD змінюються, номер у коментарі старіє непомітно, а
читач коду не мусить відкривати трекер, щоб зрозуміти рядок.

Порахунок 2026-09-30 у `apps/web/src`: 31 рядок у коді й шаблонах і 162 у `*.spec.ts` (переважно назви
`it` і `describe` з `(AC-NN)` наприкінці), разом 193, з них 6 — згадки `T54` (реально прибираємо 187). Звідки вони беруться: `tdd-test-writer` має в інструкції
вимогу писати id AC у дужках наприкінці назви тесту, тож без правки інструкції наступний RED їх поверне.

**Що прибираємо.** `T<NN>`, `AC-<NN>`, `US-<NN>`, `PRD §…`, `sad.md §…` і слово «story»; коміти й хеші,
якщо трапляться. Коментар не видаляємо механічно: він має лишитись зрозумілим сам по собі.

| Було | Стало |
|---|---|
| `/** AC-24: a description alone does not enable the price button — … */` | `/** A description alone does not enable the price button — … */` |
| `it('sends the category from the address bar as a filter (AC-55)', …)` | `it('sends the category from the address bar as a filter', …)` |
| `… the catalogue lists it afterwards (T50), and both have …` | `… the catalogue lists it afterwards, and both have …` |
| коментар, що після зняття посилання переказує код | видалити |

Якщо без номера коментар втрачає зміст («absent в AC-27»), правило проговорюємо словами, а не лишаємо на
посилання. Назви тестів після правки лишаються унікальними в межах `describe`.

**Що лишається (явний сенс).**

- Посилання на **ADR** (`ADR 0009`, `ADR 0016 №3`): це постійний журнал рішень, і коментар пояснює,
  чому так, а не яка задача це зробила. Так само ADR згадує кореневий `CLAUDE.md`.
- Шість рядків із `T54` у `product-form.ts`, `product-form.html` і `product-form.spec.ts`: вони позначають код,
  свідомо вимкнений до відкладеної задачі, і є звичайним `TODO` з номером.
- Дати вимірів («measured 2026-09-20») — це факт, а не посилання.

**Щоб не повернулось.** У `.claude/agents/tdd-test-writer.md` крок 3 велить дописувати id AC до назви
тесту; замінити на «назва описує поведінку, без id»: відповідність тестів і AC test-writer лишає у своїй
відповіді (крок 10), а не в коді. Одним реченням доповнити пункт «Коментарі» кореневого `CLAUDE.md`.

## Sequence

Власного сценарію немає: правляться лише коментарі й назви тестів. Так само
[sad.md §6](../sad.md#6-runtime-view) описує стан форми:

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Немає.** Поведінка й розмітка не змінюються.

## API contract excerpt

Контракт не змінюється; для орієнтира — той самий `listProducts`, що й у сусідніх задачах каталогу:

```yaml
      operationId: listProducts
        - { $ref: "#/components/parameters/Page" }
        - { $ref: "#/components/parameters/PageSize" }
```

## Acceptance criteria

Нового AC немає: це зачистка без зміни поведінки.

**Критерій — код**
**Given** гілка з правкою
**When** `user` шукає в `apps/web/src` номери задач, AC, user stories, розділів PRD і `sad.md` та слово «story»
**Then** пошук не знаходить нічого, окрім згадок `T54`

**Критерій — тести**
**Given** та сама гілка
**When** `docker compose run --rm web npm run test` завершується
**Then** тести проходять, а їх кількість дорівнює кількості до першої правки

## Checklist

1. Записати кількість тестів `web` до правок (вивід `npm run test`) — з нею порівнюємо в кінці. Перерахувати рядки командою з DoD: числа в Context — на 2026-09-30.
2. Пройти `apps/web/src`: спершу код і шаблони (31 рядок), потім `*.spec.ts`; переписувати коментарі за таблицею вище, не видаляючи ADR.
3. `.claude/agents/tdd-test-writer.md`, крок 3: без id AC у назві; у кроці 10 перелік тестів з AC лишається у відповіді агента.
4. Кореневий `CLAUDE.md`, «Коментарі»: одне речення — не посилатись у коді на номери задач, AC і розділи документів; ADR можна.
5. Прогнати `lint`, `typecheck`, `test`; порівняти кількість тестів; `git diff --stat` ≤ 500 рядків.

## Out of scope

- Ребро [T76](shrink-card-gallery-frames.md) → T81 не потрібне: це єдина відкрита `web`-задача поза ланцюжком, але вона змінює одне правило CSS без номерів задач.
- `apps/api` — [T82](drop-task-references-from-api-code.md).
- Документи в `docs/`, `CLAUDE.md` застосунків і story-файли: там ці номери й живуть.
- Переписування тестів по суті: міняються лише назви.

## DoD

- [ ] `rg -nP '\bT(?!54\b)\d{2,3}\b|\bAC-\d|\bUS-\d|PRD §|sad\.md|\bstory\b' apps/web/src` не друкує нічого.
- [ ] Кількість тестів `web` та сама, що до правок; `lint` і `typecheck` зелені.
- [ ] `tdd-test-writer.md` більше не просить id AC у назві тесту.
- [ ] Коміт: `refactor(web): drop task and criterion references from code`.

## Links

- [T82](drop-task-references-from-api-code.md) — те саме для `api` · [T80](shrink-app-bar-catalog-header-and-filters.md) — остання правка каталогу, яку ця задача чекає
- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 10–15 · [openapi.yaml](../contracts/openapi.yaml) — `listProducts`
