---
id: T120
title: "Перевіряти оголошення Prom, Shafa і Kloomba за структурованими даними сторінки"
status: Todo
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2000
blocked_by: [T106]
blocks: [T112]
updated_at: "2026-10-09"
---

# T120 — Перевіряти оголошення Prom, Shafa і Kloomba за структурованими даними сторінки

## Context

На замірі [T106](measure-price-search-on-ten-cards.md) 4 з 15 відібраних оголошень уже були
зняті чи неактивні, бо індекс Google відстає. Ціну оголошення досі називає модель. Задачу
додано 2026-10-09 рішенням власника.

Сторінки оголошень Prom, Shafa і Kloomba віддають серверному запиту JSON-LD schema.org з `Offer`.
Перевірка 2026-10-09:

- Prom — після редиректу на `/ua/`: `price: 3420`, `UAH`, `InStock`;
- Shafa: `price: 299`, `UAH`, `InStock`, `NewCondition`;
- Kloomba: `price: 700`, `UAH`, `InStock`, `NewCondition`.

OLX на серверний запит відповідає `403`, тож його оголошення лишаються як є. А це більшість
джерел заміру: 12 з 15.

Перевірку робить `GeminiAdapter` одразу після розкриття редиректу
([ADR 0026](../adr/0026-search-on-the-paid-tier-with-gemini-3-5-flash-lite.md) №4). Запит іде
лише на адресу, яка вже пройшла шаблон сторінки оголошення, тобто на фіксовані хости
майданчиків, а не на будь-яку адресу з відповіді моделі. `sitemap.xml` у задачу не входять: вони
дають лише адреси без цін.

**Два рішення перед стартом:**

1. Чи дозволяють `robots.txt` (правила для `*`) і умови використання Prom, Shafa й Kloomba
   читати сторінки оголошень сервером. У `robots.txt` Prom і Kloomba є рядки `Disallow: /`, але
   до якого User-agent вони належать, не перевірено. Якщо заборонено — задача закривається як
   `Dropped`.
2. Чи відкидати оголошення з `itemCondition: NewCondition`. PRD §7 рахує лише вживані речі, але
   170 з 559 карток у базі мають стан `new`. Вирішує власник.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 1. Перевірка стає частиною розбору відповіді:

> `gemini-->>worker: текст з JSON вилки й оголошень + groundingMetadata`
> `worker->>worker: zod-розбір, 1–5 оголошень http/https, priceFrom ≤ priceTo, обидві > 0`

## Data delta

**Немає.** Форма `value` пропозиції `price` та сама. Змінюється лише вміст: ціна оголошення
Prom, Shafa чи Kloomba береться зі сторінки, а зняте оголошення до вилки не потрапляє.

## API contract excerpt

```yaml
      properties:
        price: { $ref: "#/components/schemas/Money" }
        url:
          type: string
          maxLength: 2048
```

## Acceptance criteria

**AC-1** — зняте оголошення
**Given** редирект веде на сторінку Prom, Shafa чи Kloomba, яка відповідає `404`/`410` або має `availability` не `InStock`
**When** адаптер перевіряє оголошення
**Then** оголошення відкинуто; якщо не лишилось жодного, результат `unparsed`, тобто `price_not_found`

**AC-2** — ціна зі сторінки
**Given** JSON-LD сторінки має `price` у `UAH`, відмінну від ціни моделі
**When** адаптер перевіряє оголошення
**Then** ціна оголошення дорівнює ціні сторінки, і вилка будується з неї

**AC-3** — інша валюта
**Given** `priceCurrency` сторінки не `UAH`
**When** адаптер перевіряє оголошення
**Then** оголошення відкинуто

**AC-4** — перевірка не вдалась
**Given** сторінка не відповіла за таймаут, мережа впала, JSON-LD немає чи він не розбирається, або це OLX
**When** адаптер перевіряє оголошення
**Then** оголошення лишається з ціною моделі, як до цієї задачі, і запуск не кидає виняток

## Checklist

1. Прочитати правила `robots.txt` для `*` і умови Prom, Shafa й Kloomba; висновок записати в story. Заборона — стоп, рішення власника.
2. Отримати рішення власника щодо `NewCondition` і записати його в story.
3. `protected readPage(url)` у `GeminiAdapter`: таймаут `config.ai.priceSearch.pageTimeoutMs`, лише для шаблонів Prom, Shafa й Kloomba, редирект лише в межах того самого хоста (Prom `/ua/`).
4. Розбір JSON-LD zod-схемою `Offer`: `price` за шаблоном `Money`, `priceCurrency`, `availability`, `itemCondition`.
5. Застосувати правила AC-1–AC-4 і перебудувати вилку з цін, що лишились.
6. Spec: тестовий підклас підміняє `readPage`; по тесту на кожен AC, без мережі.
7. Опис `PriceListing.price` у контракті: ціна сторінки для Prom, Shafa й Kloomba — руками до Кроку Б.
8. Рядок §11 SAD «Індекс Google відстає»: пом'якшення для трьох майданчиків — ця задача.

## Out of scope

- OLX: сервер отримує `403`.
- Читання `sitemap.xml` і власний індекс оголошень (PRD §3, підхід B).

## DoD

- [ ] `typecheck`, `lint`, `test`, `deps:check` для `api` зелені, тести без мережі.
- [ ] `security-review` пройдено: сторінка майданчика — недовірений ввід.
- [ ] Коміт: `feat(ai): check marketplace listings against their page data`.

## Links

- [ADR 0026](../adr/0026-search-on-the-paid-tier-with-gemini-3-5-flash-lite.md) · [ADR 0023](../adr/0023-classify-price-search-failures-and-never-retry-them.md) · [T106](measure-price-search-on-ten-cards.md) · [T112](search-price-through-gemini.md)
