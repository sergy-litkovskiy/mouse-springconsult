---
id: T77
title: "Рівні відступи й сіра підказка в картці товару"
status: Blocked
delivery: 3
gate_profile: implementation
owner: "Serhii"
estimate: XS
context_budget: 2300
blocked_by: [T69]
blocks: []
updated_at: "2026-09-25"
---

# T77 — Рівні відступи й сіра підказка в картці товару

## Context

Запит 2026-09-25 за скріншотом картки. Два пункти:

1. Підказка під «Ключові слова» («Через кому. Зберігаються перші 30.») має стояти врівень з лівим
   краєм поля й бути сірою, як інші підказки: мітки порожніх полів і плейсхолдери.
2. Відступи між полями й елементами картки мають бути однакові. Зараз вони нерівні й помітно різні.

**Звідки нерівність.** `mat-form-field` за замовчуванням має `subscriptSizing="fixed"` і резервує
під підказку ~22 px. `dynamic` мають лише «Ключові слова» й «Ціна», тож під одними полями є
невидимий резерв, а під іншими його немає. Резерв компенсують `padding-bottom: 22px` на
`.card-form__paired > app-suggestion-field` і `.card-form__description` у `product-form.css`. Решта
відступів випадкова: `.card-form` має `gap: 8px`, `.card-prepare` — `padding-bottom: 12px`,
`.card-hint` — `margin-bottom: 16px`, `.card-form__marks` — `padding-bottom: 8px`, а
`.card-form__paired` — `gap: 0 16px`. Через нульовий row-gap на 360 px пропозиція лягає впритул під
поле. У результаті виходять візуальні відступи ~8, ~30 і ~50 px: опис OLX → ключові слова великий,
ціна → категорія малий, категорія → відмітки знову великий.

**Звідки підказка.** Material ставить `.mat-mdc-form-field-hint-wrapper` і `-error-wrapper`
`padding: 0 16px`, тож текст зсунутий праворуч від рамки. Власного токена кольору підказки
Material 22 не має (звірено з `_m3-form-field.scss` у контейнері `web`): підказка успадковує колір
`.mat-mdc-dialog-content`, тобто `--mat-dialog-supporting-text-color` → `on-surface-variant`. Мітки
й плейсхолдери T40 мають `--mat-sys-outline` (`styles.css`).

**Рішення.**

- Усі `mat-form-field` форми отримують `subscriptSizing="dynamic"`, а компенсаційні
  `padding-bottom: 22px` і їхні коментарі зникають.
- Один крок **16 px** між сусідніми блоками: галерея, «Згенерувати все», підказка про фото, кожен
  рядок форми, відмітки. Він діє і всередині рядка на 360 px, тож `.card-form__paired` і
  `.card-form__row` мають `gap: 16px` по обох осях.
- Підказка й текст помилки полів стоять врівень з рамкою: `padding-inline: 0` на обох
  subscript-wrapper у `styles.css`, поруч із правилами міток T40. Компонентний CSS до внутрішніх
  класів Material не дістає. Колір підказки — пряме правило `color: var(--mat-sys-outline)` на
  `.mat-mdc-form-field-hint`, бо токена немає.

Задача чекає на [T69](move-generate-all-below-gallery.md): та переносить `.card-prepare` під галерею
й підганяє саме її відступи. Якби T77 пішла першою, відступи довелося б рівняти двічі.

## Sequence

Власного сценарію немає: це верстка форми, запити не змінюються. Так само
[sad.md §6](../sad.md#6-runtime-view) описує стан форми:

> «власного сценарію це не має, бо це стан форми на фронті, а не запит до `api`»

## Data delta

**Немає.** Правка торкається лише `product-form.html`, `product-form.css` і `styles.css`.

## API contract excerpt

Картку форма бере з `getProduct`; задача змінює лише відступи на екрані, а не склад полів:

```yaml
      operationId: getProduct
```

Контракт не змінюється.

## Acceptance criteria

Нове AC із запиту 2026-09-25; до [PRD §5](../PRD.md#5-acceptance-criteria) його вносить
крок 6 чекліста.

**AC-72 (нове) — happy path**
**Given** `user` відкриває на екрані шириною 1280 px картку з кадром
**When** форма відмальована
**Then** візуальний відступ між сусідніми блоками (галерея, «Згенерувати все», кожен рядок форми, відмітки) — 16 px ±1, лівий край підказки ключових слів збігається з лівим краєм рамки поля (±1 px), а її колір — з кольором мітки порожнього поля

**AC-72 — edge case**
**Given** та сама картка на екрані шириною 360 px, у полі «Ціна» некоректне значення
**When** рядки-пари переносяться й під ціною з'являється помилка
**Then** між полем і пропозицією теж 16 px, помилка стоїть врівень з рамкою й видна повністю, а наступний блок відсувається, зберігаючи 16 px

## Checklist

1. `pw` **до** правки: знімок картки з кадром на 1280 px і виміряні відступи між блоками — для опису PR.
2. `product-form.html`: `subscriptSizing="dynamic"` на всі `mat-form-field`.
3. `product-form.css`: прибрати обидва `padding-bottom: 22px` разом з коментарями; `.card-form` — `gap: 16px` без `padding-top`; `.card-form__paired` і `.card-form__row` — `gap: 16px`; відступи `.card-prepare`, `.card-hint` і `.card-form__marks` звести до того самого кроку. Без hex і без нових кольорів.
4. `styles.css`: `.mat-mdc-form-field-hint-wrapper` і `.mat-mdc-form-field-error-wrapper` — `padding-inline: 0`; `.mat-mdc-form-field-hint` — `color: var(--mat-sys-outline)`.
5. `pw` після: 1280 і 360 px, з помилкою ціни й без неї — виміри з AC-72 через `getBoundingClientRect` і `getComputedStyle`, знімки.
6. `PRD.md §5`: AC-72 з посиланням на цю story.

## Out of scope

- Висота полів і розмір шрифту ([T75](compact-app-typography.md)).
- Розмір кадрів галереї ([T76](shrink-card-gallery-frames.md)).
- Розмітка `app-suggestion-field` ([T73](add-improve-button-and-tonal-ai-actions.md), [T74](show-latest-suggestions-in-product-form.md), [T66](show-local-ai-progress.md)).

## DoD

- [ ] AC-72: один крок 16 px на 1280 і 360 px; підказка й помилка врівень з рамкою, підказка сіра.
- [ ] Тести `web` зелені без змін у `*.spec.ts`, `lint` зелений, `pw` пройдено.
- [ ] Коміт: `style(web): even out the card form spacing and mute the keyword hint`.

## Links

- [T69](move-generate-all-below-gallery.md) — переносить `.card-prepare` під галерею · [T40](compact-catalog-filter-fields.md) — сірі мітки порожніх полів
- [apps/web/CLAUDE.md](../../../../apps/web/CLAUDE.md) — правила 10–15 · [openapi.yaml](../contracts/openapi.yaml) — `getProduct`
