---
id: T116
title: "«Згенерувати все» стартує both: тексти, потім вилка"
status: Blocked
delivery: 2
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1200
blocked_by: [T113, T115]
blocks: [T118]
updated_at: "2026-10-08"
---

# T116 — «Згенерувати все» стартує both: тексти, потім вилка

## Context

Сьогодні «Згенерувати все» стартує `scope: texts` (`product-form.ts`, `generateAll`), бо
[ADR 0019](../../product-creation-flow/adr/0019-keep-price-search-out-of-generate-all.md)
тримав ціну поза ним. Бекенд `both` з пошуком після текстів готовий
([T113](search-price-after-texts-in-both.md)), тож форма переходить на `both`
([sad.md §5](../sad.md#5-building-block-view), рядок `product-form.ts`).

За `scope === 'texts'` форма відрізняє «генерується все» від запуску ціни (`generatingAll`),
тож перемикання торкається і цього сигналу. Ребро з [T115](enable-find-price-button.md)
змістовне лише частково. Тексти невдач, залежні від області, з'являються там, а решта — це
спільні `product-form.*`.

## Sequence

[sad.md §6](../sad.md#6-runtime-view), сценарій 2:

> `user->>web: натискає «Згенерувати все»`
> `web->>api: старт запуску both`
> `web-->>user: тексти праворуч від полів, вилка під полем ціни`

## Data delta

**Немає.** Форма лише змінює область запуску. Що пише `both`, описано в
[T113](search-price-after-texts-in-both.md).

## API contract excerpt

```yaml
              both:
                summary: «Згенерувати все» — тексти, потім вилка
                value: { scope: both }
```

## Acceptance criteria

**AC-03** (US-02) — cross-context, [PRD §5](../PRD.md#5-acceptance-criteria)
**Given** user запустив «Згенерувати все» на картці з кадром
**When** запуск завершився успішно
**Then** тексти стоять праворуч від полів, а вилка під полем ціни, хоча в картку нічого не збережено

**AC-04** (US-02) — відмова зовнішнього сервісу, часткова
**Given** «Згенерувати все» підготувало тексти, а пошук вилки не пройшов
**When** форма отримує `failed` з кодом ціни
**Then** тексти на місці, видно, чому ціни немає, і «Знайти ціну» доступна без перезапуску текстів

## Checklist

1. `generateAll()`: `startRun({ scope: 'both' })`.
2. `generatingAll` та інші перевірки області в формі (`=== 'texts'`) охоплюють `both`. Перевірити grep-ом, щоб жодна не лишилась.
3. Після `failed` з кодом ціни форма перечитує картку, як і зараз: тексти невдалого `both` уже записано.
4. Spec форми: запит `both`; після `failed price_unavailable` тексти показано, а «Знайти ціну» доступна.
5. Playwright-прохід: «Згенерувати все» на картці з кадром показує тексти й вилку. Виклик Claude платний (≈ $0,05–0,10 за запуск, [ADR 0018](../../../adr/0018-use-sonnet-5-for-card-preparation.md)), тож прохід один і з дозволу власника.

## Out of scope

- Умова запуску `both` (кадр у галереї) не змінюється.

## DoD

- [ ] `test` і `lint` для `web` зелені; Playwright-прохід записано в story.
- [ ] Коміт: `feat(web): search the price range in generate all`.

## Links

- [ADR 0021](../adr/0021-search-prices-from-the-run-input-not-the-saved-card.md) №4 · [PRD §5](../PRD.md#5-acceptance-criteria) AC-03, AC-04
