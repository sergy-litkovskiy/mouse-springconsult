---
id: T129
title: "buildPromImportFile: xlsx з одного рядка картки"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: S
context_budget: 1800
blocked_by: [T121, T128]
blocks: [T135]
updated_at: "2026-10-10"
---

# T129 — buildPromImportFile: xlsx з одного рядка картки

## Context

Чиста функція `marketplace/buildPromImportFile.ts`: збережена картка → `Buffer` xlsx з аркушем
`Export Products Sheet` і одним рядком. Файл живе лише в пам'яті й іде в `PromAdapter.submitImport`
([ADR 0032](../adr/0032-send-the-import-file-in-the-request-body.md)). `exceljs` уже в залежностях.

Колонки перевірено на пробі й контрольній відправці 2026-10-10:

| Колонка | Значення |
|---|---|
| `Назва_позиції`, `Назва_позиції_укр` | назва для Prom; той самий український текст в обох (без російської рядок відхиляється) |
| `Опис`, `Опис_укр` | `descriptionProm` як є: його вже очистив `cleanDescription` при збереженні ([ADR 0016](../../product-creation-flow/adr/0016-store-the-prom-description-as-html.md)) |
| `Пошукові_запити`, `Пошукові_запити_укр` | ключові слова через `", "` |
| `Ціна` | **рядок** `price` без `Number()` і округлення (AC-01; проба подавала число) |
| `Валюта`, `Одиниця_виміру`, `Тип_товару`, `Де_знаходиться_товар` | `UAH`, «шт.», `r` (роздріб), «Київ» з `config.prom.draftDefaults` |
| `Наявність` | `-`: товар з'являється «немає в наявності», доки не стане чернеткою |
| `Ідентифікатор_товару` | uuid картки — зовнішній id ([ADR 0030](../adr/0030-identify-the-prom-product-by-the-card-id.md)) |
| `Посилання_зображення` | публічні адреси R2 через `", "`, головне першим, далі за `position` |

Остаточний набір колонок фіксує [T121](resolve-prom-import-questions.md): кабінет показав «1
позиція містить невірні дані», і рішення може змінити чи додати колонку (зокрема «Кількість» = 1
з PRD §8).

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарії 1 і 4 — обидві подачі несуть цей файл:

> `worker->>prom: подає імпорт файлом: xlsx з одним рядком, mark_missing_product_as: none`
> `worker->>prom: подає файл картки з примусовим оновленням фото й наявності — Prom оновлює товар за зовнішнім id`

## Data delta

**Немає запису.** Функція читає `products` (`title_prom`, `description_prom`, `seo_keywords`,
`price`) і `product_images` (`r2_key`, `position`, `is_main`) через картку, яку їй передали. Файл
не зберігається ні в БД, ні в R2.

## API contract excerpt

```yaml
        price:
          type: string
          description: Десятковий рядок, як повертає decimal(12,2). На Prom іде ним самим, без округлення (AC-01).
        descriptionProm: { type: string, description: "HTML з переліку ADR 0016" }
```

## Acceptance criteria

**AC-01** (US-01) — happy path, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** картка з ціною `"8500.50"` і трьома фото, головне — друге за `position`
**When** функція будує файл
**Then** у рядку `Ціна` — рядок `8500.50`, а `Посилання_зображення` починається з головного фото, далі решта за `position`

**AC-03** (US-01) — domain invariant
**Given** будь-яка картка
**When** функція будує файл
**Then** у файлі рівно один рядок даних, `Ідентифікатор_товару` = uuid картки, `Наявність` = `-`

## Checklist

1. `buildPromImportFile(card, images, publicBaseUrl, draftDefaults)` → `Promise<Buffer>`; колонки — константа файлу, порядок як у таблиці вище з урахуванням рішення T121.
2. Ціна йде рядком, без `Number()`; spec читає файл назад `exceljs` і перевіряє тип і значення клітинки.
3. Фото: головне першим, далі за `position`; адреса — `publicBaseUrl` + `r2Key`, як `ProductImage.url` ([ADR 0007](../../product-creation-flow/adr/0007-serve-images-from-a-public-bucket.md)).
4. Spec: український текст в обох колонках назви й опису; ключові слова через `", "`; один рядок даних; файл відкривається `exceljs` без помилки.

## Out of scope

- Подача файлу ([T128](add-prom-adapter.md), [T135](submit-prom-import.md)).
- Перевірка меж Prom ([T130](add-prom-readiness.md)): функція отримує вже готову картку.

## DoD

- [ ] Жодного `parseFloat`/`Number` над ціною.
- [ ] Тести зелені; `exceljs` імпортується лише в `marketplace` і `db/prom-xlsx.ts`.
- [ ] Коміт: `feat(marketplace): build the one-row Prom import file`.

## Links

- [ADR 0032](../adr/0032-send-the-import-file-in-the-request-body.md) · [sad.md §8](../sad.md#8-crosscutting-concepts), «Гроші», «HTML опису Prom»
- [idea-brief.md](../idea-brief.md) §15 — протокол проби
