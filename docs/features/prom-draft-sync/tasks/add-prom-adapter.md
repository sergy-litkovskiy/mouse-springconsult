---
id: T128
title: "Модуль marketplace і PromAdapter: чотири виклики Prom API"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 2200
blocked_by: [T124]
blocks: [T129]
updated_at: "2026-10-10"
---

# T128 — Модуль marketplace і PromAdapter: чотири виклики Prom API

## Context

Перший файл модуля `marketplace` ([ADR 0028](../adr/0028-add-the-marketplace-module-for-prom.md)).
`PromAdapter.ts` — **єдине** місце, що знає Prom API. Він повертає власний union, а не HTTP-відповідь,
тож `PromSyncService` класифікує відмови, не знаючи форми відповіді Prom. SDK немає, лише `fetch`.

Чотири виклики, звірені з OpenAPI Prom і живим магазином
([api-sync-report.md](../contracts/api-sync-report.md), «Звірка» і «Контрольна відправка»):

| Метод | Prom | Що повертає |
|---|---|---|
| `findByExternalId(cardId)` | `GET /products/by_external_id/{id}` | товар (id, статус, наявність, `images.length`) або «немає» — **404 HTML** |
| `submitImport(file, kind)` | `POST /products/import_file`, multipart `file` + `data` | id імпорту (24 hex, рядок) або «не прийнято» — відповідь без `id` |
| `importStatus(importId)` | `GET /products/import/status/{id}` | статус, `created`/`updated`/`not_changed`/`not_in_file`/`with_errors_count`, `errors[].download_images` |
| `makeDraft(cardId)` | `POST /products/edit_by_external_id` | `[{id, status: draft, presence: available}]` одним викликом; `processed_ids` або помилка |

**Параметри подачі — дві константи без аргументів** ([ADR 0030](../adr/0030-identify-the-prom-product-by-the-card-id.md)):
перша — `mark_missing_product_as: none` і решта за замовчуванням; повтор — те саме плюс
`force_update: true` і `updated_fields: ["images_urls", "presence"]`. `kind` лише обирає одну з них.

Класифікація: 401/403 — «доступ», мережа/5xx/незнайома форма (zod) — «недоступний», 404 на пошуку —
«немає». Тіло 401/404 — HTML, тож статус перевіряється **до** zod. Токен і сирі тіла не логуються.

Разом з першим файлом `marketplace` правиться кореневий `CLAUDE.md`
([sad.md §11](../sad.md#11-risks-and-technical-debt), перший рядок розходжень).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарії 1, 2, 4 — виклики, які робить адаптер:

> `worker->>prom: шукає товар за зовнішнім id = id картки`
> `worker->>prom: подає імпорт файлом: xlsx з одним рядком, mark_missing_product_as: none`
> `worker->>prom: статус імпорту`
> `worker->>prom: статус «чернетка», наявність «в наявності»`
> `prom-->>worker: відмова доступу`

## Data delta

**Немає.** Адаптер БД не бачить. Id товару, який він повертає, потім пише сервіс у
`product_prom_sync_runs.prom_product_id` ([T135](submit-prom-import.md)).

## API contract excerpt

Форма id товару, яку адаптер віддає рядком:

```yaml
    PromProductId:
      type: string
      pattern: '^\d{1,19}$'
        Id товару на Prom. Колонка — `VARCHAR(32)` (`products.prom_id`,
        не вміщується в `number` JavaScript без втрат.
```

## Acceptance criteria

**AC-03** (US-01) — domain invariant, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** будь-який виклик `submitImport`
**When** spec перехоплює тіло запиту
**Then** `data` завжди містить `mark_missing_product_as: none`, і в методу немає аргументу, яким це змінити

**AC-08** (US-03) — доступ
**Given** Prom відповідає 401 HTML-сторінкою
**When** адаптер розбирає відповідь будь-якого з чотирьох викликів
**Then** повертається «доступ недійсний», а не виняток і не «недоступний»

**AC-07** (US-03) — недовірена відповідь
**Given** Prom відповідає `200` з тілом незнайомої форми
**When** адаптер розбирає її zod-схемою
**Then** повертається «недоступний»; текст Prom назовні не виходить

## Checklist

1. `marketplace/PromAdapter.ts` з токеном і `config.prom` у конструкторі; `fetch` з таймаутом `config.prom.requestTimeoutMs`, без повторів. Виклик мережі — `protected` метод, щоб spec підміняв його підкласом з `override`.
2. Чотири методи й union результату; zod-схеми відповідей Prom: id імпорту — непорожній рядок (не цифри), лічильник — `not_in_file`.
3. Дві константи параметрів подачі; spec на кожну — точне тіло `data`.
4. Spec класифікації: 401, 403, 404 HTML, 5xx, мережа, таймаут, незнайома форма, відповідь подачі без `id`.
5. `marketplace/CLAUDE.md`: параметри імпорту — лише константи; подача без повторів; токен і сирі відповіді не в логах і не в UI; `edit_by_external_id` не шле `name` (там межа 110, а не 130).
6. `marketplace/index.ts` — експорт адаптера й типів. Кореневий `CLAUDE.md`: прибрати Prom з «Не пишемо інтеграцію з Prom/OLX зараз» (OLX лишається), додати `marketplace` у «Структуру репозиторію».

## Out of scope

- Побудова xlsx ([T129](build-prom-import-file.md)).
- Що робити з кожним результатом ([T135](submit-prom-import.md)–[T137](finish-prom-draft.md)).
- Живий виклик: тести без мережі й без токена.

## DoD

- [ ] `my.prom.ua` згадується лише в `config.ts`; виклики Prom — лише в `PromAdapter.ts`.
- [ ] Жоден результат не кидає виняток назовні; тести зелені без `PROM_API_TOKEN` і мережі.
- [ ] Прохід `security-review`: новий секрет і відповідь Prom як недовірений ввід ([PRD §6.1](../PRD.md#61-security--privacy)).
- [ ] Коміт: `feat(marketplace): add the Prom adapter`.

## Links

- [ADR 0028](../adr/0028-add-the-marketplace-module-for-prom.md) · [ADR 0030](../adr/0030-identify-the-prom-product-by-the-card-id.md) · [ADR 0032](../adr/0032-send-the-import-file-in-the-request-body.md)
- [sad.md §8](../sad.md#8-crosscutting-concepts), «Відповідь Prom», «Секрет Prom»
