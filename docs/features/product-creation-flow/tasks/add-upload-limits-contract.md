---
id: T04
title: "Межа розміру кадру й перелік типів у products-limits.ts"
status: Todo
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1300
blocked_by: []
blocks: [T05, T06, T08]
updated_at: "2026-09-05"
---

# T04 — Межа розміру кадру й перелік типів у `products-limits.ts`

## Context

Фронт має відмовити у вивантаженні **до** того, як почне слати десять мегабайтів: для цього
межа розміру й перелік дозволених типів мають бути константами контракту, які браузер читає
в рантаймі. `products-limits.ts` уже влаштований саме так — без жодного імпорту, щоб zod не
потрапив у бандл ([sad.md §7](../sad.md#7-deployment-view)).

Задача маленька, але стоїть першою в трьох гілках.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 1** — крок, який читає ці константи двічі,
на обох боках:

> `web->>web: малює превʼю з локального файлу, не чекаючи на сервер`
> `api->>api: перевіряє, що це зображення і що воно в межах розміру`

## Data delta

**Немає.** Обидві межі свідомо лишаються в коді, а не в SQL: `maxImagesPerProduct`
перевіряє сервіс, `maxImageBytes` — сервіс і проксі. Той самий вибір, що вже зроблено для
`maxKeywords` ([data-model.md](../data-model.md), `products.seo_keywords`: «межа 30 слів — у
коді, не в SQL»).

## API contract excerpt

```yaml
                file:
                  type: string
                  format: binary
                  description: До 10 МБ (PRD §6); тип перевіряється за сигнатурою, не за розширенням.
```

## Acceptance criteria

**AC-02** (US-01) — domain invariant
**Given** у галереї картки вже десять кадрів
**When** `user` намагається додати ще один
**Then** система відхиляє додавання і повідомляє, що галерея вміщає щонайбільше десять кадрів

**AC ([PRD §6](../PRD.md#6-non-functional-requirements), рядок «Обсяг і ліміти вхідних даних»)**
**Given** `user` обирає файл понад 10 МБ
**When** форма готується його надіслати
**Then** межа відома фронту з константи контракту, і запит не починається

## Checklist

1. `maxImageBytes` — 10 МБ, записане так, щоб було видно одиницю (`10 * 1024 * 1024`).
2. `allowedImageTypes` — закритий перелік MIME-типів зображень.
3. Коментар про те, що те саме число дублюють `config.http.bodyLimitBytes` і `Caddyfile`, і що пара розходиться мовчки.
4. Перевірити, що файл лишився без жодного імпорту.

## Out of scope

- Ліміт тіла запиту у Fastify і Caddy — [T06](configure-r2-and-body-limits.md).
- Спосіб перевірки типу за сигнатурою — [T08](add-media-service.md). Тут лише перелік.
- `maxImagesPerProduct` — уже є, не чіпаємо.

## DoD

- [ ] `products-limits.ts` не має жодного імпорту — перевірено `grep '^import'`.
- [ ] Одиниця виміру видима в коді, а не схована в числі `10485760`.
- [ ] Коментар називає обидва парні місця поіменно, щоб [T06](configure-r2-and-body-limits.md) не довелось їх шукати.
- [ ] `npm run typecheck` і `lint` в `api` зелені.
- [ ] Коміт: `feat(products): add upload limits to the contract constants`.

## Links

- [PRD §6](../PRD.md#6-non-functional-requirements) · [PRD §5](../PRD.md#5-acceptance-criteria) AC-02
- [sad.md §7](../sad.md#7-deployment-view) — рівень конфігурації для цих значень
- [CONTEXT.md](../CONTEXT.md) — «кадр», «галерея»
