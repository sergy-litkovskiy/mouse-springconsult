---
id: T88
title: "Spec-и чекають редактор опису Prom за часом, а не за кількістю тиків"
status: Done
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1500
blocked_by: []
blocks: [T81]
updated_at: "2026-10-02"
---

# T88 — Spec-и чекають редактор опису Prom за часом, а не за кількістю тиків

## Context

Знахідка 2026-10-02 під час T70. Тест `prom-description-editor.spec.ts` › «shows the stored HTML
formatted and leaves the form untouched» зрідка падає з `Error: the editor never loaded`: два падіння
на 31 повний прогін `web npm run test`. T70 файлів редактора не торкалась. Перший раз вивід обрізав
`tail`, тож впіймано лише друге падіння, і воно припало саме на цей тест.

**Гіпотеза.** Редактор вантажить Tiptap через `import()` дванадцяти модулів (`createEditor` у
`prom-description-editor.ts`). Хелпер `open()` у spec чекає на `.ProseMirror` циклом
`attempt < 50` викликів `settle()`, кожен з `setTimeout(0)`. Отже, бюджет очікування задано
кількістю тиків, а не часом. Перший тест файлу платить за холодне завантаження модулів, поки
паралельно йдуть ще 16 spec-файлів, і 50 тиків інколи закінчуються раніше, ніж модулі
завантажились. Той самий цикл стоїть у `product-form.spec.ts` (тест AC-62 з T68).

**Що робимо.** Спершу відтворюємо: прогони, доки не впаде, і назва тесту з кожного падіння.
Якщо падає не перший тест файлу або помилка інша, гіпотеза хибна, і задача йде в `plan`. Якщо
гіпотеза підтвердилась, обидва цикли замінюємо очікуванням, обмеженим часом (наприклад,
`vi.waitFor` з таймаутом 5 с). Перевірки `expect` і кількість тестів не змінюються: міняється
лише те, як довго хелпер чекає.

## Sequence

Власного сценарію немає: правиться лише очікування в тестах фронту. Редактор
описує [sad.md §6](../sad.md#6-runtime-view), сценарій 6: форма лише показує опис з картки.

## Data delta

**Немає.** Поведінка застосунку не змінюється.

## API contract excerpt

Контракт не змінюється; для орієнтира — поле, яке показує редактор:

```yaml
        descriptionProm: { type: string, description: "HTML з переліку ADR 0016" }
```

## Acceptance criteria

Нового AC немає: це стабільність тестів без зміни поведінки.

**Критерій — стабільність**
**Given** гілка з правкою
**When** `docker compose run --rm --no-deps web npm run test` проганяють 30 разів поспіль
**Then** усі 30 прогонів зелені

**Критерій — тести ті самі**
**Given** та сама гілка
**When** порівнюємо її з `main`
**Then** кількість тестів у підсумку vitest та сама, а diff не додає й не прибирає жодного рядка з `expect`

## Checklist

1. Відтворити до правки: повні прогони `web npm run test`, доки не впаде двічі; записати назву тесту й помилку кожного падіння.
2. `prom-description-editor.spec.ts`: цикл `attempt < 50` у `open()` замінити очікуванням з бюджетом за часом; `Error: the editor never loaded` лишається, коли бюджет вичерпано.
3. `product-form.spec.ts`: той самий цикл у тесті AC-62 — той самий прийом.
4. 30 повних прогонів поспіль зелені; підсумок vitest — та сама кількість тестів, що до правки.

## Out of scope

- Зміна способу завантаження Tiptap у `prom-description-editor.ts`.
- Інші нестабільні тести, якщо відтворення їх знайде: вони стають окремими задачами.

## DoD

- [x] Обидва цикли чекають за часом, `expect` не змінено.
- [x] 30 прогонів `web` поспіль зелені, `lint` зелений.
- [x] Коміт: `fix(web): wait for the Prom editor by time in specs`.

## Links

- [T48](add-prom-description-editor.md) — редактор опису Prom · [T68](keep-prom-description-on-reopen.md) — тест AC-62 з тим самим циклом
- [sad.md §6](../sad.md#6-runtime-view), сценарій 6 · [openapi.yaml](../contracts/openapi.yaml) — `Product.descriptionProm`
