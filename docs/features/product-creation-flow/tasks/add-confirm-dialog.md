---
id: T19
title: "Спільний app/confirm-dialog.ts"
status: Todo
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1300
blocked_by: []
blocks: [T21, T22, T23]
updated_at: "2026-09-05"
---

# T19 — Спільний `app/confirm-dialog.ts`

## Context

Підтвердження потрібне у двох місцях — перед видаленням кадру в діалозі галереї й перед
видаленням картки в каталозі. Коли щось знадобилось двом фічам, воно виноситься у файл з
конкретним іменем на рівні `app/`, а не в `shared/`
([apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md), правило 12) — саме так це й названо в
[sad.md §5](../sad.md#5-building-block-view).

Вага задачі не в коді, а в тому, що це **єдиний практичний запобіжник** проти незворотності:
обʼєкти R2 не покриті бекапом, а видалення остаточне.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), **сценарій 4** — крок, який існує лише завдяки цій задачі:

> `user->>web: натискає видалити кадр`
> `web-->>user: діалог підтвердження (SPEC.md)`
> `user->>web: підтверджує`

## Data delta

**Немає.** Але задача існує саме через властивість даних: `pg_dump` поверне рядок
`product_images`, а обʼєкт у R2 — ні ([sad.md §11](../sad.md#11-risks-and-technical-debt)).
Незворотність не в схемі, а поза нею.

## API contract excerpt

**Немає власного** — компонент не звертається до API. Він стоїть **перед** трьома
незворотними операціями контракту:

```yaml
      operationId: deleteProduct
      operationId: deleteProductImage
```

## Acceptance criteria

**AC-18 (нове, [T01](align-prd-with-architecture.md)) — domain invariant**
**Given** `user` натискає видалити
**When** дія незворотна
**Then** система питає підтвердження до запиту, а не після

**AC ([SPEC.md](../../../../SPEC.md), «Створення товару»)**
**Given** діалог підтвердження відкрито
**When** `user` скасовує
**Then** жодного запиту не надіслано

## Checklist

1. `app/confirm-dialog.ts` + `.html` + `.css` — standalone, Angular Material, стан сигналами (zoneless).
2. `app/confirm-dialog.spec.ts` — підтвердження й скасування.
3. Тексти українською; імʼя файлу = імʼя того, що він експортує, без суфікса `.component`.
4. Перевірити, що файл лежить рівно в `app/`, не в `app/components/` і не в `app/shared/`.

## Out of scope

- Виклики діалогу — [T21](add-gallery-upload-dialog.md) і [T22](integrate-catalog-with-form-and-delete.md).
- Каталогу `shared/` не заводимо — його немає й не буде (правило 11).

## DoD

- [ ] Файл лежить рівно в `app/`; каталогів `components/`, `shared/`, `ui/` не зʼявилось.
- [ ] Компонент standalone і zoneless-сумісний; стан — сигналами, не полями класу.
- [ ] Скасування не надсилає жодного запиту — перевірено тестом.
- [ ] `npm run lint` і `test` в `web` зелені.
- [ ] Коміт: `feat(web): add the shared confirm dialog`.

## Links

- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 11, 12 · [sad.md §5](../sad.md#5-building-block-view)
- [sad.md §11](../sad.md#11-risks-and-technical-debt) — чому це запобіжник, а не оздоба
- [CONTEXT.md](../CONTEXT.md) — Invariants (видалення остаточне)
