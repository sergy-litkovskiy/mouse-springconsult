---
id: T06
title: "Креденшели R2, домен бакета, парні ліміти тіла"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1500
blocked_by: [T04]
blocks: [T07, T12]
updated_at: "2026-09-05"
---

# T06 — Креденшели R2, домен бакета, парні ліміти тіла

## Context

Поставка 1 вводить рівно одну нову межу — зовнішнє сховище
([sad.md §4 S1](../sad.md#s1-кадр-приймається-одним-синхронним-запитом-похідних-розмірів-система-не-робить)),
і вся її конфігурація лягає в один прохід. Задача закриває **чотири з семи місць реєстрації**
[sad.md §5](../sad.md#5-building-block-view) — саме ті, де файл легко створити й забути підʼєднати.

Ліміт тіла — пара, яка розходиться мовчки: `config.http.bodyLimitBytes` зараз 256 KiB, і
десятимегабайтний кадр упреться в нього раніше, ніж дійде до перевірки.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 1** — кроки, які без цієї конфігурації не
виконаються взагалі:

> `api->>r2: кладе оригінал під ключем products/<картка>/<кадр>`
> `web->>r2: читає кадр за цією адресою`

Перший потребує креденшелів, другий — публічного домену бакета.

## Data delta

**Немає.** Але один непрямий наслідок є і його треба бачити: без `R2_PUBLIC_BASE_URL`
адресу з ключа не скласти, і саме тому [data-model.md](../data-model.md) відклав знесення
колонки `product_images.url` до [T12](drop-product-image-url.md), а не написав його раніше.

## API contract excerpt

```yaml
servers:
  - url: https://mouse.springconsult.com.ua/api
```

Ліміт тіла — не поле контракту, а його передумова: без нього `uploadProductImage`
відповідатиме 413 на будь-який реальний кадр.

## Acceptance criteria

**AC ([PRD §6](../PRD.md#6-non-functional-requirements), рядок «Обсяг і ліміти вхідних даних»)**
**Given** конфігурація застосунку піднята
**When** `user` надсилає кадр розміром 10 МБ
**Then** ні Fastify, ні Caddy не обривають запит — обидві межі узгоджені з `maxImageBytes`

**AC ([CLAUDE.md](../../../../CLAUDE.md), «Конфігурація — три рівні»)**
**Given** одна з пʼяти змінних R2 не задана
**When** процес `api` стартує
**Then** він падає на старті з внятним повідомленням, а не через годину на першому вивантаженні

## Checklist

1. `envSchema` у `src/config.ts` — `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`.
2. `config.http.bodyLimitBytes` — підняти до межі з `products-limits.ts` плюс запас на обгортку multipart.
3. `.env.example` — ті самі пʼять змінних як зразок, без значень.
4. `docker-compose.yml` і `docker-compose.prod.yml` — проброс змінних у сервіс `api`.
5. `infra/caddy/Caddyfile` — `request_body max_size`, парний до `bodyLimitBytes`, з коментарем про парність.

## Out of scope

- Клієнт S3 — [T07](add-image-storage-adapter.md). Тут лише значення, які він читатиме.
- Ключ Anthropic і параметри черги — поставка 2, [T25](add-queue-and-worker.md) і [T27](add-anthropic-adapter.md).

## DoD

- [ ] `docker compose up api` падає з внятним повідомленням, якщо прибрати будь-яку з пʼяти змінних — перевірено вручну на кожній.
- [ ] Домен бакета лежить поруч із креденшелами в `process.env`, а не в `config.ts`: один бакет описується в одному місці, інакше запис і читання розходяться по різних бакетах.
- [ ] `bodyLimitBytes` і `max_size` у `Caddyfile` виведені з одного числа, і обидва мають коментар про парність.
- [ ] `.env` у git не потрапив; `.env.example` оновлено.
- [ ] Коміт: `feat(api): configure R2 credentials and paired body limits`.

## Links

- [sad.md §5](../sad.md#5-building-block-view) — місця реєстрації 4, 5, 6, 7 · [sad.md §7](../sad.md#7-deployment-view)
- [CLAUDE.md](../../../../CLAUDE.md) — «Конфігурація — три рівні, не плутаємо»
- [CONTEXT.md](../CONTEXT.md) — «ключ обʼєкта»
