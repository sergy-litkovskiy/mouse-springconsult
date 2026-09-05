---
id: T07
title: "ImageStorage.ts — адаптер R2 через S3 API"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1400
blocked_by: [T06]
blocks: [T08]
updated_at: "2026-09-05"
---

# T07 — `ImageStorage.ts` — адаптер R2 через S3 API

## Context

`modules/media` існує в репозиторії самим `.gitkeep` — це погоджений каркас, а не залишок.
Модуль створюється з нуля як **адаптер сховища без домену**: він уміє покласти обʼєкт,
повернути ключ і видалити обʼєкт, а слова «картка» не знає
([ADR 0013](../adr/0013-call-media-from-products-as-a-storage-adapter.md)).

`ImageStorage.ts` — єдиний файл у репозиторії, де згадується `@aws-sdk/client-s3`. Це і є
межа: якщо SDK протече в `MediaService` чи в `products`, підміна сховища перестане бути
локальною.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 2** — поведінка при відмові, яка і є
головним предметом цього файлу:

> `api->>r2: кладе оригінал`
> `r2--xapi: клієнт S3 повторює перехідні збої і здається`
> `Note over api,pg: рядок не створюється — неузгодженого стану не виникає`

Власного циклу повторів застосунок не має: три спроби робить клієнт S3, і на це витрачається
частина бюджету `config.http.requestTimeoutMs` = 15 с.

## Data delta

**Немає.** Адаптер не має доступу до бази взагалі: `typeorm` і `pg` згадуються тільки в
`*Repository.ts` і entity ([CLAUDE.md](../../../../CLAUDE.md), правило 6), а `media` не має
ні того, ні іншого.

## API contract excerpt

```yaml
        "502": { $ref: "#/components/responses/StorageUnavailable" }
```

Цей код відповіді існує в трьох операціях контракту — `uploadProductImage`,
`deleteProductImage`, `deleteProduct` — і народжується він рівно тут.

## Acceptance criteria

**AC-10** (US-03, US-04) — відмова зовнішнього сервісу
**Given** `user` запустив дію зі сховищем
**When** сховище недоступне або відповіло помилкою
**Then** система зберігає все вже внесене і лишає картку придатною для повторної спроби

**AC-17 (нове, [T01](align-prd-with-architecture.md)) — відмова при видаленні**
**Given** `user` підтверджує видалення кадру
**When** сховище недоступне
**Then** не видаляється нічого, і повторне видалення того самого ключа після відновлення проходить успішно

## Checklist

1. `apps/api/package.json` — `@aws-sdk/client-s3`.
2. Конструктор бере значення конфігурації, а не читає `process.env`: залежності передаються, створює їх composition root.
3. `put(key, body, contentType)` — кладе обʼєкт.
4. `delete(key)` і `deleteMany(keys)` — поштучно й пакетом; повторне видалення неіснуючого обʼєкта успішне.
5. Помилки клієнта S3 не течуть назовні сирими — назовні йде `storage_unavailable`.

## Out of scope

- Перевірка байтів — [T08](add-media-service.md).
- Складання публічної адреси з ключа — [T12](drop-product-image-url.md): це мапінг у DTO, не робота сховища.
- Власний цикл повторів — свідомо немає ([sad.md §9](../sad.md#9-architecture-decisions), «Рішення, свідомо лишені inline»).

## DoD

- [ ] `@aws-sdk/client-s3` не згадується в жодному файлі, крім `ImageStorage.ts` — перевірено `deps:check`.
- [ ] `media` не імпортує `products` у жодному напрямку — `deps:check` зелений.
- [ ] Повторне видалення того самого ключа не кидає — перевірено проти живого бакета, не на двійнику.
- [ ] Ключі R2 не потрапляють у лог у жодній гілці ([CLAUDE.md](../../../../CLAUDE.md), «Логи»).
- [ ] Коміт: `feat(media): add the R2 image storage adapter`.

## Links

- [ADR 0013](../adr/0013-call-media-from-products-as-a-storage-adapter.md) · [ADR 0007](../adr/0007-serve-images-from-a-public-bucket.md)
- [CONTEXT.md](../CONTEXT.md) — «ключ обʼєкта», Sentinel errors
