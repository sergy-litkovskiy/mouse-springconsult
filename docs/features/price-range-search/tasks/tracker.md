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

**Готові до старту:** T111, T114, T120.
2026-10-09 закрито T110 (`priceSearchInput`: пара назва + опис для пошуку ціни, Prom з перевагою, опис через `draftPlainText`, обидва рядки обрізано): вона розблокувала T111; T113 чекає ще на T112.
2026-10-09 закрито T109 (оголошення-джерела в пропозиції `price`: форма `value`, межі 1–5 і `http(s)` ≤ 2048 у схемі читання): вона розблокувала T114; T112 чекає ще на T111 і T120.
2026-10-09 закрито T108 (коди запуску `price_not_found` і `price_quota_exhausted` у контракті, union і текстах `web`): нічого не розблокувала — T112 чекає ще на T109, T111 і T120, T115 — на T111, T112 і T114.
2026-10-09 закрито T107 (пошук ціни через Anthropic прибрано, `price` і ціна в `both` закриваються `price_unavailable` без throw): вона розблокувала T109; T112 чекає ще на T108, T109, T111 і T120.
2026-10-09 закрито T106 (гейт заміру): **go** на `gemini-3.5-flash-lite` з пошуком Google на платному рівні, 7 з 10 карток ([ADR 0026](../adr/0026-search-on-the-paid-tier-with-gemini-3-5-flash-lite.md)). Того ж дня заведено T119 (перемикач пошуку ціни у формі) і T120 (перевірка оголошень Prom, Shafa й Kloomba за JSON-LD).
2026-10-09 закрито T105 (`GeminiAdapter`): вона розблокувала гейт заміру T106.
2026-10-09 закрито T104 (ключ Gemini, константи, SDK і межа dep-cruiser): вона розблокувала T105; T110 чекає ще на гейт T106.
2026-10-09 закрито T103 (документи узгоджено з архітектурою пошуку ціни): вона розблокувала T104.
T104–T118 заведено 2026-10-08. Поставка 2 (T107–T119) стартувала після go на гейті
[T106](measure-price-search-on-ten-cards.md).

## Задачі

| ID | Задача | Статус | blocked_by | Est | Закрито |
|----|--------|--------|------------|-----|---------|
| T103 | [Узгодити PRD, CLAUDE.md і відкриті пункти контракту](align-documents-with-price-search-architecture.md) | Done | — | S | 2026-10-09 |
| T104 | [Ключ Gemini, константи, SDK, dep-cruiser](add-gemini-config-and-sdk.md) | Done | T103 | XS | 2026-10-09 |
| T105 | [`GeminiAdapter`](add-gemini-adapter.md) | Done | T104 | S | 2026-10-09 |
| T106 | [Гейт заміру: go / no-go](measure-price-search-on-ten-cards.md) | Done | T105 | S | 2026-10-09 |
| T107 | [Прибрати пошук ціни через Anthropic](remove-anthropic-price-search.md) | Done | T106 | S | 2026-10-09 |
| T108 | [Коди запуску ціни](add-price-search-run-codes.md) | Done | T106 | XS | 2026-10-09 |
| T109 | [Оголошення в пропозиції `price`](add-price-listings-to-suggestion.md) | Done | T107 | XS | 2026-10-09 |
| T110 | [`priceSearchInput`](add-price-search-input.md) | Done | T104, T106 | XS | 2026-10-09 |
| T111 | [Запуск `price` з чернетки](start-price-run-from-draft.md) | Todo | T110 | S | — |
| T120 | [Перевірка оголошень за JSON-LD сторінки](check-listings-against-page-data.md) | Todo | T106 | S | — |
| T112 | [Запуск `price` через Gemini](search-price-through-gemini.md) | Blocked | T107, T108, T109, T111, T120 | S | — |
| T113 | [`both`: вилка після текстів](search-price-after-texts-in-both.md) | Blocked | T110, T112 | S | — |
| T114 | [Вилка й оголошення в UI](show-price-range-and-listings.md) | Todo | T109 | S | — |
| T115 | [Кнопка «Знайти ціну»](enable-find-price-button.md) | Blocked | T108, T111, T112, T114 | S | — |
| T116 | [«Згенерувати все» з ціною](generate-all-with-price.md) | Blocked | T113, T115 | XS | — |
| T117 | [`ARCHITECTURE.md` і CONTEXT product-creation-flow](update-architecture-for-gemini.md) | Blocked | T113 | XS | — |
| T119 | [Перемикач «Пошук ціни» у формі картки](toggle-price-search-in-the-form.md) | Blocked | T115, T116 | S | — |
| T118 | [Приймання](verify-price-range-search.md) | Blocked | T116, T117, T119 | S | — |

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
