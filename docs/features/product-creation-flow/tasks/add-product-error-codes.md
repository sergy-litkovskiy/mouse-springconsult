---
id: T03
title: "Доменні коди помилок картки і ProductErrors.ts"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1600
blocked_by: [T01]
blocks: [T10]
updated_at: "2026-09-05"
---

# T03 — Доменні коди помилок картки і `ProductErrors.ts`

## Context

`contracts/error-codes.ts` містить шість загальних кодів, усі з `auth` і з рівня фреймворку.
[Контракт](../contracts/openapi.yaml) уже вживає одинадцять доменних, а
`modules/products/ProductErrors.ts` не існує: звіт синхронізації назвав це пунктом 2
drift-check зі статусом **waived** саме тому, що файл ще не написано
([api-sync-report.md](../contracts/api-sync-report.md), Section B).

Дві половини нероздільні: константа без класу лишає код невживаним, клас без константи
змушує фронт мапити рядковий літерал.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 2** — саме тут доменний код уперше
доходить до людини замість того, щоб піти в лог:

> `api-->>web: помилка з доменним кодом «сховище недоступне»`
> `web-->>user: повідомлення — решта картки й галереї ціла`

## Data delta

**Немає.** Коди помилок — константи контракту, не рядки в базі: `error_code` як колонка
зʼявиться лише в `product_preparation_runs` поставки 2
([data-model.md](../data-model.md)), і туди пишеться той самий рядок, що народжується тут.

## API contract excerpt

```yaml
components:
  schemas:
    ErrorResponse:
      properties:
        error:
          properties:
            code: { type: string, example: gallery_full }
```

Коди поставки 1 з [openapi.yaml](../contracts/openapi.yaml): `product_not_found`,
`image_not_found`, `gallery_full`, `invalid_file`, `file_too_large`, `storage_unavailable`,
`invalid_price`.

## Acceptance criteria

**AC-10** (US-03, US-04) — відмова зовнішнього сервісу
**Given** `user` запустив дію, яка звертається до зовнішнього сервісу
**When** сервіс недоступний або відповів помилкою
**Then** система зберігає все вже внесене, повідомляє, що дія не пройшла, і лишає картку придатною для повтору

**AC-09** (US-04, US-06) — error
**Given** `user` вписує ціну картки сам
**When** значення не є невідʼємним числом із щонайбільше двома знаками після коми
**Then** система не зберігає значення й показує, якою має бути ціна

## Checklist

1. `contracts/error-codes.ts` — дописати сім доменних кодів поставки 1; файл лишається **без жодного імпорту**.
2. `modules/products/ProductErrors.ts` — класи-нащадки `AppError` за взірцем `modules/auth/AuthErrors.ts`, кожен зі своїм `statusCode` за контрактом.
3. `modules/products/index.ts` — вивести нові помилки в public API модуля.
4. `apps/web/src/app/api-error-message.ts` — текст українською на кожен новий код.
5. Перевірити, що error-handler у `src/api.ts` нових гілок не потребує: мапінг `AppError` → HTTP уже є.

## Out of scope

- Коди поставки 2 (`preparation_input_incomplete`, `preparation_rate_limited`, `suggestion_not_found`, `suggestion_already_resolved`) — [T29](add-preparation-run-endpoints.md) і [T30](add-suggestion-resolution-endpoints.md).
- Зміна error-handler.

## DoD

- [ ] Кожен доменний код поставки 1 з контракту має константу в `error-codes.ts` **і** клас у `ProductErrors.ts` — звірено списком, не оком.
- [ ] `error-codes.ts` не отримав жодного імпорту: рантаймовий імпорт зі zod-файлу коштує ~55 КБ gzip у бандлі.
- [ ] Кожен новий код має текст українською; жодного сирого `code` в інтерфейсі.
- [ ] `statusCode` кожного класу збігається з кодом відповіді в контракті (409 для `gallery_full`, 413 для `file_too_large`, 422 для `invalid_file` і `invalid_price`, 502 для `storage_unavailable`).
- [ ] `npm run test` в `api` і `web` зелений; `deps:check` зелений.
- [ ] Коміт: `feat(products): add domain error codes for the card`.

## Links

- [api-sync-report.md, Section B п.2](../contracts/api-sync-report.md) — перелік кодів і причина waived
- [sad.md §8](../sad.md#8-crosscutting-concepts), рядок «Доменні коди помилок картки»
- [CONTEXT.md](../CONTEXT.md), розділ Sentinel errors — власник кожного коду
- Взірець: `apps/api/src/modules/auth/AuthErrors.ts`
