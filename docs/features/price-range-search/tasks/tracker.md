---
status: Draft
owner: "Serhii"
reviewers: []
updated_at: "2026-10-09"
stage: "06"
---

# Tracker — price-range-search

Тут записано статус кожної задачі; один рядок відповідає одному PR. Легенда розмірів, розріз по
поставках і граф залежностей — у [_epic.md](_epic.md).

**Статуси:** `Todo` · `Blocked` (чекає на deps) · `In progress` · `In review` · `Done` ·
`Deferred` (відкладено рішенням власника; нічого не блокує й у план не входить) ·
`Dropped` (скасовано рішенням власника; номер не перевикористовується).

## Зараз

**Готова до старту:** T104.
2026-10-09 закрито T103 (документи узгоджено з архітектурою пошуку ціни): вона розблокувала T104.
T104–T118 заведено 2026-10-08. Поставка 2 (T107–T118) стартує лише після go на гейті
[T106](measure-price-search-on-ten-cards.md). На no-go вона вся переходить у `Deferred`.

## Задачі

| ID | Задача | Статус | blocked_by | Est | Закрито |
|----|--------|--------|------------|-----|---------|
| T103 | [Узгодити PRD, CLAUDE.md і відкриті пункти контракту](align-documents-with-price-search-architecture.md) | Done | — | S | 2026-10-09 |
| T104 | [Ключ Gemini, константи, SDK, dep-cruiser](add-gemini-config-and-sdk.md) | Todo | T103 | XS | — |
| T105 | [`GeminiAdapter`](add-gemini-adapter.md) | Blocked | T104 | S | — |
| T106 | [Гейт заміру: go / no-go](measure-price-search-on-ten-cards.md) | Blocked | T105 | S | — |
| T107 | [Прибрати пошук ціни через Anthropic](remove-anthropic-price-search.md) | Blocked | T106 | S | — |
| T108 | [Коди запуску ціни](add-price-search-run-codes.md) | Blocked | T106 | XS | — |
| T109 | [Оголошення в пропозиції `price`](add-price-listings-to-suggestion.md) | Blocked | T107 | XS | — |
| T110 | [`priceSearchInput`](add-price-search-input.md) | Blocked | T104, T106 | XS | — |
| T111 | [Запуск `price` з чернетки](start-price-run-from-draft.md) | Blocked | T110 | S | — |
| T112 | [Запуск `price` через Gemini](search-price-through-gemini.md) | Blocked | T107, T108, T109, T111 | S | — |
| T113 | [`both`: вилка після текстів](search-price-after-texts-in-both.md) | Blocked | T110, T112 | S | — |
| T114 | [Вилка й оголошення в UI](show-price-range-and-listings.md) | Blocked | T109 | S | — |
| T115 | [Кнопка «Знайти ціну»](enable-find-price-button.md) | Blocked | T108, T111, T112, T114 | S | — |
| T116 | [«Згенерувати все» з ціною](generate-all-with-price.md) | Blocked | T113, T115 | XS | — |
| T117 | [`ARCHITECTURE.md` і CONTEXT product-creation-flow](update-architecture-for-gemini.md) | Blocked | T113 | XS | — |
| T118 | [Приймання](verify-price-range-search.md) | Blocked | T116, T117 | S | — |

## Спільний DoD

Кожен PR, окрім задач лише з документами (T103, T117):

- [ ] `docker compose run --rm api npm run typecheck` · `lint` · `test` · `deps:check` — зелені
- [ ] `docker compose run --rm web npm run lint` · `test` — зелені, якщо PR чіпає `apps/web/`
- [ ] Тести без мережі: ні `GEMINI_API_KEY`, ні `ANTHROPIC_API_KEY` у середовищі тестів
- [ ] Для UI-задач — Playwright-прохід сценарію
- [ ] Коміт за Conventional Commits; діапазон правки ≤ 500 рядків

Перед мержем правок у самій теці `tasks/`:

```bash
python3 .claude/skills/feature-break-tasks/references/gate-check.py \
        docs/features/price-range-search/tasks/
```

Команди — скіл `mouse-commands`.
