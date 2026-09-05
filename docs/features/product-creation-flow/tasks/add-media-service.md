---
id: T08
title: "MediaService.ts — перевірка байтів і запис обʼєкта"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1500
blocked_by: [T04, T07]
blocks: [T14, T16, T17]
updated_at: "2026-09-05"
---

# T08 — `MediaService.ts` — перевірка байтів і запис обʼєкта

## Context

Перевірка виконується **до** звернення до сховища й спирається на сигнатуру вмісту, а не на
розширення чи заявлений `Content-Type`
([ADR 0004](../adr/0004-validate-uploads-in-api-before-r2.md)). Заявлений тип надсилає
браузер, і довіряти йому означає прийняти будь-що під виглядом JPEG.

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
3. Доменні помилки `invalid_file`, `file_too_large`, `storage_unavailable`.
4. `media/index.ts` — public API модуля; deep import у `media` заборонено.
5. `MediaService.spec.ts` — двійники як підкласи `ImageStorage` з `override`, оголошені в самому файлі тесту: правильний JPEG, PNG із підробленим `Content-Type`, файл на межі розміру, файл за межею, недоступне сховище.

## Out of scope

- Ліміт кадрів на картку (AC-02) — це домен картки, і живе він у `ProductService` ([T14](add-image-upload-endpoint.md)).
- Оптимізація через sharp — поставка 2 ([T27](add-anthropic-adapter.md)): у сховищі лежить тільки оригінал.

## DoD

- [ ] Тип визначається за сигнатурою вмісту — тест із підробленим `Content-Type` відхиляє файл.
- [ ] Жодного звернення до `ImageStorage` до того, як перевірка пройшла — перевірено тестом на двійнику, який рахує виклики.
- [ ] У логи не потрапляє тіло зображення в жодній гілці.
- [ ] `MediaService` не згадує ні `fastify`, ні DTO, ні слова «картка» — `deps:check` зелений.
- [ ] Двійники живуть у самому `*.spec.ts`, окремих файлів з фейками не заведено ([CLAUDE.md](../../../../CLAUDE.md), правило 8).
- [ ] Коміт: `feat(media): add the media service with content-signature checks`.

## Links

- [ADR 0004](../adr/0004-validate-uploads-in-api-before-r2.md) · [sad.md §8](../sad.md#8-crosscutting-concepts), «Перевірка вхідного файлу»
- [CONTEXT.md](../CONTEXT.md) — «кадр», Sentinel errors
