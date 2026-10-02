---
id: T82
title: "Прибрати номери задач і AC з коду api"
status: Blocked
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1600
blocked_by: [T74, T91, T92]
blocks: []
updated_at: "2026-09-30"
---

# T82 — Прибрати номери задач і AC з коду `api`

## Context

Запит 2026-09-30, пункт 4; друга половина зачистки, перша — [T81](drop-task-references-from-web-code.md).
Мотив і правила ті самі: номери задач, AC, user stories і розділів документів у коментарях старіють
разом із трекером, а читач коду не мусить його відкривати. Розріз надвоє — через ліміт ≤ 500 рядків на PR.

Порахунок 2026-09-30 у `apps/api` (`src`, `db`): 40 рядків у коді й міграціях і 168 у `*.spec.ts`, разом
208. Найбільше — `modules/products` (142), `modules/ai` (34), `contracts` (20), `config.ts` (5),
міграції (5), `modules/media` (2).

**Що прибираємо, що лишаємо, як переписуємо** — за [T81](drop-task-references-from-web-code.md#context):
`T<NN>`, `AC-<NN>`, `US-<NN>`, `PRD §…`, `sad.md §…`, «story» і хеші комітів зникають, коментар після
цього має читатись сам, назви тестів лишаються унікальними; посилання на **ADR** лишаються.
Винятків через `T54` в `api` немає.

Що варто знати саме тут:

- **Міграції.** Коментарі в застосованих міграціях правити можна: TypeORM тримає їх за іменем і міткою часу, а не за
  вмістом. Міняються лише коментарі, `up` і `down` — ні.
- **Коментар, що тримається на AC.** Формулювання на кшталт «absent in AC-27, so an empty string» переписати
  словами: правило («текстові колонки NOT NULL з `''`, тож „відсутнє“ — порожній рядок») уже відоме з коду й ADR.
- **`config.ts`.** «found on T27's live run» стає «found on a live run»: факт лишається, номер зникає.

## Sequence

Власного сценарію немає: правляться лише коментарі й назви тестів. Так само
[sad.md §6](../sad.md#6-runtime-view) описує стан форми:

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Немає.** Схема, міграції за змістом і поведінка не змінюються.

## API contract excerpt

Контракт не змінюється; коментарі схем у `contracts/` правляться разом із рештою:

```yaml
      operationId: getProduct
        images:
          type: array
          maxItems: 10
          items: { $ref: "#/components/schemas/ProductImage" }
```

## Acceptance criteria

Нового AC немає: це зачистка без зміни поведінки.

**Критерій — код**
**Given** гілка з правкою
**When** `user` шукає в `apps/api/src` і `apps/api/db` номери задач, AC, user stories, розділів PRD і `sad.md` та слово «story»
**Then** пошук не знаходить нічого

**Критерій — тести**
**Given** та сама гілка
**When** `docker compose run --rm api npm run test` завершується
**Then** тести проходять, а їх кількість дорівнює кількості до першої правки

## Checklist

1. Записати кількість тестів `api` до правок (вивід `npm run test`) і перерахувати рядки командою з DoD: числа в Context — на 2026-09-30.
2. Пройти `modules/products`, `modules/ai`, `modules/media`, `modules/auth`, `contracts/`, `config.ts`, `db/migrations`: спершу код (40 рядків), потім `*.spec.ts`; ADR не чіпати.
3. Прогнати `typecheck`, `lint`, `test`, `deps:check`; порівняти кількість тестів.
4. `git diff --stat` ≤ 500 рядків; якщо більше — розрізати за модулями.

## Out of scope

- `apps/web` — [T81](drop-task-references-from-web-code.md); правка інструкцій агентів і `CLAUDE.md` теж там.
- Документи в `docs/`, `CLAUDE.md` модулів (`modules/ai/CLAUDE.md`, `modules/auth/CLAUDE.md`) і story-файли.
- Зміст тестів: міняються лише назви.

## DoD

- [ ] `rg -nP '\bT\d{2,3}\b|\bAC-\d|\bUS-\d|PRD §|sad\.md|\bstory\b' apps/api/src apps/api/db` не друкує нічого.
- [ ] Кількість тестів `api` та сама, що до правок; `typecheck`, `lint` і `deps:check` зелені.
- [ ] Коміт: `refactor(api): drop task and criterion references from code`.

## Links

- [T81](drop-task-references-from-web-code.md) — те саме для `web`, з таблицею «було — стало» · [T74](show-latest-suggestions-in-product-form.md), [T91](drop-server-side-suggestion-accept.md) і [T92](keep-one-suggestion-per-field.md) — відкриті правки `products` і `preparation`, які ця задача чекає
- [apps/api/CLAUDE.md](../../../../apps/api/CLAUDE.md) — правила модулів · [openapi.yaml](../contracts/openapi.yaml) — `getProduct`
