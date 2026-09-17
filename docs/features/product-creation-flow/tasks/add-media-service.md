---
id: T08
title: "MediaService.ts — перевірка байтів і запис обʼєкта"
status: Done
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1900
blocked_by: [T03, T04, T07]
blocks: [T14, T16, T17]
updated_at: "2026-09-17"
---

# T08 — `MediaService.ts` — перевірка байтів і запис обʼєкта

## Context

Перевірка виконується **до** звернення до сховища й спирається на сигнатуру вмісту, а не на
розширення чи заявлений `Content-Type`
([ADR 0004](../adr/0004-validate-uploads-in-api-before-r2.md)). Заявлений тип надсилає
браузер, і довіряти йому означає прийняти будь-що під виглядом JPEG.

**Уточнення 2026-09-16 (аудит SDLC).** [T03](add-product-error-codes.md) уже поклала класи
`InvalidFile`, `FileTooLarge` і `StorageUnavailable` у `modules/products/ProductErrors.ts`.
Там вони лишитись не можуть. `products` залежить від `media`
([ADR 0013](../adr/0013-call-media-from-products-as-a-storage-adapter.md)), тож
`MediaService`, який кидає клас із `products`, замкнув би цикл `media → products → media`, а
`no-circular` у `.dependency-cruiser.cjs` його не пропустить. Ця задача **переносить** три
класи в `media`, а не пише їх заново. Коди в `contracts/error-codes.ts` лишаються на місці:
файл спільний і модулів не знає.

Контролера в `media` немає взагалі: маршрут вивантаження є маршрутом галереї картки
([sad.md §5](../sad.md#5-building-block-view)). Модуль закінчується на сервісі.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 1** — порядок, у якому перевірка стоїть
перед сховищем, а не після:

> `api->>api: перевіряє, що це зображення і що воно в межах розміру`
> `api->>r2: кладе оригінал під ключем products/<картка>/<кадр>`

## Data delta

**Немає.** Сервіс повертає ключ, рядок пише репозиторій `products`
([data-model.md](../data-model.md), `product_images.r2_key TEXT NOT NULL UNIQUE`) — межа
модулів проходить саме тут.

## API contract excerpt

```yaml
        "413":
          description: Файл більший за 10 МБ (PRD §6)
              example:
                error: { code: file_too_large, message: "Файл перевищує 10 МБ" }
        "422":
          description: Вміст файлу не є зображенням (ADR 0004)
              example:
                error: { code: invalid_file, message: "Файл не є зображенням" }
```

## Acceptance criteria

**AC-01** (US-01) — happy path
**Given** `user` створює нову картку товару
**When** `user` завантажує кадр
**Then** система додає кадр у галерею, показує превʼю і не змушує чекати на завершення обробки

**AC ([PRD §6.1](../PRD.md#61-security--privacy), abuse case «небезпечний файл на вході»)**
**Given** `user` надсилає файл, що не є зображенням, із заявленим `Content-Type: image/jpeg`
**When** запит доходить до сервісу
**Then** файл відхиляється до потрапляння у сховище, кодом `invalid_file`

## Checklist

1. `store(bytes, key)` — сигнатура вмісту проти `allowedImageTypes`, розмір проти `maxImageBytes`, потім `ImageStorage.put`, потім повернути ключ.
2. `remove(key)` / `removeMany(keys)` — прохід у сховище.
3. Перенести `InvalidFile`, `FileTooLarge`, `StorageUnavailable` з `products/ProductErrors.ts` у `media/MediaErrors.ts` разом з їхніми випадками з `ProductErrors.spec.ts` (→ `MediaErrors.spec.ts`); прибрати їх з `products/index.ts`; коментар над трьома кодами в `contracts/error-codes.ts` має називати `media/MediaErrors.ts`.
4. `media/index.ts` — public API модуля; deep import у `media` заборонено.
5. `MediaService.spec.ts` — двійники як підкласи `ImageStorage` з `override`, оголошені в самому файлі тесту: правильний JPEG, PNG із підробленим `Content-Type`, файл на межі розміру, файл за межею, недоступне сховище.

## Out of scope

- Ліміт кадрів на картку (AC-02) — це домен картки, і живе він у `ProductService` ([T14](add-image-upload-endpoint.md)).
- Оптимізація через sharp — поставка 2 ([T27](add-anthropic-adapter.md)): у сховищі лежить тільки оригінал.

## DoD

- [x] Тип визначається за сигнатурою вмісту — тест із підробленим `Content-Type` відхиляє файл.
- [x] Жодного звернення до `ImageStorage` до того, як перевірка пройшла — перевірено тестом на двійнику, який рахує виклики.
- [x] У логи не потрапляє тіло зображення в жодній гілці: `MediaService` логера не має взагалі.
- [x] `MediaService` не згадує ні `fastify`, ні DTO, ні слова «картка» — `deps:check` зелений.
- [x] Класи трьох помилок існують рівно в одному місці (перенесено окремим комітом `refactor(media)` ще до [T07](add-image-storage-adapter.md)) — `media/MediaErrors.ts`; `git grep "class InvalidFile"` дає один рядок.
- [x] Двійники живуть у самому `*.spec.ts`, окремих файлів з фейками не заведено ([CLAUDE.md](../../../../CLAUDE.md), правило 8).
- [x] Коміт: `feat(media): add the media service with content-signature checks`.

## Links

- [ADR 0004](../adr/0004-validate-uploads-in-api-before-r2.md) · [sad.md §8](../sad.md#8-crosscutting-concepts), «Перевірка вхідного файлу»
- [CONTEXT.md](../CONTEXT.md) — «кадр», Sentinel errors
