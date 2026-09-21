---
id: T58
title: "Назви для Prom і OLX у багаторядковому полі"
status: Todo
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 1400
blocked_by: []
blocks: [T66]
updated_at: "2026-09-21"
---

# T58 — Назви для Prom і OLX у багаторядковому полі

## Context

Запит 2026-09-21, пункт 3. Назви товару бувають довгими (до 200 символів), а поля «Назва для
Prom» і «Назва для OLX» у формі картки — однорядкові `input` (`product-form.html`). Довгу
назву не видно повністю, і її важко вичитати. Власник просить `textarea`, яка росте з текстом.

**Назва лишається одним рядком.** Маркетплейси приймають назву без переносів, тож перенос у
полі — лише візуальний. `Enter` не вставляє `\n`, а перенос, що потрапив у значення вставкою
з буфера, замінюється пробілом до того, як значення піде в контрол. Висота — через
`cdkTextareaAutosize` (`@angular/cdk/text-field`), мінімум один рядок.

## Sequence

> `user->>web: вписує обидва заголовки, описи, ключові слова й ціну`
> `web->>api: зберігає картку`

Послідовність із [sad.md §6](../sad.md#6-runtime-view), сценарій 6, не змінюється: змінюється
лише елемент, у якому людина вписує заголовок.

## Data delta

**Немає.** Контракт `titleProm`/`titleOlx` лишається рядком до 200 символів.

## API contract excerpt

```yaml
    ProductUpdateRequest:
        titleProm: { type: string, maxLength: 200 }
        titleOlx: { type: string, maxLength: 200 }
```

## Acceptance criteria

Нове AC із запиту 2026-09-21; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 4 чекліста.

**AC-52 (нове) — happy path**
**Given** відкрита картка з назвою для Prom довшою за ширину поля
**When** форма відмальована
**Then** поле «Назва для Prom» показує всю назву в кількох рядках, а висота поля росте з текстом; так само поводиться «Назва для OLX»

**AC-52 — edge case**
**Given** `user` вставляє в назву текст з переносом рядка або тисне `Enter`
**When** значення потрапляє в поле
**Then** переносу в значенні немає (вставлений перенос став пробілом, `Enter` нічого не додав), а «Зберегти» надсилає назву одним рядком; межа 200 символів і помилка `maxlength` працюють як раніше

## Checklist

1. `product-form.spec.ts`: тести — вставка `"a\nb"` дає в контролі `"a b"`; `Enter` у полі назви значення не змінює; помилка `maxlength` на 201 символі лишається.
2. `product-form.html`: обидва `input` назв → `textarea matInput cdkTextareaAutosize` з `cdkAutosizeMinRows="1"`; `TextFieldModule` в `imports` компонента.
3. `product-form.ts`: обробка `keydown.enter` (без переносу) і заміна переносів пробілом на `input`; без нового файлу.
4. `PRD.md §5`: AC-52 з посиланням на цю story.
5. `pw`: картка з довгою назвою — поле багаторядкове; вставка тексту з переносом; збережене значення в `GET` без `\n`.

## Out of scope

- Лічильник символів біля назви.
- Інші текстові поля форми: описи вже багаторядкові, ключові слова — [T59](edit-keywords-as-chips.md).

## DoD

- [ ] AC-52: назви видно повністю, у значенні немає переносів.
- [ ] Тести `web` зелені, `lint` зелений, `pw` пройдено.
- [ ] Коміт: `feat(web): wrap long product titles in the card form`.

## Links

- [T41](fix-product-form-field-sizing.md) — розміри полів форми · [T66](show-local-ai-progress.md) — править ті самі блоки `product-form.html`
- [sad.md §6](../sad.md#6-runtime-view), сценарій 6 · [openapi.yaml](../contracts/openapi.yaml) — `updateProduct`
