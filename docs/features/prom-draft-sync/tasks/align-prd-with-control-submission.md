---
id: T122
title: "Узгодити PRD з ADR 0032 і закритими питаннями"
status: Todo
delivery: 0
gate_profile: docs
owner: "Serhii"
estimate: XS
context_budget: 1400
blocked_by: []
blocks: [T143]
updated_at: "2026-10-10"
---

# T122 — Узгодити PRD з ADR 0032 і закритими питаннями

## Context

SAD, ADR, `events.md`, `data-model.md` і контракт уже враховують контрольну відправку 2026-10-10 і
[ADR 0032](../adr/0032-send-the-import-file-in-the-request-body.md). PRD ще ні:

- **§1 Traceability** каже «Імпорт Prom за посиланням на файл…». Тепер файл іде тілом запиту
  (`import_file`), а `mark_missing_product_as: none` і лічильники звіту поводяться так само.
- **§8, пункт про модуль `marketplace`** закрито [ADR 0028](../adr/0028-add-the-marketplace-module-for-prom.md)
  (sad.md §11 це вже каже), а чекбокс у PRD порожній.
- **§8, пункт про назви > 130** частково закрито `data-model.md`: на dev довших за 130 — 0 з 559.
  Лишається підрахунок на проді до релізу.
- **§8, «Узгодити межу назви 130»** забирає [T141](keep-ai-title-within-prom-limit.md); у PRD
  варто лишити посилання на неї.
- **AC-09** каже «у Prom уже триває інший імпорт» і «Prom зайнятий іншим імпортом». Паралельну
  подачу Prom приймає; відмовляють завислий імпорт і добовий ліміт ручних імпортів (sad.md §11).
  Текст картки — «Prom зараз не приймає імпорт, спробуйте пізніше», як у контракті `prom_busy`.

Решта PRD від контрольної відправки не залежить: AC-12 описує поведінку, яку повтор тепер
гарантовано дає.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 1 — крок, який §1 PRD описує інакше:

> `worker->>prom: подає імпорт файлом: xlsx з одним рядком, mark_missing_product_as: none`

## Data delta

**Немає, бо задача править документ.** Непрямий наслідок для схеми один: PRD перестає згадувати
файл за посиланням, а отже й тимчасовий об'єкт у R2, якого `data-model.md` і так не має.

## API contract excerpt

Контракт уже каже те саме, що має сказати PRD:

```yaml
    sessionCookie:
      type: apiKey
        Нових маршрутів без сесії фіча не вводить: файл імпорту йде до Prom тілом запиту, а не
        за адресою `api` ([ADR 0032](../adr/0032-send-the-import-file-in-the-request-body.md)).
```

## Acceptance criteria

Задача не пише нових AC. Вона лише править текст, на який спираються ці два
([PRD §5](../PRD.md#5-acceptance-criteria)):

**AC-03** (US-01) — domain invariant
**Given** у магазині на Prom є інші товари
**When** user відправляє на Prom одну картку
**Then** PRD §1 пояснює гарантію через `import_file` з `mark_missing_product_as: none`, а не через імпорт за посиланням

**AC-05** (US-02) — error
**Given** на проді можуть бути картки з назвою для Prom понад 130
**When** читач відкриває PRD §8
**Then** видно, що на dev таких 0 з 559, а прод рахується до релізу

## Checklist

1. PRD §1 Traceability: «Імпорт Prom за посиланням на файл» → імпорт файлом тілом запиту, з лінком на ADR 0032.
2. PRD §8: закрити пункт про модуль `marketplace` з лінком на ADR 0028; пункт про назви > 130 позначити частково закритим (0 з 559 на dev, прод — до релізу); біля «Узгодити межу назви 130» дати лінк на T141.
3. Додати в PRD §1 одне речення про контрольну відправку 2026-10-10 з лінком на протокол у `api-sync-report.md`.
4. PRD AC-09: Given і текст картки — за пунктом вище.
5. `updated_at` у frontmatter PRD.

## Out of scope

- PRD product-creation-flow AC-55/AC-56 ([T142](update-architecture-for-prom.md)).
- `ARCHITECTURE.md`, `SPEC.md` і кореневий `CLAUDE.md` (T142, [T128](add-prom-adapter.md)).

## DoD

- [ ] У PRD немає «імпорт за посиланням» як механізму фічі.
- [ ] Відкриті пункти §8 відповідають стану на дату коміту.
- [ ] Коміт: `docs(prom-draft-sync): align the PRD with ADR 0032`.

## Links

- [ADR 0032](../adr/0032-send-the-import-file-in-the-request-body.md) · [ADR 0028](../adr/0028-add-the-marketplace-module-for-prom.md)
- [data-model.md](../data-model.md), Open items · [api-sync-report.md](../contracts/api-sync-report.md)
