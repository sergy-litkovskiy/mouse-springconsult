---
id: T142
title: "ARCHITECTURE.md, SPEC.md і PRD product-creation-flow після Prom"
status: Blocked
delivery: 1
gate_profile: docs
owner: "Serhii"
estimate: XS
context_budget: 1500
blocked_by: [T126, T138]
blocks: [T143]
updated_at: "2026-10-10"
---

# T142 — ARCHITECTURE.md, SPEC.md і PRD product-creation-flow після Prom

## Context

Три рядки розходжень з підписаними документами з [sad.md §11](../sad.md#11-risks-and-technical-debt)
лишаються після коду. Четвертий, кореневий `CLAUDE.md`, закриває [T128](add-prom-adapter.md) разом
з першим файлом `marketplace`, бо саме `CLAUDE.md` забороняє цей код.

- **`ARCHITECTURE.md`**: таблиця модулів — у `products` прибрати «категорію», додати рядок
  `marketplace`; «Межі, які тримаємо свідомо» — `marketplace` уже є; схема розгортання — вихідний
  виклик `worker` → Prom. Рядок `media` не змінюється: після
  [ADR 0032](../adr/0032-send-the-import-file-in-the-request-body.md) не-зображень у R2 немає.
- **`SPEC.md`**: Non-goal 1 переписати — одноразове створення чернетки тепер у межах, а публікація,
  оновлення й двостороння синхронізація лишаються поза ними; з AC «Картка створюється без фото…»
  прибрати категорію; Goal 3 уточнити: `products` отримує підпапку `prom-sync/` без переробки
  наявного.
- **PRD product-creation-flow AC-55, AC-56** (поле «Категорія» і фільтр) — позначити виведеними з
  лінком на PRD prom-draft-sync ([PRD §8](../PRD.md#8-open-questions)).

`ARCHITECTURE.md` §11 дає строк «разом з першим файлом `marketplace`». Тут story йде після коду:
таблиця модулів описує те, що вже змерджено, і так менше переписування.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 1 — вихідний виклик, який з'являється на схемі
розгортання:

> `worker->>prom: подає імпорт файлом: xlsx з одним рядком, mark_missing_product_as: none`

## Data delta

**Немає, бо задача править документи.** Непрямий наслідок: таблиця модулів перестає згадувати
колонку `products.category`, видалену в [T126](drop-product-category.md).

## API contract excerpt

```yaml
    - **дельта картки** — `category` зникає з картки, тіл збереження й фільтра каталогу, а
      маршрут `/products/categories` видаляється (US-05, AC-16). Назва для Prom при збереженні
```

## Acceptance criteria

Задача пише не AC фічі, а відповідність їм документів рівня системи
([PRD §5](../PRD.md#5-acceptance-criteria)):

**AC-16** (US-05) — happy path
**Given** читач відкриває `SPEC.md` і `ARCHITECTURE.md`
**When** шукає поле «Категорія»
**Then** його немає ні в AC SPEC, ні в таблиці модулів, а AC-55/56 PRD product-creation-flow позначено виведеними

**AC-01** (US-01) — happy path
**Given** читач відкриває схему розгортання `ARCHITECTURE.md`
**When** шукає, хто ходить до Prom
**Then** бачить лише `worker` → Prom.ua API; `api` до Prom не ходить

## Checklist

1. `ARCHITECTURE.md`: таблиця модулів (`products` без категорії, рядок `marketplace`), «Межі, які тримаємо свідомо», схема розгортання.
2. `SPEC.md`: Non-goal 1, AC про картку без фото, Goal 3.
3. PRD product-creation-flow: AC-55, AC-56 — позначка «виведено» з лінком на PRD prom-draft-sync.
4. sad.md §11: три рядки розходжень позначити закритими з датою й лінком на цю story.

## Out of scope

- Кореневий `CLAUDE.md` ([T128](add-prom-adapter.md)).
- PRD цієї фічі ([T122](align-prd-with-control-submission.md)).

## DoD

- [ ] Жодного «категорія» у `ARCHITECTURE.md` і `SPEC.md` як поля картки.
- [ ] Коміт: `docs(prom-draft-sync): update the architecture and spec for Prom drafts`.

## Links

- [sad.md §11](../sad.md#11-risks-and-technical-debt), «Розходження з підписаними документами»
- [ADR 0028](../adr/0028-add-the-marketplace-module-for-prom.md) · [ADR 0032](../adr/0032-send-the-import-file-in-the-request-body.md)
