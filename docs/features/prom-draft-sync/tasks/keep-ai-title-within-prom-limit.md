---
id: T141
title: "Підготовка назви для Prom AI тримає межу 130"
status: Blocked
delivery: 1
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1300
blocked_by: [T123]
blocks: [T143]
updated_at: "2026-10-10"
---

# T141 — Підготовка назви для Prom AI тримає межу 130

## Context

Ризик Medium з [sad.md §11](../sad.md#11-risks-and-technical-debt): «підготовка назви AI не знає
межі 130». Зараз `AnthropicAdapter` просить «кожну назву до
`productConstraints.titleMaxLength` (200) знаків», а `PreparationService.singleLineTitle` обрізає
обидві назви до 200. Після [T127](limit-prom-title-on-save.md) пропозицію назви для Prom понад 130
не можна зберегти, а після [T130](add-prom-readiness.md) — відправити.

Зміна обмежується модулем `ai`:

- промпт підготовки текстів і переписування поля `titleProm` називає межу
  `productConstraints.promTitleMaxLength`, а назва для OLX лишається до 200;
- `singleLineTitle` отримує межу параметром: 130 для `titleProm`, 200 для `titleOlx`. Обрізання по
  межі слова не змінюється.

Ключові слова AI готує в межах картки (слово ≤ 60), а межа Prom (≤ 50) — це гейт відправки, а не
збереження (AC-06). Тут їх не чіпаємо: так вирішено в PRD.

Живих викликів Claude story не потребує: тести перевіряють записаний запит
(`ai/CLAUDE.md`, «Розробка майже не витрачає API»).

## Sequence

[sad.md §6](../sad.md#6-runtime-view) підготовку не малює. Найближчий крок — перевірка меж Prom
на збереженій картці, яку ця зміна робить рідшою причиною відмови:

> `api->>pg: читає збережену картку, перевіряє готовність і межі Prom`

## Data delta

**Немає.** Пропозиції пишуться в `product_field_suggestions.value` як і раніше, просто коротші.

## API contract excerpt

```yaml
        titleProm:
          maxLength: 130
            Межа Prom, `productConstraints.promTitleMaxLength`; назва для OLX лишається до 200.
```

## Acceptance criteria

**AC-05** (US-02) — error, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** модель повернула назву для Prom на 150 знаків
**When** `PreparationService` записує пропозицію
**Then** пропозиція `titleProm` ≤ 130 знаків, обрізана по межі слова; `titleOlx` з тієї самої відповіді може мати до 200

**AC-05** (US-02) — промпт
**Given** запуск підготовки текстів чи переписування `titleProm`
**When** spec читає записаний запит до Claude
**Then** текст запиту називає 130 для назви Prom і 200 для назви OLX

## Checklist

1. `AnthropicAdapter`: межі назв у промпті з двох констант; spec на текст запиту для `texts` і `field: titleProm`.
2. `PreparationService.singleLineTitle(text, maxLength)`; виклики для `titleProm` і `titleOlx` з різними межами; spec на 150 знаків і на одне слово понад межу.
3. PRD product-creation-flow: у місці, де описано назву для Prom, межа 130 з лінком на AC-05 PRD prom-draft-sync.

## Out of scope

- Межі ключових слів Prom у підготовці (рішення PRD: гейт відправки, не генерації).

## DoD

- [ ] Жодного живого виклику Claude; тести зелені без ключа.
- [ ] Коміт: `feat(ai): keep the Prom title within 130 characters`.

## Links

- [PRD §8](../PRD.md#8-open-questions), «Узгодити межу назви для Prom» · [PRD product-creation-flow](../../product-creation-flow/PRD.md)
